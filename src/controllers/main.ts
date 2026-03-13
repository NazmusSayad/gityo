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
  getLastUsedModel,
  setLastUsedModel,
} from '../lib/model-selection-state'
import {
  promptForCommitMessageInput,
  promptForFilesToStage,
  promptForGeneratedCommitAction,
  promptForPostCommand,
} from '../lib/prompts'

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

  await stageFiles(filesToStage, cwd)

  const modelOptions: SelectedModel[] = []

  for (const [provider, entries] of Object.entries(config.models)) {
    for (const entry of entries) {
      modelOptions.push({
        provider,
        name: typeof entry === 'string' ? entry : entry.name,
        reasoning: typeof entry === 'string' ? undefined : entry.reasoning,
      })
    }
  }

  const lastUsedModel = await getLastUsedModel()
  const defaultModelIndex =
    lastUsedModel === undefined
      ? 0
      : Math.max(
          modelOptions.findIndex(
            (option) =>
              option.provider === lastUsedModel.provider &&
              option.name === lastUsedModel.name
          ),
          0
        )

  const commitMessageInput = await promptForCommitMessageInput(
    modelOptions,
    defaultModelIndex
  )

  const selectedModel =
    modelOptions[commitMessageInput.selectedModelIndex ?? defaultModelIndex]

  if (selectedModel) {
    await setLastUsedModel({
      provider: selectedModel.provider,
      name: selectedModel.name,
    })
  }

  let commitMessage = commitMessageInput.message

  if (commitMessage.length === 0) {
    if (!selectedModel) {
      throw new Error('No models are configured for commit message generation.')
    }

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
