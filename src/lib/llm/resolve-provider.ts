import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import z from 'zod'

export function resolveAiProvider(provider: string, apiKey: string) {
  if (provider === 'openai') {
    return createOpenAI({ apiKey })
  }

  if (provider === 'anthropic') {
    return createAnthropic({ apiKey })
  }

  if (provider === 'google') {
    return createGoogleGenerativeAI({ apiKey })
  }

  if (provider === 'openrouter') {
    return createOpenAICompatible({
      name: 'OpenRouter',
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey,
    })
  }

  const isUrl = z.url().safeParse(provider).success
  if (isUrl) {
    return createOpenAICompatible({
      name: 'Custom OpenAI-Compatible',
      baseURL: provider,
      apiKey,
    })
  }
}
