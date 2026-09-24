import { confirm } from '@inquirer/prompts'
import chalk from 'chalk'
import {
  findPullRequest,
  mergePullRequest,
  type MergeMethod,
} from '../lib/gh.js'
import { buildPullRequestSystemPrompt } from '../lib/llm/pr.js'
import {
  createPullRequest,
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
}

export async function mergePullRequestController(
  baseArg: string | undefined,
  headArg: string | undefined,
  options: PrMergeControllerOptions = {}
) {
  const context = await loadPullRequestContext({
    modelKey: options.model,
    titleStyle: options.titleStyle,
    bodyStyle: options.bodyStyle,
  })

  const systemPrompt = buildPullRequestSystemPrompt(context)
  const branches = await resolvePrBranches(baseArg, headArg)

  await handleUncommittedChanges(branches.head, {
    yolo: options.yolo ?? false,
    scope: options.all ? 'everything' : 'staged-or-changes',
  })

  let pullRequest = await findPullRequest(branches.base, branches.head)

  if (pullRequest) {
    console.log(pullRequest.url)
  } else {
    pullRequest = await createPullRequest({
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
    pullRequest.number,
    options.mergeMethod ?? context.config.prMergeMethod
  )
}
