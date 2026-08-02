import chalk from 'chalk'
import { getChangedFiles, getCommitDiff, getGit } from '../lib/git'
import { generateCommitMessage } from '../lib/llm/generate-commit-message'
import { resolveLanguageModel } from '../lib/llm/resolve-language-model'
import { loadConfig } from '../lib/load-config'
import {
  promptForCommitMessageInput,
  promptForGeneratedCommitAction,
  promptForPostCommand,
} from '../lib/prompts'
import { runWithLoading } from '../lib/run-with-loading'

type MainControllerOptions = {
  generate?: boolean
  message?: string
  model?: string
  post?: boolean
  yolo?: boolean
}

export async function mainController(options: MainControllerOptions = {}) {
  const { git, liveGit } = await getGit()
  const config = await loadConfig(
    (await git.revparse(['--show-toplevel'])).trim()
  )

  const modelKey = options.model ?? 'default'
  const modelConfig = config.models?.[modelKey]

  if (!modelConfig) {
    const availableModels = Object.keys(config.models ?? {}).join(', ')
    const hint =
      availableModels.length === 0
        ? 'No models configured. Edit your config file to add a model — run `gityo config` to see where.'
        : `Model '${modelKey}' is not configured. Available models: ${availableModels}.`

    throw new Error(hint)
  }

  const languageModel = resolveLanguageModel(modelConfig)

  const forceLLMGenerate = options.generate || options.yolo
  const forceExecPostCommand = options.post || options.yolo

  let finalCommitMessage = options.message?.trim() ?? ''
  if (typeof options.message === 'string' && finalCommitMessage.length === 0) {
    throw new Error('Provided commit message cannot be empty.')
  }

  const files = await getChangedFiles(git)
  if (files.length === 0) {
    console.log('No changed files found.')
    return
  }

  const branchSummary = await git.branch()
  const branch = branchSummary.detached
    ? '(detached HEAD)'
    : branchSummary.current
  console.log(`${chalk.cyan(' Branch:')} ${chalk.reset.bold(branch)}\n`)

  const { diff, hasStaged } = await getCommitDiff(git)

  if (finalCommitMessage.length > 0) {
    console.log(chalk.yellow.dim('✓ Using provided commit message'))
    console.log(chalk.magenta.dim(finalCommitMessage))
  }

  if (finalCommitMessage.length === 0 && !forceLLMGenerate) {
    finalCommitMessage = await promptForCommitMessageInput(modelConfig.model)
  }

  if (finalCommitMessage.length === 0) {
    while (true) {
      if (forceLLMGenerate) {
        console.log(chalk.yellow.dim('✓ Using LLM to generate message'))
      }

      const llmResult = await runWithLoading('Generating commit message', () =>
        generateCommitMessage(languageModel, config.instructions ?? null, diff)
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
  if (!hasStaged) {
    console.log(chalk.yellow.dim('✓ Staging all files..'))
    await git.add(['-A'])
  }

  console.log(files.join('\n'))
  console.log('')
  console.log(chalk.yellow.dim('✓ Committing staged changes'))

  await liveGit.commit(finalCommitMessage)
  console.log('')

  if (!config.postCommand) {
    return
  }

  if (forceExecPostCommand || config.autoRunPostCommand) {
    console.log(chalk.yellow.dim(`✓ Executing: ${config.postCommand}`))
  } else {
    const shouldRunPostCommand = await promptForPostCommand(config.postCommand)
    if (!shouldRunPostCommand) {
      return
    }
  }

  await liveGit.push()
  if (config.postCommand === 'push-and-pull') {
    await liveGit.pull()
  }
}
