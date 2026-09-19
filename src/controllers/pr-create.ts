import { findPullRequest, openPullRequest } from '../lib/gh'
import {
  createPullRequest,
  loadPullRequestContext,
  resolvePrBranches,
} from '../lib/pr'

export type PrCreateControllerOptions = {
  model?: string
  yolo?: boolean
  web?: boolean
}

export async function createPullRequestController(
  baseArg: string | undefined,
  headArg: string | undefined,
  options: PrCreateControllerOptions = {}
) {
  const { base, head } = await resolvePrBranches(baseArg, headArg)
  const { config, languageModel, instructions } = await loadPullRequestContext(
    options.model
  )

  const pullRequest = await createPullRequest({
    base,
    head,
    languageModel,
    instructions,
    maxDiffTokens: config.maxDiffTokens,
    autoAccept: options.yolo ?? false,
  }).catch(async (error: unknown) => {
    if (!options.web) {
      throw error
    }

    const existing = await findPullRequest(base, head)

    if (!existing) {
      throw error
    }

    return existing
  })

  if (options.web) {
    await openPullRequest(pullRequest.number)
  }
}
