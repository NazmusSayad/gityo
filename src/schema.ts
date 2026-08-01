import { z } from 'zod'
import { PROVIDER_NPM_PACKAGES } from './lib/llm/providers'

const modelSchema = z.object({
  npm: z.enum(PROVIDER_NPM_PACKAGES).default('@ai-sdk/openai-compatible'),

  apiKeyEnv: z.union([z.string().min(1), z.array(z.string().min(1))]),

  model: z.string().min(1),

  apiUrl: z.url().optional(),

  options: z.record(z.string(), z.unknown()).optional(),
})

export const configSchema = z
  .object({
    $schema: z.url(),

    models: z.record(z.string().min(1), modelSchema),

    autoAcceptMessage: z.boolean(),
    instructions: z.string().min(1),

    postCommand: z.enum(['push', 'push-and-pull']).nullable(),
    autoRunPostCommand: z.boolean(),
  })
  .partial()

export function resolveConfig(input: unknown) {
  const parsed = configSchema.parse(input)

  return {
    models: parsed.models,

    instructions: parsed.instructions,
    autoAcceptCommitMessage: parsed.autoAcceptMessage ?? false,

    postCommand:
      parsed.postCommand === undefined ? ('push' as const) : parsed.postCommand,

    autoRunPostCommand: parsed.autoRunPostCommand ?? false,
  }
}

export type ResolvedConfig = ReturnType<typeof resolveConfig>
