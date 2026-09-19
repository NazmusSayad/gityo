import { generateText, type LanguageModel } from 'ai'
import prBodyConcise from './prompts/pr-body-concise.md?raw'
import prBodyDefault from './prompts/pr-body-default.md?raw'
import prBodyVerbose from './prompts/pr-body-verbose.md?raw'
import prTitleConventional from './prompts/pr-title-conventional.md?raw'
import prTitleDefault from './prompts/pr-title-default.md?raw'
import prPrompt from './prompts/pr.md?raw'

export const PR_TITLE_STYLES: Record<string, string> = {
  default: prTitleDefault,
  conventional: prTitleConventional,
}

export const PR_BODY_STYLES: Record<string, string> = {
  default: prBodyDefault,
  concise: prBodyConcise,
  verbose: prBodyVerbose,
}

type UserMessage = { role: 'user'; content: string }

export function buildPullRequestSystemPrompt(options: {
  titleInstructions: string
  bodyInstructions: string
}) {
  return prPrompt
    .replace('{{title}}', options.titleInstructions.trim())
    .replace('{{body}}', options.bodyInstructions.trim())
}

export type GeneratePullRequestOptions = {
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
