import type { OpenAICompatibleProviderOptions } from '@ai-sdk/openai-compatible'
import { generateText } from 'ai'
import { SUPPORTED_PROVIDERS, type ResolvedConfig } from '../../schema'
import { getStagedDiff } from '../git'
import { resolveAiProvider } from './resolve-provider'
import systemPrompt from './system-prompt.txt?raw'

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
  const provider = resolveAiProvider(model.provider, model.key)
  if (!provider) {
    throw new Error(
      `Unsupported model provider '${provider}'. Use ${SUPPORTED_PROVIDERS.join(', ')} or an https base URL.`
    )
  }

  const result = await generateText({
    model: provider(model.name),

    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: `Staged diff:\n${await getStagedDiff(cwd)}`,
      },
      {
        role: 'user',
        content:
          config.instructions ||
          'Generate a concise git commit message based on the above instructions and diff.',
      },
    ],

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
