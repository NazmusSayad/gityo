import { confirm } from '@inquirer/prompts'
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
import {
  getChangedFiles,
  getCommitDiff,
  getGit,
  getStagedFiles,
  type DiffScope,
} from '../lib/git'
import {
  generateCommitMessage,
  generateCommitMessageFromSummaries,
  summarizeChanges,
} from '../lib/llm/message'
import { resolveLanguageModel, resolveModelConfig } from '../lib/llm/model'
import {
  getStyleKeys,
  resolveInstructionContent,
  resolveStyle,
} from '../lib/llm/style'
import { loadConfig } from '../lib/load-config'
import { acceptGenerated, selectionTheme } from '../lib/prompts'
import { runWithLoading } from '../lib/run-with-loading'

type MainControllerOptions = {
  generate?: boolean
  input?: string
  model?: string
  style?: string
  post?: boolean
  yolo?: boolean
  push?: boolean
  scope?: CommitScope
}

export type CommitScope = 'everything' | 'staged-only' | 'staged-or-changes'

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
  const modelConfig = resolveModelConfig(config.models, modelKey)

  const languageModel = resolveLanguageModel(modelConfig)

  const styleKey = options.style ?? config.commitStyle ?? 'default'
  const style = await resolveStyle(styleKey, config.commitStyles)
  if (!style) {
    const availableStyles = getStyleKeys(config.commitStyles).join(', ')
    throw new Error(
      `Style '${styleKey}' is not configured. Available styles: ${availableStyles}.`
    )
  }

  const instructions = config.commitInstructions
    ? await resolveInstructionContent(config.commitInstructions)
    : null

  const forceLLMGenerate = options.generate || options.yolo
  const forceExecPostCommand = options.post || options.yolo

  let finalCommitMessage = options.input?.trim() ?? ''
  if (typeof options.input === 'string' && finalCommitMessage.length === 0) {
    throw new Error('Provided commit message input cannot be empty.')
  }

  const { diffScope, files } = await getCommitFiles(
    git,
    options.scope ?? 'staged-or-changes'
  )
  if (files.length === 0) {
    return console.log('No changed files found.')
  }

  const diff = await getCommitDiff(git, diffScope)

  if (finalCommitMessage.length > 0) {
    console.log(chalk.yellow('✓ Using direct commit message'))
    console.log(chalk.cyan.dim(finalCommitMessage))
    console.log('')
  }

  if (finalCommitMessage.length === 0) {
    while (true) {
      const commitMessage = await runWithLoading(
        'Generating commit message',
        () =>
          generateMessage({
            git,
            scope: diffScope,
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

      const action = await acceptGenerated(
        'Accept generated commit message?',
        'generate a new commit message'
      )
      if (action) break
    }
  }

  if (finalCommitMessage.length === 0) {
    throw new Error('Commit message cannot be empty.')
  }

  if (forceLLMGenerate) {
    console.log(chalk.green('✓ Committing changes'))
  }

  if (diffScope === 'all') {
    await git.add(['-A'])
  }

  console.log(files.join('\n'))
  console.log('')

  await liveGit.commit(finalCommitMessage)
  console.log('')

  if (!config.postCommand && !options.push) {
    return
  }

  if (config.postCommand) {
    if (forceExecPostCommand || config.autoRunPostCommand) {
      console.log(chalk.yellow(`✓ Executing: ${config.postCommand}`))
    } else {
      const shouldRunPostCommand = await confirm({
        message: `Run post command: ${config.postCommand}?`,
        default: true,
        theme: selectionTheme,
      })
      if (!shouldRunPostCommand) {
        return
      }
    }
  } else {
    console.log(chalk.yellow('✓ Pushing changes'))
  }

  await liveGit.push()
  if (config.postCommand === 'push-and-pull') {
    await liveGit.pull()
  }
}

export async function getCommitFiles(git: SimpleGit, commitScope: CommitScope) {
  const stagedFiles = await getStagedFiles(git)

  let diffScope: DiffScope
  if (commitScope === 'everything') {
    diffScope = 'all'
  } else if (commitScope === 'staged-only') {
    if (stagedFiles.length === 0) {
      throw new Error('Nothing is staged.')
    }
    diffScope = 'staged'
  } else if (commitScope === 'staged-or-changes') {
    diffScope = stagedFiles.length > 0 ? 'staged' : 'all'
  } else {
    throw new Error(`Unknown commit scope '${commitScope as string}'.`)
  }

  const files =
    diffScope === 'staged' ? stagedFiles : await getChangedFiles(git)

  return { diffScope, files }
}

type GenerateMessageOptions = {
  git: SimpleGit
  scope: DiffScope
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

  const { toc, body } = await minimizeDiff(git, {
    scope: options.scope,
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
