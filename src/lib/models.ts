import { z } from 'zod'
import { resolvedConfigSchema } from '../schema'

export type SelectedModel = {
  provider: string
  name: string
  reasoning?: boolean | string
}

export function getConfiguredModelOptions(
  config: z.infer<typeof resolvedConfigSchema>
) {
  const modelOptions: SelectedModel[] = []

  for (const [provider, entries] of Object.entries(config.models)) {
    for (const entry of entries) {
      modelOptions.push({
        provider,
        name: typeof entry === 'string' ? entry : entry.name,
        reasoning: typeof entry === 'string' ? undefined : entry.reasoning,
      })
    }
  }

  return modelOptions
}
