import chalk from 'chalk'
import {
  commitChanges,
  ensureInsideGitRepo,
  getChangedFiles,
  getCurrentBranch,
  getRepositoryRoot,
  runPostCommand,
  stageFiles,
} from '../lib/git'
import { generateCommitMessage } from '../lib/llm/generate-commit-message'
import { loadConfig } from '../lib/load-config'
import {
  promptForCommitMessageInput,
  promptForFilesToStage,
  promptForGeneratedCommitAction,
  promptForPostCommand,
} from '../lib/prompts'
import { runWithLoading } from '../lib/run-with-loading'
import { getStoredApiKey } from '../lib/secrets'

type MainControllerOptions = {
  generate?: boolean
  message?: string
  post?: boolean
  stage?: boolean
  yolo?: boolean
}

export async function mainController(options: MainControllerOptions = {}) {
  const cwd = process.cwd()
  await ensureInsideGitRepo(cwd)

  const repoRoot = await getRepositoryRoot(cwd)
  const config = await loadConfig(repoRoot)

  const forceStageEnabled = options.stage || options.yolo
  const forceLLMGenerate = options.generate || options.yolo
  const forceExecPostCommand = options.post || options.yolo

  let finalCommitMessage = options.message?.trim() ?? ''
  if (typeof options.message === 'string' && finalCommitMessage.length === 0) {
    throw new Error('Provided commit message cannot be empty.')
  }

  const files = await getChangedFiles(repoRoot)
  if (files.length === 0) {
    console.log('No changed files found.')
    return
  }

  const branch = await getCurrentBranch(repoRoot)
  console.log(`${chalk.cyan(' Branch:')} ${chalk.reset.bold(branch)}\n`)

  if (forceStageEnabled) {
    console.log(chalk.yellow.dim(' Staging all files..'))
  }

  const selectedFiles = forceStageEnabled
    ? files
    : await promptForFilesToStage(files)

  const filesToStage = selectedFiles.length > 0 ? selectedFiles : files
  console.log(filesToStage.join('\n'))
  console.log('')

  await stageFiles(filesToStage, repoRoot)

  const apiKey = config.model
    ? await getStoredApiKey(config.model.provider)
    : null

  if (finalCommitMessage.length > 0) {
    console.log(chalk.yellow.dim(' Using provided commit message'))
    console.log(chalk.magenta.dim(finalCommitMessage))
  }

  if (finalCommitMessage.length === 0 && !forceLLMGenerate) {
    finalCommitMessage = await promptForCommitMessageInput(
      config.model && apiKey
        ? { name: config.model.name, hasKey: true }
        : config.model
          ? { name: config.model.name, hasKey: false }
          : undefined
    )
  }

  if (finalCommitMessage.length === 0) {
    if (!config.model || !apiKey) {
      throw new Error(
        'No commit message provided and no model configured for generation.'
      )
    }

    while (true) {
      if (forceLLMGenerate) {
        console.log(chalk.yellow.dim(' Using LLM to generate message'))
      }

      const llmResult = await runWithLoading('Generating commit message', () =>
        generateCommitMessage(repoRoot, config, {
          ...config.model!,
          key: apiKey,
        })
      )

      finalCommitMessage = llmResult.text.trim()
      if (finalCommitMessage.length === 0) {
        throw new Error('The selected model returned an empty commit message.')
      }

      console.log(chalk.magenta.dim(finalCommitMessage))

      if (forceLLMGenerate || config.autoAcceptCommitMessage) {
        break
      }

      const action = await promptForGeneratedCommitAction()
      if (action === 'accept' || action === 'cancel') {
        break
      }
    }
  }

  if (finalCommitMessage.length === 0) {
    throw new Error('Commit message cannot be empty.')
  }

  console.log('')
  console.log(chalk.yellow.dim(' Committing staged changes'))

  await commitChanges(finalCommitMessage, repoRoot)
  console.log('')

  if (!config.postCommand) {
    return
  }

  if (forceExecPostCommand || config.autoRunPostCommand) {
    console.log(chalk.yellow.dim(` Executing: ${config.postCommand}`))
  } else {
    const shouldRunPostCommand = await promptForPostCommand(config.postCommand)
    if (!shouldRunPostCommand) {
      return
    }
  }

  await runPostCommand(config.postCommand, repoRoot)
}
