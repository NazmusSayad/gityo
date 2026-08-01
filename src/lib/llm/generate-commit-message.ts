import { generateText } from 'ai'
import type { ResolvedConfig } from '../../schema'
import { getStagedDiff } from '../git'
import { resolveAiModel, type ResolveAiModelConfig } from './resolve-ai-model'
import systemPrompt from './system-prompt.txt?raw'

export async function generateCommitMessage(
  cwd: string,
  config: ResolvedConfig,
  model: ResolveAiModelConfig
) {
  const result = await generateText({
    model: resolveAiModel(model),

    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: `Staged diff:\n${await getStagedDiff(cwd)}`,
      },
      {
        role: 'user',
        content:
          config.instructions ||
          'Generate a concise git commit message based on the above instructions and diff.',
      },
    ],
  })

  return {
    text: result.text.trim(),
  }
}
