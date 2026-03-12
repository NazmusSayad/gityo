import { resolveCommitMessage } from '../commit-message'
import { loadConfig } from '../config'
import {
  commitChanges,
  getPostCommandLabel,
  getRepositoryState,
  getStagedDiff,
  runPostCommand,
  stageFiles,
} from '../git'
import {
  generateCommitMessage,
  getConfiguredModelOptions,
  getDefaultModelOption,
} from '../models'
import { promptForFilesToStage, promptForPostCommand } from '../prompts'

export async function runCommand() {
  const { config } = await loadConfig()
  const repositoryState = await getRepositoryState()

  if (repositoryState.files.length === 0) {
    process.stdout.write('No changed files found.\n')
    return
  }

  const selectedFiles = await promptForFilesToStage(repositoryState)
  const filesToStage =
    selectedFiles.length > 0 ? selectedFiles : repositoryState.files

  await stageFiles(filesToStage)
  const modelOptions = getConfiguredModelOptions(config)
  const defaultModel = getDefaultModelOption(modelOptions, config.defaultModel)
  const stagedDiff = await getStagedDiff()

  const commitMessage = await resolveCommitMessage({
    autoAcceptCommitMessage: config.autoAcceptCommitMessage,
    customInstructions: config.customInstructions,
    defaultModel,
    modelOptions,
    stagedDiff,
    generateCommitMessage,
  })

  if (!commitMessage) {
    process.stdout.write('Commit cancelled.\n')
    return
  }

  await commitChanges(commitMessage)

  const shouldRunPostCommand =
    config.autoRunPostCommand ||
    (await promptForPostCommand(getPostCommandLabel(config.postCommand)))

  if (!shouldRunPostCommand) {
    return
  }

  await runPostCommand(config.postCommand)
}
