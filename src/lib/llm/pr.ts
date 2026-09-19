import { generateText, type LanguageModel } from 'ai'
import prBodyPrompt from './prompts/pr-body.md?raw'
import prTitlePrompt from './prompts/pr-title.md?raw'
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

  messages.push({
    role: 'user',
    content: 'Generate the pull request Markdown document from the above.',
  })

  const titleGuidelines = (options.titleInstructions ?? prTitlePrompt).trim()
  const bodyGuidelines = (options.bodyInstructions ?? prBodyPrompt).trim()
  const instructions = prPrompt
    .replace('{{title}}', titleGuidelines)
    .replace('{{body}}', bodyGuidelines)

  const result = await generateText({
    model: options.languageModel,
    instructions,
    messages,
  })

  return result.text.trim()
}
