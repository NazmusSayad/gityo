import { generateText, type LanguageModel } from 'ai'
import systemPrompt from './system-prompt.txt?raw'

const summarizePrompt = `You summarize parts of a large git diff for a commit message generator.
Describe WHAT changed, in which files or modules, and any observable intent.
Be factual and terse. Do NOT write a commit message. Maximum 120 words.`

type UserMessage = { role: 'user'; content: string }

async function ask(
  languageModel: LanguageModel,
  system: string,
  messages: UserMessage[]
) {
  const result = await generateText({
    model: languageModel,
    instructions: system,
    messages,
  })

  return result.text.trim()
}

export async function generateCommitMessage(
  languageModel: LanguageModel,
  instructions: string | null,
  diff: string
) {
  return ask(languageModel, systemPrompt, [
    { role: 'user', content: `Changes:\n${diff}` },
    {
      role: 'user',
      content:
        instructions ||
        'Generate a concise git commit message based on the above instructions and diff.',
    },
  ])
}

export async function summarizeChanges(
  languageModel: LanguageModel,
  toc: string,
  chunk: string
) {
  return ask(languageModel, summarizePrompt, [
    {
      role: 'user',
      content: `All changed files:\n${toc}\n\nChanges (part of a larger diff):\n${chunk}`,
    },
    { role: 'user', content: 'Summarize these changes.' },
  ])
}

export async function generateCommitMessageFromSummaries(
  languageModel: LanguageModel,
  instructions: string | null,
  toc: string,
  summaries: string[]
) {
  const combined = summaries
    .map((summary, index) => `Part ${index + 1}:\n${summary}`)
    .join('\n\n')

  return ask(languageModel, systemPrompt, [
    {
      role: 'user',
      content: `All changed files:\n${toc}\n\nSummaries of all changes:\n${combined}`,
    },
    {
      role: 'user',
      content:
        instructions ||
        'Generate a concise git commit message covering ALL parts above.',
    },
  ])
}
