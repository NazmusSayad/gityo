import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { z } from 'zod'
import { instructionSchema } from '../../schema'
import { COMMIT_STYLE_PROMPTS } from './prompts-registry'

const BUILTIN_STYLES: Record<string, string> = Object.fromEntries(
  Object.entries(COMMIT_STYLE_PROMPTS).map((entry) => [
    entry[0],
    entry[1].prompt,
  ])
)

export function getStyleKeys(
  styles: Record<string, z.infer<typeof instructionSchema>> | undefined
) {
  return Object.keys({ ...BUILTIN_STYLES, ...styles })
}

export async function resolveStyle(
  styleKey: string,
  styles: Record<string, z.infer<typeof instructionSchema>> | undefined
) {
  const style = styles?.[styleKey] ?? BUILTIN_STYLES[styleKey]

  if (!style) {
    return undefined
  }

  return resolveInstructionContent(style)
}

export async function resolveInstructionContent(
  instruction: z.infer<typeof instructionSchema>
) {
  if (typeof instruction === 'string') {
    return instruction
  }

  return readFile(path.resolve(instruction.path), 'utf8')
}
