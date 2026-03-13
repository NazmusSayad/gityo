import type { OpenAICompatibleProviderOptions } from '@ai-sdk/openai-compatible'
import { generateText } from 'ai'
import type { ResolvedConfig } from '../../schema'
import { getStagedDiff } from '../git'
import { resolveAiProvider } from './resolve-provider'

import promptTxt from './test.txt?raw'
console.log(promptTxt)

export async function generateCommitMessage(
  cwd: string,
  config: ResolvedConfig,
  model: {
    provider: string
    name: string
    key: string

    reasoning?: boolean | string
  }
) {
  const stagedDiff = await getStagedDiff(cwd)
  const sections = [
    'Write a concise git commit message for the staged changes.',
    'Focus on why the changes were made, not a file-by-file summary.',
    'Return only the commit message text with no quotes or code fences.',
  ]

  if (config.customInstructions) {
    sections.push(`Project instructions:\n${config.customInstructions}`)
  }

  sections.push(`Staged diff:\n${stagedDiff}`)
  const prompt = sections.join('\n\n')

  const provider = resolveAiProvider(model.provider, model.key)
  if (!provider) {
    throw new Error(
      `Unsupported model provider '${provider}'. Use openai, anthropic, google, openrouter, or an https base URL.`
    )
  }

  const result = await generateText({
    model: provider(model.name),

    prompt,

    providerOptions: {
      openai: {
        reasoningEffort:
          model.reasoning === true ? 'medium' : model.reasoning || undefined,
      } satisfies OpenAICompatibleProviderOptions,
    },
  })

  return {
    text: result.text.trim(),
  }
}
