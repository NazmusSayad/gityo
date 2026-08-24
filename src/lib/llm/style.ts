import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { z } from 'zod'
import { instructionSchema } from '../../schema'
import conciseStyle from './prompts/concise.md?raw'
import defaultStyle from './prompts/default.md?raw'
import explanatoryStyle from './prompts/explanatory.md?raw'
import gitmojiStyle from './prompts/gitmoji.md?raw'
import plainStyle from './prompts/plain.md?raw'

export const BUILTIN_STYLES: Record<string, string> = {
  default: defaultStyle,
  concise: conciseStyle,
  explanatory: explanatoryStyle,
  plain: plainStyle,
  gitmoji: gitmojiStyle,
}

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
