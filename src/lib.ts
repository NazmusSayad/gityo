import { prepareCommit, writeCommitMessage } from './controllers/commit.js'
import { DEFAULT_MAX_DIFF_TOKENS } from './lib/diff.js'
import {
  findPullRequest,
  getDefaultBranch,
  mergePullRequest,
  type CompareResult,
} from './lib/gh.js'
import { getCommitDiff } from './lib/git.js'
import {
  buildPullRequestSystemPrompt,
  generatePullRequest,
} from './lib/llm/pr.js'
import { loadConfig } from './lib/load-config.js'
import {
  buildCompareContext,
  fetchPullRequestCompare,
  loadPullRequestContext,
  parsePullRequestContent,
  resolvePrBranches,
  submitPullRequest,
} from './lib/pr.js'
import {
  bumpVersionTag,
  getPreviousTag,
  publishRelease,
  resolveReleaseModel,
  verifyReleaseCommits,
  writeReleaseNotes,
} from './lib/release/flow.js'
import {
  getBranchHeadSha,
  listReleaseCommits,
  listReleases,
  releaseExists,
  type ReleaseCommit,
} from './lib/release/gh.js'
import { getRepoRoot } from './lib/release/git.js'

export type CommitScope = 'everything' | 'staged-only' | 'staged-or-changes'

export type CommitSession = {
  root: string
  scope: 'staged' | 'all'
  files: string[]
  postCommand: 'push' | 'push-and-pull' | null
  generateMessage: () => Promise<string>
  commit: (message: string) => Promise<void>
}

export async function createCommitSession(options: {
  cwd: string
  scope?: CommitScope
  model?: string
  style?: string
}): Promise<CommitSession> {
  const prepared = await prepareCommit({
    cwd: options.cwd,
    scope: options.scope ?? 'staged-or-changes',
    model: options.model,
    style: options.style,
  })
  let diff: string | null = null

  return {
    root: prepared.root,
    scope: prepared.diffScope,
    files: prepared.files,
    postCommand: prepared.config.postCommand,

    async generateMessage() {
      if (prepared.files.length === 0) {
        throw new Error('No changed files found.')
      }

      diff ??= await getCommitDiff(prepared.git, prepared.diffScope)

      return writeCommitMessage(prepared, diff)
    },

    async commit(message: string) {
      if (message.trim().length === 0) {
        throw new Error('Commit message cannot be empty.')
      }

      if (prepared.diffScope === 'all') {
        await prepared.git.add(['-A'])
      }

      await prepared.git.commit(message.trim())
    },
  }
}

export type MergeMethod = 'merge' | 'rebase' | 'squash'

export type PullRequestInfo = {
  number: number
  url: string
  base: string
  head: string
  commitCount: number
}

export type PullRequestSession = {
  base: string
  head: string
  existing: PullRequestInfo | null
  mergeMethod: MergeMethod
  generate: () => Promise<{ title: string; body: string }>
  create: (content: { title: string; body: string }) => Promise<PullRequestInfo>
  merge: () => Promise<void>
}

export async function createPullRequestSession(options: {
  cwd: string
  base?: string
  head?: string
  model?: string
  titleStyle?: string
  bodyStyle?: string
}): Promise<PullRequestSession> {
  const context = await loadPullRequestContext(options.cwd, {
    modelKey: options.model,
    titleStyle: options.titleStyle,
    bodyStyle: options.bodyStyle,
  })
  const systemPrompt = buildPullRequestSystemPrompt(context)
  const branches = await resolvePrBranches(
    options.cwd,
    options.base,
    options.head
  )
  const existing = await findPullRequest(
    options.cwd,
    branches.base,
    branches.head
  )
  let pullRequest = existing === null ? null : toPullRequestInfo(existing)
  let compare: CompareResult | null = null

  return {
    base: branches.base,
    head: branches.head,
    existing: pullRequest,
    mergeMethod: context.config.prMergeMethod,

    async generate() {
      compare ??= await fetchPullRequestCompare(
        options.cwd,
        branches.base,
        branches.head
      )
      const draft = await generatePullRequest({
        languageModel: context.languageModel,
        systemPrompt,
        context: buildCompareContext(
          compare,
          context.config.maxDiffTokens ?? DEFAULT_MAX_DIFF_TOKENS
        ),
      })
      return parsePullRequestContent(draft)
    },

    async create(content) {
      if (pullRequest !== null) {
        throw new Error(`Pull request #${pullRequest.number} is already open.`)
      }

      compare ??= await fetchPullRequestCompare(
        options.cwd,
        branches.base,
        branches.head
      )
      pullRequest = toPullRequestInfo(
        await submitPullRequest(
          options.cwd,
          content,
          branches,
          compare.commits.length
        )
      )
      return pullRequest
    },

    async merge() {
      if (pullRequest === null) {
        throw new Error('There is no pull request to merge.')
      }

      await mergePullRequest(
        options.cwd,
        pullRequest.number,
        context.config.prMergeMethod,
        'capture'
      )
    },
  }
}

function toPullRequestInfo(pullRequest: {
  number: number
  url: string
  baseRefName: string
  headRefName: string
  commitCount: number
}): PullRequestInfo {
  return {
    number: pullRequest.number,
    url: pullRequest.url,
    base: pullRequest.baseRefName,
    head: pullRequest.headRefName,
    commitCount: pullRequest.commitCount,
  }
}

export type ReleaseDraft = {
  tag: string
  exists: boolean
  previousTag: string | null
  generateNotes: () => Promise<string>
  create: (notes: string, options: { replace: boolean }) => Promise<void>
}

export type ReleaseSession = {
  branch: string
  releases: { tag: string; publishedAt: string }[]
  bumpTag: (bump: 'major' | 'minor' | 'patch') => string
  prepare: (tag: string) => Promise<ReleaseDraft>
}

export async function createReleaseSession(options: {
  cwd: string
  model?: string
}): Promise<ReleaseSession> {
  const config = await loadConfig(await getRepoRoot(options.cwd))
  const releases = await listReleases(options.cwd, 100)
  const branch = await getDefaultBranch(options.cwd)
  if (branch.length === 0) {
    throw new Error('Could not determine the default branch.')
  }

  return {
    branch,
    releases: releases.map((release) => ({
      tag: release.tagName,
      publishedAt: release.publishedAt,
    })),

    bumpTag(bump) {
      return bumpVersionTag(
        releases.slice(0, 3).map((release) => release.tagName),
        bump
      )
    },

    async prepare(tagInput) {
      const tag = tagInput.trim()
      if (tag.length === 0) {
        throw new Error('Release tag cannot be empty.')
      }
      if (tag.startsWith('-')) {
        throw new Error(`Release tag '${tag}' cannot start with '-'.`)
      }

      const exists = await releaseExists(options.cwd, tag)
      const headSha = await getBranchHeadSha(options.cwd, branch)
      const previousTag = getPreviousTag(releases, tag)
      let commits: ReleaseCommit[] | null = null

      return {
        tag,
        exists,
        previousTag,

        async generateNotes() {
          if (commits === null) {
            const loaded = await listReleaseCommits(
              options.cwd,
              previousTag,
              headSha
            )
            await verifyReleaseCommits(
              options.cwd,
              branch,
              previousTag,
              headSha,
              loaded
            )
            commits = loaded
          }

          const notes = await writeReleaseNotes(
            options.cwd,
            resolveReleaseModel(config, options.model),
            config,
            commits
          )
          if (notes.length === 0) {
            throw new Error('The selected model returned empty release notes.')
          }
          return notes
        },

        async create(notes, createOptions) {
          if (exists && !createOptions.replace) {
            throw new Error(`Release ${tag} already exists.`)
          }
          if (!exists && createOptions.replace) {
            throw new Error(`Release ${tag} does not exist to replace.`)
          }

          await publishRelease(
            options.cwd,
            { tag, target: headSha, notes },
            exists,
            'capture'
          )
        },
      }
    },
  }
}
