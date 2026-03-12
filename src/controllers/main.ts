import { execa } from 'execa'
import { commitChanges, runPostCommand, stageFiles } from '../lib/git'
import { generateCommitMessage } from '../lib/llm/generate-commit-message'
import { loadConfig } from '../lib/load-config'
import { getConfiguredModelOptions } from '../lib/models'
import {
  promptForCommitMessageInput,
  promptForFilesToStage,
  promptForGeneratedCommitAction,
  promptForPostCommand,
} from '../lib/prompts'

export async function mainController() {
  const cwd = process.cwd()
  const config = await loadConfig(cwd)
  const repositoryResult = await execa(
    'git',
    ['rev-parse', '--is-inside-work-tree'],
    {
      cwd,
      reject: false,
    }
  )

  if (
    repositoryResult.exitCode !== 0 ||
    repositoryResult.stdout.trim() !== 'true'
  ) {
    throw new Error('gityo must be run inside a git repository.')
  }

  const [branchResult, unstagedResult, stagedResult, untrackedResult] =
    await Promise.all([
      execa('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
        cwd,
        reject: false,
      }),
      execa('git', ['diff', '--name-only', '--diff-filter=ACDMRTUXB', '-z'], {
        cwd,
        reject: false,
      }),
      execa(
        'git',
        ['diff', '--cached', '--name-only', '--diff-filter=ACDMRTUXB', '-z'],
        {
          cwd,
          reject: false,
        }
      ),
      execa('git', ['ls-files', '--others', '--exclude-standard', '-z'], {
        cwd,
        reject: false,
      }),
    ])

  if (branchResult.exitCode !== 0) {
    throw new Error(branchResult.stderr.trim() || 'Git command failed.')
  }

  if (unstagedResult.exitCode !== 0) {
    throw new Error(unstagedResult.stderr.trim() || 'Git command failed.')
  }

  if (stagedResult.exitCode !== 0) {
    throw new Error(stagedResult.stderr.trim() || 'Git command failed.')
  }

  if (untrackedResult.exitCode !== 0) {
    throw new Error(untrackedResult.stderr.trim() || 'Git command failed.')
  }

  const branch =
    branchResult.stdout.trim() === 'HEAD'
      ? '(detached HEAD)'
      : branchResult.stdout.trim()
  const files = Array.from(
    new Set([
      ...unstagedResult.stdout.split('\0').filter(Boolean),
      ...stagedResult.stdout.split('\0').filter(Boolean),
      ...untrackedResult.stdout.split('\0').filter(Boolean),
    ])
  ).sort((left, right) => left.localeCompare(right))

  if (files.length === 0) {
    console.log('No changed files found.')
    return
  }

  const selectedFiles = await promptForFilesToStage(branch, files)
  const filesToStage = selectedFiles.length > 0 ? selectedFiles : files

  await stageFiles(filesToStage, cwd)

  const modelOptions = getConfiguredModelOptions(config)
  let defaultModel = modelOptions[0]

  if (config.defaultModel) {
    const exactModel = modelOptions.find(
      (model) => `${model.provider}:${model.name}` === config.defaultModel
    )

    if (exactModel) {
      defaultModel = exactModel
    } else {
      const matchingModels = modelOptions.filter(
        (model) => model.name === config.defaultModel
      )

      if (matchingModels.length === 1) {
        defaultModel = matchingModels[0]
      }
    }
  }

  const commitMessageInput = await promptForCommitMessageInput(
    modelOptions,
    defaultModel
  )

  let commitMessage = commitMessageInput.message

  if (commitMessage.length === 0) {
    const selectedModel = commitMessageInput.selectedModel ?? defaultModel

    if (!selectedModel) {
      throw new Error('No models are configured for commit message generation.')
    }

    while (true) {
      commitMessage = (
        await generateCommitMessage({
          cwd,
          config,
          selectedModel,
        })
      ).trim()

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
