import type { LanguageModel } from 'ai'
import chalk from 'chalk'
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
import { generatePullRequest, type PullRequestDraft } from './llm/pr'
import { resolveInstructionContent } from './llm/style'
import { loadConfig } from './load-config'
import { acceptGeneratedPullRequest } from './prompts'
import { runWithLoading } from './run-with-loading'
import { exec } from './shell'

const PR_URL_PATTERN = /https:\/\/[^\s]+\/pull\/(\d+)/

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
  instructions: string | null
  maxDiffTokens?: number
  autoAccept?: boolean
}

export async function loadPullRequestContext(modelKey?: string) {
  const repoRoot = await getRepoRoot()
  const config = await loadConfig(repoRoot)
  const modelConfig = resolveModelConfig(config.models, modelKey ?? 'default')
  const languageModel = resolveLanguageModel(modelConfig)
  const instructions = config.instructions
    ? await resolveInstructionContent(config.instructions)
    : null

  return { config, languageModel, instructions }
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
  let draft = await generateDraft(options, context)

  while (true) {
    printDraft(draft)

    if (options.autoAccept || (await acceptGeneratedPullRequest())) {
      break
    }

    draft = await generateDraft(options, context)
  }

  if (draft.title.length === 0) {
    throw new Error('The selected model returned an empty pull request title.')
  }

  console.log(chalk.green('✓ Creating pull request'))
  const output = await createPullRequestApi({
    title: draft.title,
    body: draft.body,
    base: options.base,
    head: options.head,
  })

  const pullRequest = await resolveCreatedPullRequest(output, options)
  console.log(pullRequest.url)

  return pullRequest
}

function generateDraft(
  options: CreatePullRequestOptions,
  context: string
): Promise<PullRequestDraft> {
  return runWithLoading('Generating pull request title and body', () =>
    generatePullRequest(options.languageModel, options.instructions, context)
  )
}

function printDraft(draft: PullRequestDraft) {
  console.log(chalk.cyan.bold(draft.title))

  if (draft.body.length > 0) {
    console.log('')
    console.log(chalk.cyan.dim(draft.body))
  }

  console.log('')
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
      formatCommitMessage(entry.commit.message)
    ),
    '',
    'Changed files:',
    ...files.map(
      (file) =>
        `- ${file.filename} (${file.status} +${file.additions} -${file.deletions})`
    ),
  ]

  let context = lines.join('\n')

  for (const file of files) {
    if (!file.patch) {
      continue
    }

    const section = `\ndiff --git a/${file.filename} b/${file.filename}\n${file.patch}`

    if (estimateTokens(context + section) > maxDiffTokens) {
      break
    }

    context += section
  }

  return context
}

function formatCommitMessage(message: string) {
  return message
    .trim()
    .split('\n')
    .map((line, index) => (index === 0 ? `- ${line}` : `  ${line}`))
    .join('\n')
}
