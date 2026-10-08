import { findPullRequest, openPullRequest } from '../lib/gh.js'
import { buildPullRequestSystemPrompt } from '../lib/llm/pr.js'
import {
  createPullRequest,
  loadPullRequestContext,
  resolvePrBranches,
} from '../lib/pr.js'
import { handleUncommittedChanges } from './local-changes.js'

type PrCreateControllerOptions = {
  model?: string
  titleStyle?: string
  bodyStyle?: string
  yolo?: boolean
  all?: boolean
  web?: boolean
  update?: boolean
}

export async function createPullRequestController(
  baseArg: string | undefined,
  headArg: string | undefined,
  options: PrCreateControllerOptions = {}
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

  const existing = options.update
    ? await findPullRequest(cwd, branches.base, branches.head)
    : null

  const pullRequest = await createPullRequest({
    cwd,
    base: branches.base,
    head: branches.head,
    systemPrompt,
    languageModel: context.languageModel,
    modelKey: context.modelKey,
    maxDiffTokens: context.config.maxDiffTokens,
    autoAccept: options.yolo ?? false,
    existing,
  }).catch(async (error: unknown) => {
    if (!options.web) {
      throw error
    }

    const existing = await findPullRequest(cwd, branches.base, branches.head)

    if (!existing) {
      throw error
    }

    return existing
  })

  if (options.web) {
    await openPullRequest(cwd, pullRequest.number)
  }
}
