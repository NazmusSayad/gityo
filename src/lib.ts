import { generateMessage, prepareCommit } from './controllers/commit.js'
import { bumpVersionTag } from './controllers/release.js'
import { DEFAULT_MAX_DIFF_TOKENS, DEFAULT_PER_FILE_CAP } from './lib/diff.js'
import {
  createPullRequest as createPullRequestApi,
  fetchCompare,
  findPullRequest,
  getDefaultBranch,
  mergePullRequest,
  type CompareResult,
} from './lib/gh.js'
import { getCommitDiff } from './lib/git.js'
import { resolveLanguageModel, resolveModelConfig } from './lib/llm/model.js'
import {
  buildPullRequestSystemPrompt,
  generatePullRequest,
} from './lib/llm/pr.js'
import { loadConfig } from './lib/load-config.js'
import {
  buildCompareContext,
  loadPullRequestContext,
  parsePullRequestContent,
  resolveCreatedPullRequest,
  resolvePrBranches,
} from './lib/pr.js'
import {
  createRelease,
  deleteRelease,
  getBranchHeadSha,
  listReleaseCommits,
  listReleases,
  releaseExists,
  type ReleaseCommit,
} from './lib/release/gh.js'
import {
  assertLocalCommitsMatch,
  fetchBranchAndTags,
  getRepoRoot,
} from './lib/release/git.js'
import {
  EMPTY_RELEASE_NOTES,
  generateReleaseNotes,
} from './lib/release/notes.js'

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

      const message = await generateMessage({
        git: prepared.git,
        scope: prepared.diffScope,
        languageModel: prepared.languageModel,
        style: prepared.style,
        instructions: prepared.instructions,
        diff,
        files: prepared.files,
        perFileCap: prepared.config.perFileCap ?? DEFAULT_PER_FILE_CAP,
        maxDiffTokens: prepared.config.maxDiffTokens ?? DEFAULT_MAX_DIFF_TOKENS,
      })

      if (message.trim().length === 0) {
        throw new Error('The selected model returned an empty commit message.')
      }

      return message.trim()
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
  merge: (number: number, method: MergeMethod) => Promise<void>
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
  let compare: CompareResult | null = null

  async function loadCompare() {
    compare ??= await fetchCompare(options.cwd, branches.base, branches.head)
    if (compare.commits.length === 0) {
      throw new Error(
        `No commits found between '${branches.base}' and '${branches.head}'.`
      )
    }
    return compare
  }

  return {
    base: branches.base,
    head: branches.head,
    existing: existing === null ? null : toPullRequestInfo(existing),
    mergeMethod: context.config.prMergeMethod,

    async generate() {
      const draft = await generatePullRequest({
        languageModel: context.languageModel,
        systemPrompt,
        context: buildCompareContext(
          await loadCompare(),
          context.config.maxDiffTokens ?? DEFAULT_MAX_DIFF_TOKENS
        ),
      })
      const content = parsePullRequestContent(draft)
      if (content.title.length === 0) {
        throw new Error(
          'The selected model returned an empty pull request title.'
        )
      }
      return content
    },

    async create(content) {
      const commitCount = (await loadCompare()).commits.length
      const output = await createPullRequestApi(options.cwd, {
        title: content.title,
        body: content.body,
        base: branches.base,
        head: branches.head,
      })
      return toPullRequestInfo(
        await resolveCreatedPullRequest(
          output,
          { cwd: options.cwd, base: branches.base, head: branches.head },
          commitCount
        )
      )
    },

    async merge(number, method) {
      await mergePullRequest(options.cwd, number, method, 'capture')
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
  create: (notes: string) => Promise<void>
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

      const exists = await releaseExists(options.cwd, tag)
      const headSha = await getBranchHeadSha(options.cwd, branch)
      const tagIndex = releases.findIndex((release) => release.tagName === tag)
      const previousTag =
        (tagIndex === -1 ? releases[0] : releases[tagIndex + 1])?.tagName ??
        null
      let commits: ReleaseCommit[] | null = null

      return {
        tag,
        exists,
        previousTag,

        async generateNotes() {
          if (commits === null) {
            commits = await listReleaseCommits(
              options.cwd,
              previousTag,
              headSha
            )
            await fetchBranchAndTags(options.cwd, branch)
            await assertLocalCommitsMatch(
              options.cwd,
              previousTag,
              headSha,
              commits.map((commit) => commit.hash)
            )
          }

          if (commits.length === 0) return EMPTY_RELEASE_NOTES

          const languageModel = resolveLanguageModel(
            resolveModelConfig(
              config.models,
              options.model ?? config.releaseModel ?? config.model
            )
          )
          const notes = await generateReleaseNotes(
            options.cwd,
            languageModel,
            commits,
            {
              maxTokens: config.maxDiffTokens ?? DEFAULT_MAX_DIFF_TOKENS,
              perFileCap: config.perFileCap ?? DEFAULT_PER_FILE_CAP,
            }
          )
          if (notes.length === 0) {
            throw new Error('The selected model returned empty release notes.')
          }
          return notes
        },

        async create(notes) {
          if (exists) {
            await deleteRelease(options.cwd, tag, 'capture')
          }
          await createRelease(
            options.cwd,
            { tag, target: headSha, notes },
            'capture'
          )
        },
      }
    },
  }
}
