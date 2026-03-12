import {
  promptForCommitMessageInput,
  promptForGeneratedCommitAction,
} from './prompts'
import type { ModelOption } from './types'

interface ResolveCommitMessageOptions {
  autoAcceptCommitMessage: boolean
  customInstructions?: string
  defaultModel?: ModelOption
  modelOptions: ModelOption[]
  stagedDiff: string
  generateCommitMessage: (options: {
    model: ModelOption
    prompt: string
  }) => Promise<string>
}

export async function resolveCommitMessage({
  autoAcceptCommitMessage,
  customInstructions,
  defaultModel,
  modelOptions,
  stagedDiff,
  generateCommitMessage,
}: ResolveCommitMessageOptions) {
  const entry = await promptForCommitMessageInput(modelOptions, defaultModel)

  if (entry.message.length > 0) {
    return entry.message
  }

  const activeModel = entry.activeModel ?? defaultModel ?? modelOptions[0]

  if (!activeModel) {
    throw new Error('No models are configured for commit message generation.')
  }

  const prompt = buildCommitMessagePrompt(stagedDiff, customInstructions)

  while (true) {
    const generatedMessage = normalizeCommitMessage(
      await generateCommitMessage({
        model: activeModel,
        prompt,
      })
    )

    if (autoAcceptCommitMessage) {
      return generatedMessage
    }

    const action = await promptForGeneratedCommitAction(generatedMessage)

    if (action === 'accept') {
      return generatedMessage
    }

    if (action === 'cancel') {
      return undefined
    }
  }
}

export function buildCommitMessagePrompt(
  stagedDiff: string,
  customInstructions?: string
) {
  const sections = [
    'Write a concise git commit message for the staged changes.',
    'Focus on why the changes were made, not a file-by-file summary.',
    'Return only the commit message text with no quotes or code fences.',
  ]

  if (customInstructions) {
    sections.push(`Project instructions:\n${customInstructions}`)
  }

  sections.push(`Staged diff:\n${stagedDiff}`)

  return sections.join('\n\n')
}

function normalizeCommitMessage(message: string) {
  const normalized = message.trim()

  if (normalized.length === 0) {
    throw new Error('The selected model returned an empty commit message.')
  }

  return normalized
}
