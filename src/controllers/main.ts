import chalk from 'chalk'
import prettyMilliseconds from 'pretty-ms'
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
  promptForApiKey,
  promptForCommitMessageInput,
  promptForFilesToStage,
  promptForGeneratedCommitAction,
  promptForModelName,
  promptForPostCommand,
  promptForProviderSelection,
} from '../lib/prompts'
import { runWithLoading } from '../lib/run-with-loading'
import { setStoredApiKey } from '../lib/secrets'

type SelectedModel = {
  provider: string
  name: string
  reasoning?: boolean | string
}

export async function mainController() {
  const cwd = process.cwd()
  await ensureInsideGitRepo(cwd)

  const repoRoot = await getRepositoryRoot(cwd)
  const config = await loadConfig(repoRoot)

  const files = await getChangedFiles(repoRoot)
  if (files.length === 0) {
    console.log('No changed files found.')
    return
  }

  const branch = await getCurrentBranch(repoRoot)
  console.log(`${chalk.cyan(' Branch:')} ${chalk.reset.bold(branch)}\n`)

  const selectedFiles = await promptForFilesToStage(files)
  const filesToStage = selectedFiles.length > 0 ? selectedFiles : files
  console.log(filesToStage.join('\n'))
  console.log('')

  await stageFiles(filesToStage, repoRoot)

  const selectedModel: SelectedModel = config.model
    ? {
        provider: config.model.provider,
        name: config.model.name,
        reasoning: config.model.reasoning,
      }
    : await promptForModelConfig()

  let finalCommitMessage = await promptForCommitMessageInput(selectedModel)

  if (finalCommitMessage.length === 0) {
    while (true) {
      const startedAt = Date.now()
      finalCommitMessage = (
        await runWithLoading('Generating commit message', () =>
          generateCommitMessage(repoRoot, config, selectedModel)
        )
      ).text

      if (finalCommitMessage.length === 0) {
        throw new Error('The selected model returned an empty commit message.')
      }

      console.log(
        chalk.magenta('󰚩 Generated message'),
        chalk.gray(
          `(${prettyMilliseconds(Date.now() - startedAt, {
            secondsDecimalDigits: 1,
            millisecondsDecimalDigits: 0,
          })})`
        )
      )

      console.log(chalk.white(finalCommitMessage))

      if (config.autoAcceptCommitMessage) {
        console.log(chalk.green(` Accepted generated commit message`))
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

  await commitChanges(finalCommitMessage, repoRoot)
  console.log('')

  if (config.autoRunPostCommand) {
    console.log(chalk.green(` Accepted post command: ${config.postCommand}`))
  } else {
    const shouldRunPostCommand = await promptForPostCommand(config.postCommand)
    if (!shouldRunPostCommand) {
      return
    }
  }

  await runPostCommand(config.postCommand, repoRoot)
}

async function promptForModelConfig(): Promise<SelectedModel> {
  console.log('No model configured. Enter model details for this run.')

  const provider = await promptForProviderSelection([
    'anthropic',
    'google',
    'openai',
    'openrouter',
  ])

  const name = await promptForModelName()
  const apiKey = await promptForApiKey(provider)

  await setStoredApiKey(provider, apiKey.trim())

  return {
    provider,
    name: name.trim(),
    reasoning: false,
  }
}
