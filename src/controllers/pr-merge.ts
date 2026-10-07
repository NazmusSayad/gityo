import { confirm } from '@inquirer/prompts'
import chalk from 'chalk'
import {
  fetchCompare,
  findPullRequest,
  mergePullRequest,
  openPullRequest,
  type MergeMethod,
} from '../lib/gh.js'
import { buildPullRequestSystemPrompt } from '../lib/llm/pr.js'
import {
  createPullRequest,
  formatCompareSummary,
  loadPullRequestContext,
  resolvePrBranches,
} from '../lib/pr.js'
import { mergeTheme } from '../lib/prompts.js'
import { handleUncommittedChanges } from './local-changes.js'

type PrMergeControllerOptions = {
  mergeMethod?: MergeMethod
  model?: string
  titleStyle?: string
  bodyStyle?: string
  yolo?: boolean
  all?: boolean
  web?: boolean
}

export async function mergePullRequestController(
  baseArg: string | undefined,
  headArg: string | undefined,
  options: PrMergeControllerOptions = {}
) {
  const cwd = process.cwd()
  const context = await loadPullRequestContext(cwd, {
    modelKey: options.model,
    titleStyle: options.titleStyle,
    bodyStyle: options.bodyStyle,
  })

  const systemPrompt = buildPullRequestSystemPrompt(context)
  const branches = await resolvePrBranches(cwd, baseArg, headArg)

  await handleUncommittedChanges(branches.head, {
    yolo: options.yolo ?? false,
    scope: options.all ? 'everything' : 'staged-or-changes',
  })

  let pullRequest = await findPullRequest(cwd, branches.base, branches.head)

  if (pullRequest) {
    console.log(
      formatCompareSummary(
        await fetchCompare(cwd, branches.base, branches.head)
      )
    )
    console.log(pullRequest.url)
  } else {
    pullRequest = await createPullRequest({
      cwd,
      base: branches.base,
      head: branches.head,
      systemPrompt,
      languageModel: context.languageModel,
      maxDiffTokens: context.config.maxDiffTokens,
      autoAccept: options.yolo ?? false,
    })
  }

  console.log('')

  if (options.yolo) {
    console.log(chalk.yellow(`✓ Merging pull request #${pullRequest.number}`))
  } else {
    const confirmed = await confirm({
      message: `Merge PR #${pullRequest.number}: ${chalk.red.bold(branches.base)} ${chalk.reset('←')} ${chalk.yellow.bold(branches.head)}`,
      default: true,
      theme: mergeTheme,
    })

    if (!confirmed) {
      console.log('Pull request merge cancelled.')
      return
    }
  }

  await mergePullRequest(
    cwd,
    pullRequest.number,
    options.mergeMethod ?? context.config.prMergeMethod,
    'inherit'
  )

  if (options.web) {
    await openPullRequest(cwd, pullRequest.number)
  }
}
