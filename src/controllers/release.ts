import { confirm, input } from '@inquirer/prompts'
import chalk from 'chalk'
import { createRenderer } from 'markdansi'
import prettyMs from 'pretty-ms'
import { getDefaultBranch } from '../lib/gh.js'
import { resolveLanguageModel, resolveModelConfig } from '../lib/llm/model.js'
import { loadConfig } from '../lib/load-config.js'
import { acceptGenerated, selectionTheme } from '../lib/prompts.js'
import {
  bumpVersionTag,
  getPreviousTag,
  publishRelease,
  verifyReleaseCommits,
  writeReleaseNotes,
} from '../lib/release/flow.js'
import {
  getBranchHeadSha,
  listReleaseCommits,
  listReleases,
  releaseExists,
} from '../lib/release/gh.js'
import { getRepoRoot } from '../lib/release/git.js'
import { runWithLoading } from '../lib/run-with-loading.js'

const renderReleaseNotes = createRenderer(
  process.stdout.columns
    ? { width: Math.max(0, process.stdout.columns - 4), listIndent: 2 }
    : { wrap: false, listIndent: 2 }
)

type ReleaseControllerOptions = {
  model?: string
  yolo?: boolean
  force?: boolean
  empty?: boolean
  bump?: 'major' | 'minor' | 'patch'
}

export async function releaseController(
  tagArg: string | undefined,
  options: ReleaseControllerOptions = {}
) {
  if (options.bump && tagArg !== undefined) {
    throw new Error(`Use either a release tag or --${options.bump}, not both.`)
  }

  if (options.yolo && tagArg === undefined && !options.bump) {
    throw new Error(
      'A release tag or --major, --minor, or --patch is required with --yolo.'
    )
  }

  const cwd = process.cwd()
  const repoRoot = await getRepoRoot(cwd)
  const config = await loadConfig(repoRoot)
  const releases = await listReleases(cwd, 100)

  let tag = tagArg?.trim() ?? ''
  if (options.bump) {
    tag = bumpVersionTag(
      releases.slice(0, 3).map((release) => release.tagName),
      options.bump
    )

    console.log(
      `${chalk.blue.bold('Bumping')} ${chalk.cyan(releases[0]?.tagName)} to ${chalk.yellow.bold(tag)} ${chalk.dim(`using --${options.bump}`)}`
    )
  } else if (tagArg === undefined) {
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

  const exists = await releaseExists(cwd, tag)
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

  const branch = await getDefaultBranch(cwd)
  if (branch.length === 0) {
    throw new Error('Could not determine the default branch.')
  }

  if (options.empty) {
    const headSha = await getBranchHeadSha(cwd, branch)

    if (
      !options.yolo &&
      !(await confirm({
        message: `Create release ${chalk.yellow.bold(tag)} on ${chalk.yellow.bold(branch)} without notes?`,
        default: true,
        theme: selectionTheme,
      }))
    ) {
      console.log('Release creation cancelled.')
      return
    }

    await publishRelease(
      cwd,
      { tag, target: headSha, notes: '' },
      exists,
      'inherit'
    )
    return
  }

  const modelConfig = resolveModelConfig(
    config.models,
    options.model ?? config.releaseModel ?? config.model
  )
  const languageModel = resolveLanguageModel(modelConfig)
  const previousTag = getPreviousTag(releases, tag)

  const headSha = await getBranchHeadSha(cwd, branch)
  const commits = await runWithLoading('Loading commits from GitHub', () =>
    listReleaseCommits(cwd, previousTag, headSha)
  )

  await runWithLoading('Fetching commits', () =>
    verifyReleaseCommits(cwd, branch, previousTag, headSha, commits)
  )

  console.log(
    chalk.dim(
      `${commits.length} commit(s) since ${previousTag ?? 'the first commit'}`
    )
  )

  let notes = ''
  while (true) {
    notes = await runWithLoading(
      `Generating release notes (${modelConfig.key})`,
      () => writeReleaseNotes(cwd, languageModel, config, commits)
    )

    console.log(renderReleaseNotes(notes).trim())
    console.log('')

    if (
      options.yolo ||
      (await acceptGenerated(
        `Create release ${chalk.yellow.bold(tag)} on ${chalk.yellow.bold(branch)}`,
        'generate new release notes'
      ))
    ) {
      break
    }
  }

  if (notes.length === 0) {
    throw new Error('The selected model returned empty release notes.')
  }

  await publishRelease(cwd, { tag, target: headSha, notes }, exists, 'inherit')
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
