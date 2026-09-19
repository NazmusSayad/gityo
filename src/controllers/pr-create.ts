import { findPullRequest, openPullRequest } from '../lib/gh'
import {
  createPullRequest,
  loadPullRequestContext,
  resolvePrBranches,
} from '../lib/pr'

export type PrCreateControllerOptions = {
  model?: string
  titleStyle?: string
  bodyStyle?: string
  yolo?: boolean
  web?: boolean
}

export async function createPullRequestController(
  baseArg: string | undefined,
  headArg: string | undefined,
  options: PrCreateControllerOptions = {}
) {
  const branches = await resolvePrBranches(baseArg, headArg)
  const context = await loadPullRequestContext({
    modelKey: options.model,
    titleStyle: options.titleStyle,
    bodyStyle: options.bodyStyle,
  })

  const pullRequest = await createPullRequest({
    base: branches.base,
    head: branches.head,
    languageModel: context.languageModel,
    titleInstructions: context.titleInstructions,
    bodyInstructions: context.bodyInstructions,
    template: context.template,
    maxDiffTokens: context.config.maxDiffTokens,
    autoAccept: options.yolo ?? false,
  }).catch(async (error: unknown) => {
    if (!options.web) {
      throw error
    }

    const existing = await findPullRequest(branches.base, branches.head)

    if (!existing) {
      throw error
    }

    return existing
  })

  if (options.web) {
    await openPullRequest(pullRequest.number)
  }
}
