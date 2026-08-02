import chalk from 'chalk'
import { getChangedFiles, getCommitDiff, getGit } from '../lib/git'
import { generateCommitMessage } from '../lib/llm/generate-commit-message'
import { resolveLanguageModel } from '../lib/llm/resolve-language-model'
import { loadConfig } from '../lib/load-config'
import {
  acceptGeneratedCommitMessage,
  promptForCommitMessageInput,
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
    return console.log('No changed files found.')
  }

  const { diff, hasStaged } = await getCommitDiff(git)

  if (finalCommitMessage.length > 0) {
    console.log(chalk.yellow('✓ Using direct commit message'))
    console.log(chalk.cyan.dim(finalCommitMessage))
    console.log('')
  }

  if (finalCommitMessage.length === 0 && !forceLLMGenerate) {
    finalCommitMessage = await promptForCommitMessageInput(modelConfig.model)
    if (finalCommitMessage.length > 0) {
      console.log(chalk.yellow('✓ Using manual commit message'))
      console.log(chalk.cyan.dim(finalCommitMessage))
      console.log('')
    }
  }

  if (finalCommitMessage.length === 0) {
    while (true) {
      if (forceLLMGenerate) {
        console.log(chalk.yellow('• Using LLM to generate message'))
      }

      const commitMessage = await runWithLoading(
        'Generating commit message',
        () =>
          generateCommitMessage(
            languageModel,
            config.instructions ?? null,
            diff
          )
      )

      finalCommitMessage = commitMessage.trim()
      if (finalCommitMessage.length === 0) {
        throw new Error('The selected model returned an empty commit message.')
      }

      console.log(chalk.cyan.dim(finalCommitMessage))
      console.log('')

      if (forceLLMGenerate || config.autoAcceptCommitMessage) {
        break
      }

      const action = await acceptGeneratedCommitMessage()
      if (action) break
    }
  }

  if (finalCommitMessage.length === 0) {
    throw new Error('Commit message cannot be empty.')
  }

  if (forceLLMGenerate) {
    console.log(chalk.green('✓ Committing changes..'))
  }

  if (!hasStaged) {
    await git.add(['-A'])
  }

  console.log(files.join('\n'))
  console.log('')

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
