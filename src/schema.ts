import { z } from 'zod'

const BUILTIN_PROVIDERS = ['openai', 'anthropic', 'google'] as const
const COMPATIBLE_PROVIDERS = ['openrouter', 'kilo'] as const
export const SUPPORTED_PROVIDERS = [
  ...BUILTIN_PROVIDERS,
  ...COMPATIBLE_PROVIDERS,
] as const

const modelSchema = z.object({
  provider: z.union([...SUPPORTED_PROVIDERS.map((p) => z.literal(p)), z.url()]),

  name: z.string().min(1),

  reasoning: z.union([z.boolean(), z.string().min(1)]).default(false),

  apiKeyEnv: z.union([z.string().min(1), z.array(z.string().min(1))]),
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
