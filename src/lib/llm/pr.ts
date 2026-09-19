import { generateText, type LanguageModel } from 'ai'
import prPrompt from './prompts/pr.md?raw'

type UserMessage = { role: 'user'; content: string }

export type GeneratePullRequestOptions = {
  languageModel: LanguageModel
  titleInstructions: string | null
  bodyInstructions: string | null
  template: string | null
  context: string
}

export async function generatePullRequest(
  options: GeneratePullRequestOptions
): Promise<string> {
  const messages: UserMessage[] = [{ role: 'user', content: options.context }]

  if (options.template) {
    messages.push({
      role: 'user',
      content: `Pull request template to follow:\n${options.template}`,
    })
  }

  if (options.titleInstructions) {
    messages.push({
      role: 'user',
      content: `Title instructions:\n${options.titleInstructions}`,
    })
  }

  if (options.bodyInstructions) {
    messages.push({
      role: 'user',
      content: `Body instructions:\n${options.bodyInstructions}`,
    })
  }

  messages.push({
    role: 'user',
    content: 'Generate the pull request title and body from the above.',
  })

  const result = await generateText({
    model: options.languageModel,
    instructions: prPrompt,
    messages,
  })

  return result.text.trim()
}
