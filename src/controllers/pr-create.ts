import { findPullRequest, openPullRequest } from '../lib/gh'
import { buildPullRequestSystemPrompt } from '../lib/llm/pr'
import {
  createPullRequest,
  loadPullRequestContext,
  resolvePrBranches,
} from '../lib/pr'
import { handleUncommittedChanges } from './local-changes'

type PrCreateControllerOptions = {
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

  const pullRequest = await createPullRequest({
    base: branches.base,
    head: branches.head,
    systemPrompt,
    languageModel: context.languageModel,
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
