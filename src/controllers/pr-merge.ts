import chalk from 'chalk'
import { findPullRequest, mergePullRequest } from '../lib/gh'
import {
  createPullRequest,
  loadPullRequestContext,
  resolvePrBranches,
} from '../lib/pr'
import { confirmPullRequestMerge } from '../lib/prompts'

export type PrMergeControllerOptions = {
  model?: string
  yolo?: boolean
}

export async function mergePullRequestController(
  baseArg: string | undefined,
  headArg: string | undefined,
  options: PrMergeControllerOptions = {}
) {
  const { base, head } = await resolvePrBranches(baseArg, headArg)
  const { config, languageModel, instructions } = await loadPullRequestContext(
    options.model
  )

  let pullRequest = await findPullRequest(base, head)

  if (pullRequest) {
    console.log(pullRequest.url)
  } else {
    pullRequest = await createPullRequest({
      base,
      head,
      languageModel,
      instructions,
      maxDiffTokens: config.maxDiffTokens,
      autoAccept: options.yolo ?? false,
    })
  }

  if (!options.yolo) {
    const confirmed = await confirmPullRequestMerge(`${base} <- ${head}`)

    if (!confirmed) {
      console.log('Pull request merge cancelled.')
      return
    }
  }

  console.log(chalk.yellow(`✓ Merging pull request #${pullRequest.number}`))
  await mergePullRequest(pullRequest.number)
}
