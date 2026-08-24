import type { LanguageModel } from 'ai'
import { z } from 'zod'
import { modelSchema } from '../../schema'
import { SUPPORTED_PROVIDERS } from './providers'

export function resolveLanguageModel(
  modelConfig: z.infer<typeof modelSchema>
): LanguageModel {
  const envVarNames = Array.isArray(modelConfig.apiKeyEnv)
    ? modelConfig.apiKeyEnv
    : [modelConfig.apiKeyEnv]

  let apiKey: string | null = null
  for (const name of envVarNames) {
    const value = process.env[name]

    if (value !== undefined && value.length > 0) {
      apiKey = value
      break
    }
  }

  if (apiKey === null) {
    throw new Error(
      `No API key found. Set 'apiKeyEnv' in your config to the environment variable holding the key for '${modelConfig.model}'.`
    )
  }

  const npm = modelConfig.npm ?? '@ai-sdk/openai-compatible'

  if (npm === '@ai-sdk/openai-compatible' && !modelConfig.apiUrl) {
    throw new Error('apiUrl is required for openai-compatible provider')
  }

  const provider = SUPPORTED_PROVIDERS[npm]({
    name: npm,
    apiKey,
    baseURL: modelConfig.apiUrl,
    ...modelConfig.options,
  })

  return provider.languageModel(modelConfig.model)
}
