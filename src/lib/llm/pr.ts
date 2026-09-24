import { generateText, type LanguageModel } from 'ai'
import { PR_BODY_PROMPTS, PR_TITLE_PROMPTS } from './prompts-registry.js'
import prPrompt from './prompts/pr.md?raw'

export const PR_TITLE_STYLES: Record<string, string> = Object.fromEntries(
  Object.entries(PR_TITLE_PROMPTS).map((entry) => [entry[0], entry[1].prompt])
)

export const PR_BODY_STYLES: Record<string, string> = Object.fromEntries(
  Object.entries(PR_BODY_PROMPTS).map((entry) => [entry[0], entry[1].prompt])
)

type UserMessage = { role: 'user'; content: string }

export function buildPullRequestSystemPrompt(options: {
  titleInstructions: string
  bodyInstructions: string
}) {
  return prPrompt
    .replace('{{title}}', options.titleInstructions.trim())
    .replace('{{body}}', options.bodyInstructions.trim())
}

type GeneratePullRequestOptions = {
  languageModel: LanguageModel
  systemPrompt: string
  context: string
}

export async function generatePullRequest(
  options: GeneratePullRequestOptions
): Promise<string> {
  const messages: UserMessage[] = [
    { role: 'user', content: options.context },
    {
      role: 'user',
      content: 'Generate the pull request Markdown document from the above.',
    },
  ]

  const result = await generateText({
    model: options.languageModel,
    instructions: options.systemPrompt,
    messages,
  })

  return result.text.trim()
}
