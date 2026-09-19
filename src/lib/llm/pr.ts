import { generateText, type LanguageModel } from 'ai'
import prPrompt from './prompts/pr.md?raw'

export type PullRequestDraft = {
  title: string
  body: string
}

export async function generatePullRequest(
  languageModel: LanguageModel,
  instructions: string | null,
  context: string
): Promise<PullRequestDraft> {
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

  return parsePullRequestDraft(result.text)
}

function parsePullRequestDraft(text: string): PullRequestDraft {
  const lines = text.trim().split('\n')

  return {
    title: lines[0].trim(),
    body: lines.slice(1).join('\n').trim(),
  }
}
