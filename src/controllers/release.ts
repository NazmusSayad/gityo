import { confirm, input } from '@inquirer/prompts'
import chalk from 'chalk'
import { createRenderer } from 'markdansi'
import prettyMs from 'pretty-ms'
import { DEFAULT_MAX_DIFF_TOKENS, DEFAULT_PER_FILE_CAP } from '../lib/diff.js'
import { getDefaultBranch } from '../lib/gh.js'
import { resolveLanguageModel, resolveModelConfig } from '../lib/llm/model.js'
import { loadConfig } from '../lib/load-config.js'
import { acceptGenerated, selectionTheme } from '../lib/prompts.js'
import {
  createRelease,
  deleteRelease,
  getBranchHeadSha,
  listReleaseCommits,
  listReleases,
  releaseExists,
} from '../lib/release/gh.js'
import {
  assertLocalCommitsMatch,
  fetchBranchAndTags,
  getRepoRoot,
} from '../lib/release/git.js'
import {
  EMPTY_RELEASE_NOTES,
  generateReleaseNotes,
} from '../lib/release/notes.js'
import { runWithLoading } from '../lib/run-with-loading.js'

const renderReleaseNotes = createRenderer({ width: 80, listIndent: 2 })

type ReleaseControllerOptions = {
  model?: string
  yolo?: boolean
  force?: boolean
}

export async function releaseController(
  tagArg: string | undefined,
  options: ReleaseControllerOptions = {}
) {
  if (options.yolo && tagArg === undefined) {
    throw new Error('A release tag is required with --yolo.')
  }

  const repoRoot = await getRepoRoot()
  const config = await loadConfig(repoRoot)
  const languageModel = resolveLanguageModel(
    resolveModelConfig(
      config.models,
      options.model ?? config.releaseModel ?? config.model
    )
  )

  const releases = await listReleases(100)

  let tag = tagArg?.trim() ?? ''
  if (tagArg === undefined) {
    printRecentReleases(releases.slice(0, 5).reverse())

    tag = (
      await input({
        message: 'Release tag',
        theme: selectionTheme,
        validate: (value) =>
          value.trim().length > 0 || 'Release tag cannot be empty.',
      })
    ).trim()
  }

  if (tag.length === 0) {
    throw new Error('Release tag cannot be empty.')
  }

  const exists = await releaseExists(tag)
  if (exists && !options.force) {
    const recreate = await confirm({
      message: chalk.yellow(`Release ${tag} already exists. Recreate it?`),
      default: false,
      theme: selectionTheme,
    })

    if (!recreate) {
      console.log('Release creation cancelled.')
      return
    }
  }

  const branch = await getDefaultBranch()
  if (branch.length === 0) {
    throw new Error('Could not determine the default branch.')
  }

  const tagIndex = releases.findIndex((release) => release.tagName === tag)
  const previousTag =
    (tagIndex === -1 ? releases[0] : releases[tagIndex + 1])?.tagName ?? null

  const headSha = await getBranchHeadSha(branch)
  const commits = await runWithLoading('Loading commits from GitHub', () =>
    listReleaseCommits(previousTag, headSha)
  )

  await runWithLoading('Fetching commits', () => fetchBranchAndTags(branch))
  await assertLocalCommitsMatch(
    previousTag,
    headSha,
    commits.map((commit) => commit.hash)
  )

  console.log(
    chalk.dim(
      `${commits.length} commit(s) since ${previousTag ?? 'the first commit'}`
    )
  )

  let notes = ''
  while (true) {
    notes =
      commits.length === 0
        ? EMPTY_RELEASE_NOTES
        : await runWithLoading('Generating release notes', () =>
            generateReleaseNotes(languageModel, commits, {
              maxTokens: config.maxDiffTokens ?? DEFAULT_MAX_DIFF_TOKENS,
              perFileCap: config.perFileCap ?? DEFAULT_PER_FILE_CAP,
            })
          )

    console.log(renderReleaseNotes(notes).trim())
    console.log('')

    if (
      options.yolo ||
      (await acceptGenerated(
        `Create release ${chalk.cyan.bold(tag)} on ${chalk.yellow.bold(branch)}`,
        'generate new release notes'
      ))
    ) {
      break
    }
  }

  if (notes.length === 0) {
    throw new Error('The selected model returned empty release notes.')
  }

  if (exists) {
    await deleteRelease(tag)
  }

  await createRelease({ tag, target: headSha, notes })
}

function printRecentReleases(
  releases: { tagName: string; publishedAt: string }[]
) {
  if (releases.length === 0) {
    return
  }

  const longestTag = Math.max(
    ...releases.map((release) => release.tagName.length)
  )

  console.log(chalk.blue.bold('Recent:'))
  for (const release of releases) {
    const age = prettyMs(Date.now() - Date.parse(release.publishedAt), {
      verbose: true,
      unitCount: 1,
    })
    console.log(
      chalk.cyan(release.tagName.padEnd(longestTag)),
      chalk.dim(`${age} ago`)
    )
  }
  console.log('')
}
