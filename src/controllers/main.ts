import chalk from 'chalk'
import {
  commitChanges,
  ensureInsideGitRepo,
  getChangedFiles,
  getCurrentBranch,
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
  const config = await loadConfig(cwd)
  await ensureInsideGitRepo(cwd)
  const branch = await getCurrentBranch(cwd)
  const files = await getChangedFiles(cwd)

  if (files.length === 0) {
    console.log('No changed files found.')
    return
  }

  console.log(`${chalk.cyan(' Branch')} ${chalk.white(branch)}\n`)

  const selectedFiles = await promptForFilesToStage(files)
  const filesToStage = selectedFiles.length > 0 ? selectedFiles : files
  console.log(filesToStage.join('\n'))
  console.log('')

  await stageFiles(filesToStage, cwd)

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
      finalCommitMessage = (
        await runWithLoading('Generating commit message', () =>
          generateCommitMessage(cwd, config, selectedModel)
        )
      ).text

      if (finalCommitMessage.length === 0) {
        throw new Error('The selected model returned an empty commit message.')
      }

      console.log(
        `${chalk.magenta('󰚩 Generated message')}\n${chalk.white(finalCommitMessage)}`
      )

      if (config.autoAcceptCommitMessage) {
        break
      }

      const action = await promptForGeneratedCommitAction()

      if (action === 'accept') {
        break
      }

      if (action === 'cancel') {
        console.log('Commit cancelled.')
        return
      }
    }
  }

  console.log('')
  await commitChanges(finalCommitMessage, cwd)
  console.log('')

  const shouldRunPostCommand =
    config.autoRunPostCommand ||
    (await promptForPostCommand(
      config.postCommand === 'push'
        ? 'git push'
        : 'git push && git pull --rebase'
    ))

  if (!shouldRunPostCommand) {
    return
  }

  await runPostCommand(config.postCommand, cwd)
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
