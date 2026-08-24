import { z } from 'zod'
import { PROVIDER_NPM_PACKAGES } from './lib/llm/ai-sdk'

export const modelSchema = z.object({
  npm: z.enum(PROVIDER_NPM_PACKAGES).optional(),

  apiKeyEnv: z.union([z.string().min(1), z.array(z.string().min(1))]),

  model: z.string().min(1),

  apiUrl: z.url().optional(),

  options: z.record(z.string(), z.unknown()).optional(),
})

export const instructionSchema = z.union([
  z.string().min(1),
  z.object({
    path: z.string().min(1),
  }),
])

export const configSchema = z
  .object({
    $schema: z.url(),

    models: z.record(z.string().min(1), modelSchema),

    instructions: instructionSchema,
    style: z.string().min(1),
    styles: z.record(z.string().min(1), instructionSchema),

    maxDiffTokens: z.number().int().min(1000),
    perFileCap: z.number().int().min(50),

    autoAcceptMessage: z.boolean(),
    autoRunPostCommand: z.boolean(),
    postCommand: z.enum(['push', 'push-and-pull']).nullable(),
  })
  .partial()

export function resolveConfig(input: unknown) {
  const parsed = configSchema.parse(input)

  return {
    models: parsed.models,

    style: parsed.style,
    styles: parsed.styles,
    instructions: parsed.instructions,

    maxDiffTokens: parsed.maxDiffTokens,
    perFileCap: parsed.perFileCap,

    autoAcceptCommitMessage: parsed.autoAcceptMessage ?? false,
    autoRunPostCommand: parsed.autoRunPostCommand ?? false,
    postCommand:
      parsed.postCommand === undefined ? ('push' as const) : parsed.postCommand,
  }
}

export type ResolvedConfig = ReturnType<typeof resolveConfig>
