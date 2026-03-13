import { z } from 'zod'

const configSchema = z.object({
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

  autoAcceptCommitMessage: z.boolean(),
  customInstructions: z.string().min(1),

  postCommand: z.enum(['push', 'push-and-pull']),
  autoRunPostCommand: z.boolean(),
})

export function generateJSONSchema() {
  return configSchema.toJSONSchema()
}

export function resolveConfig(input: unknown) {
  const parsed = configSchema.parse(input)

  return {
    model: parsed.model,

    customInstructions: parsed.customInstructions,
    autoAcceptCommitMessage: parsed.autoAcceptCommitMessage ?? false,

    postCommand: parsed.postCommand ?? 'push',
    autoRunPostCommand: parsed.autoRunPostCommand ?? false,
  }
}

export type ResolvedConfig = ReturnType<typeof resolveConfig>
