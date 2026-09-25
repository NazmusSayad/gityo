import type { LanguageModel } from 'ai'
import chalk from 'chalk'
import { createRenderer } from 'markdansi'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { DEFAULT_MAX_DIFF_TOKENS, estimateTokens } from './diff.js'
import {
  createPullRequest as createPullRequestApi,
  fetchCompare,
  findPullRequest,
  getDefaultBranch,
  type CompareResult,
  type PullRequest,
} from './gh.js'
import { resolveLanguageModel, resolveModelConfig } from './llm/model.js'
import {
  generatePullRequest,
  PR_BODY_STYLES,
  PR_TITLE_STYLES,
} from './llm/pr.js'
import { loadConfig } from './load-config.js'
import { acceptGenerated } from './prompts.js'
import { runWithLoading } from './run-with-loading.js'
import { exec } from './shell.js'

const PR_URL_PATTERN = /https:\/\/[^\s]+\/pull\/(\d+)/
const PR_RENDER_WIDTH = 80

const renderPullRequest = createRenderer({
  width: PR_RENDER_WIDTH,
  listIndent: 2,
})

export async function getCurrentBranch() {
  const output = await exec('git', ['branch', '--show-current'])

  return output.trim()
}

async function getRepoRoot() {
  const output = await exec('git', ['rev-parse', '--show-toplevel'])

  return output.trim()
}

export async function resolvePrBranches(baseArg?: string, headArg?: string) {
  const head = headArg?.trim() || (await getCurrentBranch())

  if (head.length === 0) {
    throw new Error('Could not determine the current branch.')
  }

  const base = baseArg?.trim() || (await getDefaultBranch())

  if (base.length === 0) {
    throw new Error('Could not determine the base branch.')
  }

  if (base === head) {
    throw new Error(`Base branch and head branch are both '${base}'.`)
  }

  return { base, head }
}

type CreatePullRequestOptions = {
  base: string
  head: string
  languageModel: LanguageModel
  systemPrompt: string
  maxDiffTokens?: number
  autoAccept?: boolean
}

type PullRequestContent = {
  title: string
  body: string
}

type PullRequestContextOptions = {
  modelKey?: string
  titleStyle?: string
  bodyStyle?: string
}

export async function loadPullRequestContext(
  options: PullRequestContextOptions = {}
) {
  const repoRoot = await getRepoRoot()
  const config = await loadConfig(repoRoot)
  const modelConfig = resolveModelConfig(
    config.models,
    options.modelKey ?? config.prModel ?? config.model
  )
  const languageModel = resolveLanguageModel(modelConfig)

  const titleStyleKey = options.titleStyle ?? config.prTitleStyle ?? 'default'
  const titleStyle =
    config.prTitleStyles?.[titleStyleKey] ?? PR_TITLE_STYLES[titleStyleKey]

  if (!titleStyle) {
    const availableStyles = Object.keys({
      ...PR_TITLE_STYLES,
      ...config.prTitleStyles,
    }).join(', ')
    throw new Error(
      `Pull request title style '${titleStyleKey}' is not configured. Available title styles: ${availableStyles}.`
    )
  }

  const titleInstructions =
    typeof titleStyle === 'string'
      ? titleStyle
      : await readFile(path.resolve(titleStyle.path), 'utf8')

  const bodyStyleKey = options.bodyStyle ?? config.prBodyStyle ?? 'default'
  const bodyStyle =
    config.prBodyStyles?.[bodyStyleKey] ?? PR_BODY_STYLES[bodyStyleKey]

  if (!bodyStyle) {
    const availableStyles = Object.keys({
      ...PR_BODY_STYLES,
      ...config.prBodyStyles,
    }).join(', ')
    throw new Error(
      `Pull request body style '${bodyStyleKey}' is not configured. Available body styles: ${availableStyles}.`
    )
  }

  const bodyInstructions =
    typeof bodyStyle === 'string'
      ? bodyStyle
      : await readFile(path.resolve(bodyStyle.path), 'utf8')

  return {
    config,
    languageModel,
    titleInstructions,
    bodyInstructions,
  }
}

export async function createPullRequest(
  options: CreatePullRequestOptions
): Promise<PullRequest> {
  const maxDiffTokens = options.maxDiffTokens ?? DEFAULT_MAX_DIFF_TOKENS
  const compare = await fetchCompare(options.base, options.head)

  if (compare.commits.length === 0) {
    throw new Error(
      `No commits found between '${options.base}' and '${options.head}'.`
    )
  }

  const context = buildCompareContext(compare, maxDiffTokens)
  let draft = ''

  while (true) {
    draft = await runWithLoading('Generating pull request title and body', () =>
      generatePullRequest({
        languageModel: options.languageModel,
        systemPrompt: options.systemPrompt,
        context,
      })
    )

    console.log(renderPullRequest(draft).trim())
    console.log('')

    if (
      options.autoAccept ||
      (await acceptGenerated(
        `Create PR: ${chalk.red.bold(options.base)} ${chalk.reset('←')} ${chalk.yellow.bold(options.head)}`,
        'generate a new pull message'
      ))
    ) {
      break
    }
  }

  const content = parsePullRequestContent(draft)
  if (content.title.length === 0) {
    throw new Error('The selected model returned an empty pull request title.')
  }

  if (options.autoAccept) {
    console.log(chalk.green('✓ Creating pull request'))
  }

  const output = await createPullRequestApi({
    title: content.title,
    body: content.body,
    base: options.base,
    head: options.head,
  })

  const pullRequest = await resolveCreatedPullRequest(output, options)
  console.log(pullRequest.url)

  return pullRequest
}

function parsePullRequestContent(text: string): PullRequestContent {
  const lines = text.trim().split('\n')

  return {
    title: lines[0]
      .trim()
      .replace(/^#{1,6}\s*/, '')
      .replace(/^(\*\*|__|\*|_|`)+/, '')
      .replace(/(\*\*|__|\*|_|`)+$/, '')
      .trim(),
    body: lines.slice(1).join('\n').trim(),
  }
}

async function resolveCreatedPullRequest(
  output: string,
  options: CreatePullRequestOptions
): Promise<PullRequest> {
  const match = output.match(PR_URL_PATTERN)

  if (match) {
    return {
      number: Number(match[1]),
      url: match[0],
      baseRefName: options.base,
      headRefName: options.head,
    }
  }

  const found = await findPullRequest(options.base, options.head)

  if (found) {
    return found
  }

  throw new Error('Pull request was created but could not be located.')
}

function buildCompareContext(compare: CompareResult, maxDiffTokens: number) {
  const files = compare.files ?? []
  const lines = [
    'Commits between base and head:',
    ...compare.commits.map((entry) =>
      entry.commit.message
        .trim()
        .split('\n')
        .map((line, index) => (index === 0 ? `- ${line}` : `  ${line}`))
        .join('\n')
    ),
  ]

  let context = lines.join('\n')

  for (const file of files) {
    if (!file.patch) {
      continue
    }

    const section = `\n\ndiff --git a/${file.filename} b/${file.filename}\n${file.patch}`

    if (estimateTokens(context + section) > maxDiffTokens) {
      break
    }

    context += section
  }

  return context
}
