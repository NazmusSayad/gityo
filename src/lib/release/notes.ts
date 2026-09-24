import { generateText, isStepCount, type LanguageModel } from 'ai'
import { estimateTokens } from '../diff.js'
import type { ReleaseCommit } from './git.js'
import releasePrompt from './prompt.md?raw'
import { summarizeChunks } from './summarize.js'
import { createReleaseTools } from './tools.js'

export const EMPTY_RELEASE_NOTES = '_No notable changes in this release._'

const PROMPT_RESERVE_TOKENS = 800
const CHARS_PER_TOKEN = 4

const commitsSummaryPrompt = `You summarize part of a git commit history for a release notes generator.
List every change a user could notice, each with the commit hash(es) it comes from.
Skip purely internal changes. Be factual and terse. Do NOT write release notes. Maximum 200 words.`

export type ReleaseLimits = {
  maxTokens: number
  perFileCap: number
}

export async function generateReleaseNotes(
  languageModel: LanguageModel,
  commits: ReleaseCommit[],
  limits: ReleaseLimits
) {
  const commitsContext = await buildCommitsContext(
    languageModel,
    commits,
    limits.maxTokens
  )

  const result = await generateText({
    model: languageModel,
    instructions: releasePrompt,
    tools: createReleaseTools(languageModel, limits),
    stopWhen: isStepCount(1000),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Here are the commits related to the release:',
          },
          { type: 'text', text: commitsContext },
        ],
      },
    ],
  })

  return result.text.trim()
}

async function buildCommitsContext(
  languageModel: LanguageModel,
  commits: ReleaseCommit[],
  maxTokens: number
) {
  const fullList = commits
    .map((commit) => formatCommit(commit, commit.message))
    .join('\n\n')

  if (estimateTokens(fullList) <= maxTokens) {
    return fullList
  }

  const subjectList = commits
    .map((commit) => formatCommit(commit, commit.message.split('\n')[0]))
    .join('\n\n')

  if (estimateTokens(subjectList) <= maxTokens) {
    return `Only commit subjects are shown because the full messages are too large. Use check_diff for details.\n\n${subjectList}`
  }

  const chunkBudget = Math.max(maxTokens - PROMPT_RESERVE_TOKENS, 1000)
  const chunks: string[] = []
  let current = ''

  for (const commit of commits) {
    const entry = formatCommit(commit, commit.message).slice(
      0,
      chunkBudget * CHARS_PER_TOKEN
    )

    if (
      current.length > 0 &&
      estimateTokens(`${current}\n\n${entry}`) > chunkBudget
    ) {
      chunks.push(current)
      current = ''
    }

    current = current.length === 0 ? entry : `${current}\n\n${entry}`
  }

  if (current.length > 0) {
    chunks.push(current)
  }

  const summaries = await summarizeChunks(
    languageModel,
    commitsSummaryPrompt,
    chunks
  )

  return `There are ${commits.length} commits, too many to show in full, so here are summaries of them. Use check_diff for details.\n\n${summaries}`
}

function formatCommit(commit: ReleaseCommit, message: string) {
  return [
    `- Commithash: ${commit.hash}`,
    `  - > ${message.replaceAll('\n', '\n    > ')}`,
    `  - Timestamp: ${commit.date}`,
    `  - Author: ${commit.authorName} <${commit.authorEmail}>`,
  ].join('\n')
}
