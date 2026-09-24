import { tool, type LanguageModel, type ToolSet } from 'ai'
import { z } from 'zod'
import { estimateTokens, splitDiffIntoChunks } from '../diff.js'
import { exec } from '../shell.js'
import type { ReleaseLimits } from './notes.js'
import { summarizeChunks } from './summarize.js'

const CHARS_PER_TOKEN = 4
const MIN_TOOL_OUTPUT_TOKENS = 200
const PROMPT_RESERVE_TOKENS = 800
const MIN_CHUNK_BUDGET_TOKENS = 1000
const MAX_TOC_LINES = 500
const BUDGET_EXHAUSTED =
  'Size limit reached. Write the release notes with the information you already have.'

const NOISE_FILE_EXCLUDES = [
  ':(top,exclude)*.lock',
  ':(top,exclude)*-lock.*',
  ':(top,exclude)*.min.js',
  ':(top,exclude)*.min.mjs',
  ':(top,exclude)*.min.cjs',
  ':(top,exclude)*.min.css',
  ':(top,exclude)*.map',
]

const diffSummaryPrompt = `You summarize parts of a large git diff for a release notes generator.
Describe WHAT changed and any effect a user could notice.
Be factual and terse. Do NOT write release notes. Maximum 120 words.`

function parseLsTree(output: string): string[] {
  return output
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => {
      const tabIdx = line.indexOf('\t')
      return tabIdx >= 0 ? line.slice(tabIdx + 1) : ''
    })
}

export function createReleaseTools(
  languageModel: LanguageModel,
  limits: ReleaseLimits
): ToolSet {
  let remainingTokens = limits.maxTokens

  function spend(text: string) {
    const maxChars = remainingTokens * CHARS_PER_TOKEN
    const fitted =
      text.length <= maxChars
        ? text
        : `${text.slice(0, maxChars)}\n[... truncated to fit the size limit]`

    remainingTokens -= estimateTokens(fitted)
    return fitted
  }

  async function readCommitDiff(ref: string) {
    const fullDiff = await exec('git', [
      'show',
      '--no-color',
      '--pretty=format:',
      ref,
    ])

    if (estimateTokens(fullDiff) <= remainingTokens) {
      return fullDiff
    }

    const numstat = await exec('git', [
      'show',
      '--no-color',
      '--pretty=format:',
      '--numstat',
      ref,
    ])
    const tocLines = numstat.trim().split('\n')
    const toc =
      tocLines.length <= MAX_TOC_LINES
        ? tocLines.join('\n')
        : [
            ...tocLines.slice(0, MAX_TOC_LINES),
            `[... ${tocLines.length - MAX_TOC_LINES} more files]`,
          ].join('\n')
    const header = `This diff is too large to show in full.\n\nChanged files (additions, deletions, path):\n${toc}`

    const minimizedDiff = capFileSections(
      await exec('git', [
        'show',
        '--no-color',
        '--pretty=format:',
        '--unified=1',
        ref,
        '--',
        ':/',
        ...NOISE_FILE_EXCLUDES,
      ]),
      limits.perFileCap
    )
    const minimized = `${header}\n\nDiff with less context, generated files excluded, and long files truncated:\n${minimizedDiff}`

    if (estimateTokens(minimized) <= remainingTokens) {
      return minimized
    }

    const chunkBudget = Math.max(
      limits.maxTokens - estimateTokens(toc) - PROMPT_RESERVE_TOKENS,
      MIN_CHUNK_BUDGET_TOKENS
    )
    const chunks = splitDiffIntoChunks(minimizedDiff, chunkBudget).map(
      (chunk) =>
        `All changed files:\n${toc}\n\nChanges (part of a larger diff):\n${chunk}`
    )
    const summaries = await summarizeChunks(
      languageModel,
      diffSummaryPrompt,
      chunks
    )

    return `${header}\n\nSummaries of the diff:\n${summaries}`
  }

  return {
    check_diff: tool({
      description:
        'Get the full diff of a specific commit. Returns the patch showing all changes (additions, deletions, modifications) introduced by the commit.',
      inputSchema: z.object({
        commithash: z
          .string()
          .describe(
            'The commit hash, tag, branch, or any other git ref resolvable by git rev-parse.'
          ),
      }),
      execute: async ({ commithash }) => {
        if (remainingTokens < MIN_TOOL_OUTPUT_TOKENS) {
          return { error: BUDGET_EXHAUSTED }
        }

        return spend(await readCommitDiff(commithash))
      },
    }),
    browse_code: tool({
      description:
        'Browse the code at a specific commit. If the path points to a file, returns its content. If the path points to a folder, returns the list of files and sub-folders it contains. Pass an empty string for the path to browse the repository root.',
      inputSchema: z.object({
        commithash: z
          .string()
          .describe(
            'The commit hash, tag, branch, or any other git ref resolvable by git rev-parse.'
          ),
        path: z
          .string()
          .describe(
            'Path to a file or folder within the repository, relative to the repo root. Use forward slashes. Pass an empty string for the root.'
          ),
      }),
      execute: async ({ commithash, path }) => {
        if (remainingTokens < MIN_TOOL_OUTPUT_TOKENS) {
          return { error: BUDGET_EXHAUSTED }
        }

        const normalized = path.replace(/^\/+|\/+$/g, '')

        if (normalized === '') {
          const output = await exec('git', ['ls-tree', commithash])
          return {
            type: 'folder',
            items: parseLsTree(spend(output)),
          }
        }

        const ref = `${commithash}:${normalized}`
        let objectType: string
        try {
          objectType = (await exec('git', ['cat-file', '-t', ref])).trim()
        } catch {
          return { error: "doesn't exists" }
        }

        if (objectType === 'tree') {
          const output = await exec('git', ['ls-tree', ref])
          return { type: 'folder', items: parseLsTree(spend(output)) }
        }

        if (objectType === 'blob') {
          const content = await exec('git', ['show', ref])
          return { type: 'file', content: spend(content) }
        }

        return { error: "doesn't exists" }
      },
    }),
  }
}

function capFileSections(diff: string, perFileCap: number) {
  return ('\n' + diff.trimStart())
    .split('\ndiff --git ')
    .slice(1)
    .map((section) => {
      const lines = `diff --git ${section}`.split('\n')
      const bodyLines = lines.length - 1

      if (bodyLines <= perFileCap) {
        return lines.join('\n')
      }

      return [
        ...lines.slice(0, perFileCap + 1),
        `[... ${bodyLines - perFileCap} more lines truncated]`,
      ].join('\n')
    })
    .join('\n')
}
