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
  promptForCommitMessageInput,
  promptForFilesToStage,
  promptForGeneratedCommitAction,
  promptForPostCommand,
} from '../lib/prompts'
import { runWithLoading } from '../lib/run-with-loading'

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

  let finalCommitMessage = await promptForCommitMessageInput(config.model)

  if (finalCommitMessage.length === 0) {
    // Check the selected model, not none is there or api key not here throw error, and explain the user how we can add models

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
        chalk.reset.dim(
          `(${prettyMilliseconds(Date.now() - startedAt, {
            secondsDecimalDigits: 1,
            millisecondsDecimalDigits: 0,
          })})`
        )
      )

      console.log(chalk.white(finalCommitMessage))

      if (config.autoAcceptCommitMessage) {
        console.log('')
        console.log(chalk.green.dim(` Committing with generated message`))
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
    console.log(chalk.green.dim(` Executing: ${config.postCommand}`))
  } else {
    const shouldRunPostCommand = await promptForPostCommand(config.postCommand)
    if (!shouldRunPostCommand) {
      return
    }
  }

  await runPostCommand(config.postCommand, repoRoot)
}
