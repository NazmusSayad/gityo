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

    commitInstructions: instructionSchema,
    commitStyle: z.string().min(1),
    commitStyles: z.record(z.string().min(1), instructionSchema),

    prTitleStyle: z.string().min(1),
    prBodyStyle: z.string().min(1),
    prTitleStyles: z.record(z.string().min(1), instructionSchema),
    prBodyStyles: z.record(z.string().min(1), instructionSchema),
    prMergeMethod: z.enum(['merge', 'rebase', 'squash']),

    maxDiffTokens: z.number().int().min(1000),
    perFileCap: z.number().int().min(50),

    autoAcceptCommitMessage: z.boolean(),
    autoRunPostCommand: z.boolean(),
    postCommand: z.enum(['push', 'push-and-pull']).nullable(),
  })
  .partial()

export function resolveConfig(input: unknown) {
  const parsed = configSchema.parse(input)

  return {
    models: parsed.models,

    commitStyle: parsed.commitStyle,
    commitStyles: parsed.commitStyles,
    commitInstructions: parsed.commitInstructions,

    prTitleStyle: parsed.prTitleStyle,
    prBodyStyle: parsed.prBodyStyle,
    prTitleStyles: parsed.prTitleStyles,
    prBodyStyles: parsed.prBodyStyles,
    prMergeMethod: parsed.prMergeMethod ?? 'merge',

    maxDiffTokens: parsed.maxDiffTokens,
    perFileCap: parsed.perFileCap,

    autoAcceptCommitMessage: parsed.autoAcceptCommitMessage ?? false,
    autoRunPostCommand: parsed.autoRunPostCommand ?? false,
    postCommand:
      parsed.postCommand === undefined ? ('push' as const) : parsed.postCommand,
  }
}
