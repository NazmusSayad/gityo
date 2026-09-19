import type { LanguageModel } from 'ai'
import chalk from 'chalk'
import { createRenderer } from 'markdansi'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { DEFAULT_MAX_DIFF_TOKENS, estimateTokens } from './diff'
import {
  createPullRequest as createPullRequestApi,
  fetchCompare,
  findPullRequest,
  getDefaultBranch,
  type CompareResult,
  type PullRequest,
} from './gh'
import { resolveLanguageModel, resolveModelConfig } from './llm/model'
import { generatePullRequest } from './llm/pr'
import { resolveInstructionContent } from './llm/style'
import { loadConfig } from './load-config'
import { acceptGeneratedPullRequest } from './prompts'
import { runWithLoading } from './run-with-loading'
import { exec } from './shell'

const PR_URL_PATTERN = /https:\/\/[^\s]+\/pull\/(\d+)/
const PR_RENDER_WIDTH = 80

const renderPullRequest = createRenderer({
  width: PR_RENDER_WIDTH,
  listIndent: 2,
})

const PR_TEMPLATE_PATHS = [
  '.github/pull_request_template.md',
  '.github/PULL_REQUEST_TEMPLATE.md',
  'pull_request_template.md',
  'PULL_REQUEST_TEMPLATE.md',
  'docs/pull_request_template.md',
  'docs/PULL_REQUEST_TEMPLATE.md',
]

export async function getCurrentBranch() {
  const output = await exec('git', ['branch', '--show-current'])

  return output.trim()
}

export async function getRepoRoot() {
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

export type CreatePullRequestOptions = {
  base: string
  head: string
  languageModel: LanguageModel
  titleInstructions: string | null
  bodyInstructions: string | null
  template: string | null
  maxDiffTokens?: number
  autoAccept?: boolean
}

type PullRequestContent = {
  title: string
  body: string
}

export async function loadPullRequestContext(modelKey?: string) {
  const repoRoot = await getRepoRoot()
  const config = await loadConfig(repoRoot)
  const modelConfig = resolveModelConfig(config.models, modelKey ?? 'default')
  const languageModel = resolveLanguageModel(modelConfig)
  const titleInstructions = config.prTitleInstructions
    ? await resolveInstructionContent(config.prTitleInstructions)
    : null
  const bodyInstructions = config.prBodyInstructions
    ? await resolveInstructionContent(config.prBodyInstructions)
    : null
  const template = await readPullRequestTemplate(repoRoot)

  return {
    config,
    languageModel,
    titleInstructions,
    bodyInstructions,
    template,
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
  let draft = await runWithLoading(
    'Generating pull request title and body',
    () =>
      generatePullRequest({
        languageModel: options.languageModel,
        titleInstructions: options.titleInstructions,
        bodyInstructions: options.bodyInstructions,
        template: options.template,
        context,
      })
  )

  while (true) {
    console.log(renderPullRequest(draft).trim())
    console.log('')

    if (options.autoAccept || (await acceptGeneratedPullRequest())) {
      break
    }

    draft = await runWithLoading('Generating pull request title and body', () =>
      generatePullRequest({
        languageModel: options.languageModel,
        titleInstructions: options.titleInstructions,
        bodyInstructions: options.bodyInstructions,
        template: options.template,
        context,
      })
    )
  }

  const content = parsePullRequestContent(draft)
  if (content.title.length === 0) {
    throw new Error('The selected model returned an empty pull request title.')
  }

  console.log(chalk.green('✓ Creating pull request'))
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

async function readPullRequestTemplate(repoRoot: string) {
  for (const relativePath of PR_TEMPLATE_PATHS) {
    const contents = await readFile(
      path.join(repoRoot, relativePath),
      'utf8'
    ).catch(() => null)

    if (contents && contents.trim().length > 0) {
      return contents.trim()
    }
  }

  return null
}
