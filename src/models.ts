import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { generateText } from 'ai'
import { promptForApiKey } from './prompts'
import { getStoredApiKey, setStoredApiKey } from './secrets'
import type { GityoConfig, ModelConfigEntry, ModelOption } from './types'

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

export function getConfiguredModelOptions(config: GityoConfig) {
  return Object.entries(config.models).flatMap(([provider, entries]) =>
    entries.map((entry) => createModelOption(provider, entry))
  )
}

export function getConfiguredProviders(config: GityoConfig) {
  return Array.from(
    new Set([
      'anthropic',
      'google',
      'openai',
      'openrouter',
      ...Object.keys(config.models),
    ])
  )
}

export function getDefaultModelOption(
  modelOptions: ModelOption[],
  defaultModel: string | undefined
) {
  if (modelOptions.length === 0) {
    return undefined
  }

  if (!defaultModel) {
    return modelOptions[0]
  }

  const byId = modelOptions.find((option) => option.id === defaultModel)

  if (byId) {
    return byId
  }

  const byName = modelOptions.filter((option) => option.name === defaultModel)

  if (byName.length === 1) {
    return byName[0]
  }

  return modelOptions[0]
}

export async function generateCommitMessage(options: {
  model: ModelOption
  prompt: string
}) {
  const apiKey = await getOrPromptForApiKey(options.model.provider)
  const provider = createProvider(options.model, apiKey)
  const providerOptions = getProviderOptions(options.model)

  const result = await generateText({
    model: provider(options.model.name),
    prompt: options.prompt,
    ...(providerOptions ? { providerOptions } : {}),
  })

  return result.text
}

function createModelOption(
  provider: string,
  entry: ModelConfigEntry
): ModelOption {
  const providerDetails = resolveProviderDetails(provider)

  if (typeof entry === 'string') {
    return {
      id: `${provider}:${entry}`,
      label: `${provider}:${entry}`,
      kind: providerDetails.kind,
      provider,
      name: entry,
      baseUrl: providerDetails.baseUrl,
    }
  }

  return {
    id: `${provider}:${entry.name}`,
    label: `${provider}:${entry.name}`,
    kind: providerDetails.kind,
    provider,
    name: entry.name,
    baseUrl: providerDetails.baseUrl,
    reasoning: entry.reasoning,
  }
}

function resolveProviderDetails(provider: string) {
  if (provider === 'anthropic') {
    return { kind: 'anthropic' as const }
  }

  if (provider === 'google') {
    return { kind: 'google' as const }
  }

  if (provider === 'openai') {
    return { kind: 'openai' as const }
  }

  if (provider === 'openrouter') {
    return {
      kind: 'openai-compatible' as const,
      baseUrl: OPENROUTER_BASE_URL,
    }
  }

  if (isHttpsUrl(provider)) {
    return {
      kind: 'openai-compatible' as const,
      baseUrl: provider,
    }
  }

  throw new Error(
    `Unsupported model provider '${provider}'. Use openai, anthropic, google, openrouter, or an https base URL.`
  )
}

async function getOrPromptForApiKey(provider: string) {
  const storedApiKey = await getStoredApiKey(provider)

  if (storedApiKey) {
    return storedApiKey
  }

  const apiKey = (await promptForApiKey(provider)).trim()

  await setStoredApiKey(provider, apiKey)

  return apiKey
}

function createProvider(model: ModelOption, apiKey: string) {
  if (model.kind === 'anthropic') {
    return createAnthropic({ apiKey })
  }

  if (model.kind === 'google') {
    return createGoogleGenerativeAI({ apiKey })
  }

  if (model.kind === 'openai') {
    return createOpenAI({ apiKey })
  }

  return createOpenAICompatible({
    apiKey,
    baseURL: model.baseUrl ?? OPENROUTER_BASE_URL,
    name: model.provider,
  })
}

function getProviderOptions(model: ModelOption) {
  const providerOptionValue = getReasoningOptions(model)

  if (!providerOptionValue) {
    return undefined
  }

  return {
    [model.provider]: providerOptionValue,
  }
}

function getReasoningOptions(model: ModelOption) {
  const { reasoning } = model

  if (reasoning === undefined || reasoning === false) {
    return undefined
  }

  if (model.kind === 'anthropic') {
    if (reasoning === 'disabled') {
      return {
        thinking: { type: 'disabled' as const },
      }
    }

    if (reasoning === 'enabled') {
      return {
        thinking: { type: 'enabled' as const },
      }
    }

    return {
      thinking: { type: 'adaptive' as const },
    }
  }

  if (model.kind === 'google') {
    return {
      thinkingConfig: {
        thinkingLevel: normalizeReasoningLevel(reasoning),
      },
    }
  }

  return {
    reasoningEffort: normalizeReasoningLevel(reasoning),
  }
}

function normalizeReasoningLevel(reasoning: boolean | string) {
  if (reasoning === true) {
    return 'medium'
  }

  if (reasoning === false) {
    return 'none'
  }

  return reasoning
}

function isHttpsUrl(value: string) {
  try {
    const url = new URL(value)

    return url.protocol === 'https:'
  } catch {
    return false
  }
}
