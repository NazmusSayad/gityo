import { generateText, type LanguageModel } from 'ai'
import systemPrompt from './system-prompt.txt?raw'

export async function generateCommitMessage(
  languageModel: LanguageModel,
  instructions: string | null,
  diff: string
) {
  const result = await generateText({
    model: languageModel,
    instructions: systemPrompt,

    messages: [
      {
        role: 'user',
        content: `Changes:\n${diff}`,
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
