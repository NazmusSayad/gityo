import { z } from 'zod'

export const configSchema = z
  .object({
    $schema: z.url(),

    model: z.object({
      provider: z.union([
        z.literal('openai'),
        z.literal('anthropic'),
        z.literal('google'),
        z.literal('openrouter'),
        z.url(),
      ]),

      name: z.string().min(1),

      reasoning: z.union([z.boolean(), z.string().min(1)]).default(false),
    }),

    autoAcceptMessage: z.boolean(),
    instructions: z.string().min(1),

    postCommand: z.enum(['push', 'push-and-pull']),
    autoRunPostCommand: z.boolean(),
  })
  .partial()

export function resolveConfig(input: unknown) {
  const parsed = configSchema.parse(input)

  return {
    model: parsed.model,

    instructions: parsed.instructions,
    autoAcceptCommitMessage: parsed.autoAcceptMessage ?? false,

    postCommand: parsed.postCommand,
    autoRunPostCommand: parsed.autoRunPostCommand ?? false,
  }
}

export type ResolvedConfig = ReturnType<typeof resolveConfig>
