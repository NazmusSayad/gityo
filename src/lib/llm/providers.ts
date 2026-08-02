import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createAzure } from '@ai-sdk/azure'
import { createCerebras } from '@ai-sdk/cerebras'
import { createCohere } from '@ai-sdk/cohere'
import { createDeepInfra } from '@ai-sdk/deepinfra'
import { createDeepSeek } from '@ai-sdk/deepseek'
import { createFal } from '@ai-sdk/fal'
import { createFireworks } from '@ai-sdk/fireworks'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createVertex } from '@ai-sdk/google-vertex'
import { createGroq } from '@ai-sdk/groq'
import { createLuma } from '@ai-sdk/luma'
import { createMistral } from '@ai-sdk/mistral'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { createPerplexity } from '@ai-sdk/perplexity'
import { createTogetherAI } from '@ai-sdk/togetherai'
import { createXai } from '@ai-sdk/xai'
import { createAihubmix } from '@aihubmix/ai-sdk-provider'
import { createFriendli } from '@friendliai/ai-provider'
import { createHelicone } from '@helicone/ai-sdk-provider'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import type { LanguageModel } from 'ai'
import { createAiGateway } from 'ai-gateway-provider'
import { createOllama as createOllamaAiSdk } from 'ai-sdk-ollama'
import { createOpencode } from 'ai-sdk-provider-opencode-sdk'
import { createOllama as createOllamaV2 } from 'ollama-ai-provider-v2'
import { createSambaNova } from 'sambanova-ai-provider'
import { createMinimax } from 'vercel-minimax-ai-provider'
import { createWorkersAI } from 'workers-ai-provider'
import { createZhipu } from 'zhipu-ai-provider'

export type ProviderFactory = (options: Record<string, unknown>) => {
  languageModel: (modelId: string) => LanguageModel
}

export const SUPPORTED_PROVIDERS = {
  '@ai-sdk/openai': createOpenAI,
  '@ai-sdk/openai-compatible': createOpenAICompatible,
  '@ai-sdk/anthropic': createAnthropic,
  '@ai-sdk/google': createGoogleGenerativeAI,
  '@ai-sdk/xai': createXai,
  '@ai-sdk/azure': createAzure,
  '@ai-sdk/amazon-bedrock': createAmazonBedrock,
  '@ai-sdk/groq': createGroq,
  '@ai-sdk/fal': createFal,
  '@ai-sdk/deepinfra': createDeepInfra,
  '@ai-sdk/google-vertex': createVertex,
  '@ai-sdk/mistral': createMistral,
  '@ai-sdk/togetherai': createTogetherAI,
  '@ai-sdk/cohere': createCohere,
  '@ai-sdk/fireworks': createFireworks,
  '@ai-sdk/deepseek': createDeepSeek,
  '@ai-sdk/cerebras': createCerebras,
  '@ai-sdk/perplexity': createPerplexity,
  '@ai-sdk/luma': createLuma,
  '@openrouter/ai-sdk-provider': createOpenRouter,
  'ollama-ai-provider-v2': createOllamaV2,
  'ai-sdk-ollama': createOllamaAiSdk,
  'vercel-minimax-ai-provider': createMinimax,
  '@aihubmix/ai-sdk-provider': createAihubmix,
  'ai-gateway-provider': createAiGateway,
  'workers-ai-provider': createWorkersAI,
  '@friendliai/ai-provider': createFriendli,
  '@helicone/ai-sdk-provider': createHelicone,
  'ai-sdk-provider-opencode-sdk': createOpencode,
  'sambanova-ai-provider': createSambaNova,
  'zhipu-ai-provider': createZhipu,
} as unknown as Record<string, ProviderFactory>

export const PROVIDER_NPM_PACKAGES = Object.keys(SUPPORTED_PROVIDERS) as [
  string,
  ...string[],
]
