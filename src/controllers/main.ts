import type { LanguageModel } from 'ai'
import chalk from 'chalk'
import type { SimpleGit } from 'simple-git'
import {
  DEFAULT_MAX_DIFF_TOKENS,
  DEFAULT_PER_FILE_CAP,
  estimateTokens,
  minimizeDiff,
  splitDiffIntoChunks,
} from '../lib/diff'
import { getChangedFiles, getCommitDiff, getGit } from '../lib/git'
import {
  generateCommitMessage,
  generateCommitMessageFromSummaries,
  summarizeChanges,
} from '../lib/llm/message'
import { resolveLanguageModel } from '../lib/llm/model'
import {
  getStyleKeys,
  resolveInstructionContent,
  resolveStyle,
} from '../lib/llm/style'
import { loadConfig } from '../lib/load-config'
import {
  acceptGeneratedCommitMessage,
  promptForCommitMessageInput,
  promptForPostCommand,
} from '../lib/prompts'
import { runWithLoading } from '../lib/run-with-loading'

type MainControllerOptions = {
  generate?: boolean
  input?: string
  model?: string
  style?: string
  post?: boolean
  yolo?: boolean
}

const MAP_CONCURRENCY = 3
const PROMPT_RESERVE_TOKENS = 800
const MIN_CHUNK_BUDGET_TOKENS = 1000
const MAX_TOC_LINES = 500

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

  const styleKey = options.style ?? config.style ?? 'default'
  const style = await resolveStyle(styleKey, config.styles)
  if (!style) {
    const availableStyles = getStyleKeys(config.styles).join(', ')
    throw new Error(
      `Style '${styleKey}' is not configured. Available styles: ${availableStyles}.`
    )
  }

  const instructions = config.instructions
    ? await resolveInstructionContent(config.instructions)
    : null

  const forceLLMGenerate = options.generate || options.yolo
  const forceExecPostCommand = options.post || options.yolo

  let finalCommitMessage = options.input?.trim() ?? ''
  if (typeof options.input === 'string' && finalCommitMessage.length === 0) {
    throw new Error('Provided commit message input cannot be empty.')
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
          generateMessage({
            git,
            languageModel,
            style,
            instructions,
            diff,
            files,
            perFileCap: config.perFileCap ?? DEFAULT_PER_FILE_CAP,
            maxDiffTokens: config.maxDiffTokens ?? DEFAULT_MAX_DIFF_TOKENS,
          })
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
    console.log(chalk.green('✓ Committing changes'))
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
    console.log(chalk.yellow(`✓ Executing: ${config.postCommand}`))
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

type GenerateMessageOptions = {
  git: SimpleGit
  languageModel: LanguageModel
  style: string
  instructions: string | null
  diff: string
  files: string[]
  maxDiffTokens: number
  perFileCap: number
}

async function generateMessage(options: GenerateMessageOptions) {
  const { git, languageModel, style, instructions, diff } = options

  if (estimateTokens(diff) <= options.maxDiffTokens) {
    return generateCommitMessage(languageModel, style, instructions, diff)
  }

  console.log(chalk.yellow('• Large diff detected, minimizing'))

  const { toc, body } = await minimizeDiff(git, {
    perFileCap: options.perFileCap,
    allFiles: options.files,
  })

  if (estimateTokens(toc) + estimateTokens(body) <= options.maxDiffTokens) {
    return generateCommitMessage(
      languageModel,
      style,
      instructions,
      `${toc}\n\n${body}`
    )
  }

  console.log(chalk.yellow('• Diff still too large, summarizing in parts'))

  let effectiveToc = toc
  let chunkBudget =
    options.maxDiffTokens - estimateTokens(effectiveToc) - PROMPT_RESERVE_TOKENS

  if (chunkBudget < MIN_CHUNK_BUDGET_TOKENS) {
    effectiveToc = toc.split('\n').slice(0, MAX_TOC_LINES).join('\n')
    chunkBudget = Math.max(
      options.maxDiffTokens -
        estimateTokens(effectiveToc) -
        PROMPT_RESERVE_TOKENS,
      MIN_CHUNK_BUDGET_TOKENS
    )
  }

  const chunks = splitDiffIntoChunks(body, chunkBudget)
  const summaries = new Array<string>(chunks.length)
  let nextChunk = 0

  async function worker() {
    while (nextChunk < chunks.length) {
      const index = nextChunk++
      summaries[index] = await summarizeChanges(
        languageModel,
        effectiveToc,
        chunks[index]
      )
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(MAP_CONCURRENCY, chunks.length) }, worker)
  )

  return generateCommitMessageFromSummaries(
    languageModel,
    style,
    instructions,
    effectiveToc,
    summaries
  )
}
