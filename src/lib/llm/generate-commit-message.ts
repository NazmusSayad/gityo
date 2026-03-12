import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { generateText } from 'ai'
import { z } from 'zod'
import { resolvedConfigSchema } from '../../schema'
import { getStagedDiff } from '../git'
import { promptForApiKey } from '../prompts'
import { getStoredApiKey, setStoredApiKey } from '../secrets'

export type SelectedModel = {
  provider: string
  name: string
  reasoning?: boolean | string
}

export async function generateCommitMessage(options: {
  cwd: string
  config: z.infer<typeof resolvedConfigSchema>
  selectedModel: SelectedModel
}) {
  const stagedDiff = await getStagedDiff(options.cwd)
  const sections = [
    'Write a concise git commit message for the staged changes.',
    'Focus on why the changes were made, not a file-by-file summary.',
    'Return only the commit message text with no quotes or code fences.',
  ]

  if (options.config.customInstructions) {
    sections.push(`Project instructions:\n${options.config.customInstructions}`)
  }

  sections.push(`Staged diff:\n${stagedDiff}`)

  let apiKey = await getStoredApiKey(options.selectedModel.provider)

  if (!apiKey) {
    apiKey = (await promptForApiKey(options.selectedModel.provider)).trim()
    await setStoredApiKey(options.selectedModel.provider, apiKey)
  }

  if (options.selectedModel.provider === 'anthropic') {
    const result = await generateText({
      model: createAnthropic({ apiKey })(options.selectedModel.name),
      prompt: sections.join('\n\n'),
      ...(options.selectedModel.reasoning === undefined ||
      options.selectedModel.reasoning === false
        ? {}
        : options.selectedModel.reasoning === 'disabled'
          ? {
              providerOptions: {
                anthropic: {
                  thinking: { type: 'disabled' as const },
                },
              },
            }
          : options.selectedModel.reasoning === 'enabled'
            ? {
                providerOptions: {
                  anthropic: {
                    thinking: { type: 'enabled' as const },
                  },
                },
              }
            : {
                providerOptions: {
                  anthropic: {
                    thinking: { type: 'adaptive' as const },
                  },
                },
              }),
    })

    return result.text
  }

  if (options.selectedModel.provider === 'google') {
    const result = await generateText({
      model: createGoogleGenerativeAI({ apiKey })(options.selectedModel.name),
      prompt: sections.join('\n\n'),
      ...(options.selectedModel.reasoning === undefined ||
      options.selectedModel.reasoning === false
        ? {}
        : {
            providerOptions: {
              google: {
                thinkingConfig: {
                  thinkingLevel:
                    options.selectedModel.reasoning === true
                      ? 'medium'
                      : options.selectedModel.reasoning,
                },
              },
            },
          }),
    })

    return result.text
  }

  if (options.selectedModel.provider === 'openai') {
    const result = await generateText({
      model: createOpenAI({ apiKey })(options.selectedModel.name),
      prompt: sections.join('\n\n'),
      ...(options.selectedModel.reasoning === undefined ||
      options.selectedModel.reasoning === false
        ? {}
        : {
            providerOptions: {
              openai: {
                reasoningEffort:
                  options.selectedModel.reasoning === true
                    ? 'medium'
                    : options.selectedModel.reasoning,
              },
            },
          }),
    })

    return result.text
  }

  if (options.selectedModel.provider === 'openrouter') {
    const result = await generateText({
      model: createOpenAICompatible({
        apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
        name: 'openrouter',
      })(options.selectedModel.name),
      prompt: sections.join('\n\n'),
      ...(options.selectedModel.reasoning === undefined ||
      options.selectedModel.reasoning === false
        ? {}
        : {
            providerOptions: {
              openrouter: {
                reasoningEffort:
                  options.selectedModel.reasoning === true
                    ? 'medium'
                    : options.selectedModel.reasoning,
              },
            },
          }),
    })

    return result.text
  }

  try {
    const url = new URL(options.selectedModel.provider)

    if (url.protocol !== 'https:') {
      throw new Error('Custom model providers must use https.')
    }

    const result = await generateText({
      model: createOpenAICompatible({
        apiKey,
        baseURL: options.selectedModel.provider,
        name: options.selectedModel.provider,
      })(options.selectedModel.name),
      prompt: sections.join('\n\n'),
      ...(options.selectedModel.reasoning === undefined ||
      options.selectedModel.reasoning === false
        ? {}
        : {
            providerOptions: {
              [options.selectedModel.provider]: {
                reasoningEffort:
                  options.selectedModel.reasoning === true
                    ? 'medium'
                    : options.selectedModel.reasoning,
              },
            },
          }),
    })

    return result.text
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'Custom model providers must use https.'
    ) {
      throw error
    }

    throw new Error(
      `Unsupported model provider '${options.selectedModel.provider}'. Use openai, anthropic, google, openrouter, or an https base URL.`
    )
  }
}
