import { generateText, type LanguageModel } from 'ai'
import type { SimpleGit } from 'simple-git'
import systemPrompt from './system-prompt.txt?raw'

export async function generateCommitMessage(
  languageModel: LanguageModel,
  instructions: string | null,
  git: SimpleGit
) {
  const result = await generateText({
    model: languageModel,

    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: `Staged diff:\n${await git.raw(['diff', '--cached', '--no-ext-diff'])}`,
      },
      {
        role: 'user',
        content:
          instructions ||
          'Generate a concise git commit message based on the above instructions and diff.',
      },
    ],
  })

  return {
    text: result.text.trim(),
  }
}
