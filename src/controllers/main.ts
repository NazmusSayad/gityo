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

  const selectedFiles = await promptForFilesToStage(branch, files)
  const filesToStage = selectedFiles.length > 0 ? selectedFiles : files
  console.log('')

  await stageFiles(filesToStage, cwd)

  const selectedModel: SelectedModel = config.model
    ? {
        provider: config.model.provider,
        name: config.model.name,
        reasoning: config.model.reasoning,
      }
    : await promptForModelConfig()

  const commitMessageInput = await promptForCommitMessageInput(selectedModel)

  let commitMessage = commitMessageInput.message

  if (commitMessage.length === 0) {
    console.log('')

    while (true) {
      commitMessage = (await generateCommitMessage(cwd, config, selectedModel))
        .text

      if (commitMessage.length === 0) {
        throw new Error('The selected model returned an empty commit message.')
      }

      if (config.autoAcceptCommitMessage) {
        break
      }

      const action = await promptForGeneratedCommitAction(commitMessage)

      if (action === 'accept') {
        break
      }

      if (action === 'cancel') {
        console.log('Commit cancelled.')
        return
      }
    }
  }

  await commitChanges(commitMessage, cwd)
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

  console.log('')

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
