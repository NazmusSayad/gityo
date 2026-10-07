import type { LanguageModel } from 'ai'
import { DEFAULT_MAX_DIFF_TOKENS, DEFAULT_PER_FILE_CAP } from '../diff.js'
import { resolveLanguageModel, resolveModelConfig } from '../llm/model.js'
import type { loadConfig } from '../load-config.js'
import { createRelease, deleteRelease, type ReleaseCommit } from './gh.js'
import { assertLocalCommitsMatch, fetchBranchAndTags } from './git.js'
import { EMPTY_RELEASE_NOTES, generateReleaseNotes } from './notes.js'

type Config = Awaited<ReturnType<typeof loadConfig>>

export function bumpVersionTag(
  recentTags: string[],
  bump: 'major' | 'minor' | 'patch'
) {
  const versionPattern = /^(v?)(\d+)\.(\d+)\.(\d+)$/
  const invalidTags = recentTags.filter((tag) => !versionPattern.test(tag))
  if (invalidTags.length > 0) {
    throw new Error(
      `Recent release tags must be MAJOR.MINOR.PATCH versions to use --${bump}: ${invalidTags.join(', ')}`
    )
  }

  const match = versionPattern.exec(recentTags[0] ?? '')
  if (!match) {
    throw new Error(`No previous release found to apply --${bump} to.`)
  }

  const prefix = match[1]
  const major = Number(match[2])
  const minor = Number(match[3])
  const patch = Number(match[4])
  if (bump === 'major') return `${prefix}${major + 1}.0.0`
  if (bump === 'minor') return `${prefix}${major}.${minor + 1}.0`
  if (bump === 'patch') return `${prefix}${major}.${minor}.${patch + 1}`
  throw new Error(`Unknown version bump '${bump}'.`)
}

export function getPreviousTag(releases: { tagName: string }[], tag: string) {
  const tagIndex = releases.findIndex((release) => release.tagName === tag)

  return (
    (tagIndex === -1 ? releases[0] : releases[tagIndex + 1])?.tagName ?? null
  )
}

export function resolveReleaseModel(config: Config, modelKey?: string) {
  return resolveLanguageModel(
    resolveModelConfig(
      config.models,
      modelKey ?? config.releaseModel ?? config.model
    )
  )
}

export async function verifyReleaseCommits(
  cwd: string,
  branch: string,
  previousTag: string | null,
  headSha: string,
  commits: ReleaseCommit[]
) {
  await fetchBranchAndTags(cwd, branch)
  await assertLocalCommitsMatch(
    cwd,
    previousTag,
    headSha,
    commits.map((commit) => commit.hash)
  )
}

export async function writeReleaseNotes(
  cwd: string,
  languageModel: LanguageModel,
  config: Config,
  commits: ReleaseCommit[]
) {
  if (commits.length === 0) {
    return EMPTY_RELEASE_NOTES
  }

  return generateReleaseNotes(cwd, languageModel, commits, {
    maxTokens: config.maxDiffTokens ?? DEFAULT_MAX_DIFF_TOKENS,
    perFileCap: config.perFileCap ?? DEFAULT_PER_FILE_CAP,
  })
}

export async function publishRelease(
  cwd: string,
  input: { tag: string; target: string; notes: string },
  replace: boolean,
  output: 'inherit' | 'capture'
) {
  if (replace) {
    await deleteRelease(cwd, input.tag, output)
  }

  await createRelease(cwd, input, output)
}
