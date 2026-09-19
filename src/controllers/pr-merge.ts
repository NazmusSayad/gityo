import { confirm } from '@inquirer/prompts'
import chalk from 'chalk'
import { findPullRequest, mergePullRequest } from '../lib/gh'
import { buildPullRequestSystemPrompt } from '../lib/llm/pr'
import {
  createPullRequest,
  loadPullRequestContext,
  resolvePrBranches,
} from '../lib/pr'
import { selectionTheme } from '../lib/prompts'
import { handleUncommittedChanges } from './local-changes'

export type PrMergeControllerOptions = {
  model?: string
  titleStyle?: string
  bodyStyle?: string
  yolo?: boolean
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
      message: `${chalk.magenta('Merge PR')} ${chalk.cyan.bold(`#${pullRequest.number}`)}: ${chalk.red.bold(branches.base)} ${chalk.dim('<-')} ${chalk.yellow.bold(branches.head)}`,
      default: true,
      theme: selectionTheme,
    })

    if (!confirmed) {
      console.log('Pull request merge cancelled.')
      return
    }
  }

  await mergePullRequest(pullRequest.number)
}
