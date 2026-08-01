import type { LanguageModel } from 'ai'
import { SUPPORTED_PROVIDERS } from './providers'

export type ResolveAiModelConfig = {
  npm: string
  apiKey: string
  model: string
  apiUrl?: string
  options?: Record<string, unknown>
}

export function resolveAiModel(config: ResolveAiModelConfig): LanguageModel {
  const create = SUPPORTED_PROVIDERS[config.npm]
  if (!create) {
    throw new Error(
      `Unsupported provider: ${config.npm}. Supported providers are: ${Object.keys(SUPPORTED_PROVIDERS).join(', ')}.`
    )
  }

  if (config.npm === '@ai-sdk/openai-compatible' && !config.apiUrl) {
    throw new Error('apiUrl is required for openai-compatible provider')
  }

  const provider = create({
    name: config.npm,
    apiKey: config.apiKey,
    baseURL: config.apiUrl,
    ...config.options,
  })

  return provider.languageModel(config.model)
}
