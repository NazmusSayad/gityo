import { generateText, type LanguageModel } from 'ai'
import prPrompt from './prompts/pr.md?raw'

export async function generatePullRequest(
  languageModel: LanguageModel,
  instructions: string | null,
  context: string
): Promise<string> {
  const result = await generateText({
    model: languageModel,
    instructions: prPrompt,
    messages: [
      { role: 'user', content: context },
      {
        role: 'user',
        content:
          instructions ||
          'Generate a pull request title and body based on the above instructions and changes.',
      },
    ],
  })

  return result.text.trim()
}
