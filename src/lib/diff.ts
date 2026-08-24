import type { SimpleGit } from 'simple-git'
import { getCommitDiff } from './git'

export const DEFAULT_MAX_DIFF_TOKENS = 2
export const DEFAULT_PER_FILE_CAP = 400

const CHARS_PER_TOKEN = 4
const MINIMIZED_CONTEXT_LINES = 1
const FILE_SECTION_PREFIX = 'diff --git '
const HUNK_HEADER_PREFIX = '@@ '

const NOISE_FILE_PATTERNS = [
  /\.(lock|min\.(?:js|mjs|cjs|css)|map)$/i,
  /-lock\.[^/]+$/i,
]

export function estimateTokens(text: string) {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

type FileSection = {
  path: string
  content: string
  additions: number
  deletions: number
  binary: boolean
}

export type MinimizedDiff = {
  toc: string
  body: string
}

export async function minimizeDiff(
  git: SimpleGit,
  options: { perFileCap: number; allFiles: string[] }
): Promise<MinimizedDiff> {
  const { diff } = await getCommitDiff(git, MINIMIZED_CONTEXT_LINES)
  const sections = splitFileSections(diff).map(parseSection)

  const kept: FileSection[] = []
  const excludedPaths = new Set<string>()

  for (const section of sections) {
    if (isNoiseFile(section.path)) excludedPaths.add(section.path)
    else kept.push(section)
  }

  return {
    toc: buildToc(sections, excludedPaths, options.allFiles),
    body: kept
      .map((section) => capSection(section, options.perFileCap))
      .join('\n'),
  }
}

export function splitDiffIntoChunks(diff: string, maxTokens: number): string[] {
  return packIntoChunks(
    splitFileSections(diff).flatMap((section) =>
      estimateTokens(section) <= maxTokens
        ? [section]
        : splitOversizedSection(section, maxTokens)
    ),
    maxTokens
  )
}

function isNoiseFile(path: string) {
  return NOISE_FILE_PATTERNS.some((pattern) => pattern.test(path))
}

function splitFileSections(diff: string): string[] {
  return ('\n' + diff.trimStart())
    .split('\ndiff --git ')
    .slice(1)
    .map((part) => FILE_SECTION_PREFIX + part)
}

function parseSection(section: string): FileSection {
  let additions = 0
  let deletions = 0
  let binary = false

  for (const line of section.split('\n').slice(1)) {
    if (
      line.startsWith('Binary files') ||
      line.startsWith('GIT binary patch')
    ) {
      binary = true
      continue
    }

    if (line.startsWith('+++') || line.startsWith('---')) continue

    if (line.startsWith('+')) additions++
    else if (line.startsWith('-')) deletions++
  }

  return {
    path: extractPath(section.split('\n')[0]),
    content: section,
    additions,
    deletions,
    binary,
  }
}

function extractPath(header: string) {
  const match = header.match(/^diff --git a\/(.+) b\/(.+)$/)

  return match ? match[2] : ''
}

function capSection(section: FileSection, cap: number) {
  const lines = section.content.split('\n')
  const bodyLines = lines.length - 1

  if (bodyLines <= cap) {
    return section.content
  }

  return [
    ...lines.slice(0, cap + 1),
    `[... ${bodyLines - cap} more lines truncated]`,
  ].join('\n')
}

function buildToc(
  sections: FileSection[],
  excludedPaths: Set<string>,
  allFiles: string[]
) {
  const lines = ['Changed files:']
  const seen = new Set<string>()

  for (const section of sections) {
    seen.add(section.path)

    if (section.binary) {
      lines.push(`- ${section.path} (binary)`)
      continue
    }

    lines.push(
      `- ${section.path} (+${section.additions} -${section.deletions})`
    )
  }

  for (const path of excludedPaths) {
    seen.add(path)
    lines.push(`- ${path} (excluded generated file)`)
  }

  for (const file of allFiles) {
    if (!seen.has(file)) lines.push(`- ${file}`)
  }

  return lines.join('\n')
}

function packIntoChunks(pieces: string[], maxTokens: number): string[] {
  const chunks: string[] = []
  let current = ''

  for (const piece of pieces) {
    if (current.length > 0 && estimateTokens(current + piece) > maxTokens) {
      chunks.push(current)
      current = ''
    }

    current += piece
  }

  if (current.length > 0) chunks.push(current)

  return chunks
}

function splitOversizedSection(section: string, maxTokens: number): string[] {
  const [header, ...lines] = section.split('\n')
  const hunks: string[][] = []
  let currentHunk: string[] = []

  for (const line of lines) {
    if (line.startsWith(HUNK_HEADER_PREFIX) && currentHunk.length > 0) {
      hunks.push(currentHunk)
      currentHunk = []
    }

    currentHunk.push(line)
  }

  if (currentHunk.length > 0) hunks.push(currentHunk)

  return packIntoChunks(
    hunks.flatMap((hunk) => {
      const piece = [header, ...hunk].join('\n')

      return estimateTokens(piece) <= maxTokens
        ? [piece]
        : hardSplit(piece, maxTokens)
    }),
    maxTokens
  )
}

function hardSplit(text: string, maxTokens: number): string[] {
  const maxChars = maxTokens * CHARS_PER_TOKEN
  const chunks: string[] = []
  let current = ''

  for (const line of text.split('\n')) {
    if (estimateTokens(line) > maxTokens) {
      if (current.length > 0) {
        chunks.push(current)
        current = ''
      }

      for (let index = 0; index < line.length; index += maxChars) {
        chunks.push(line.slice(index, index + maxChars))
      }

      continue
    }

    const candidate = current.length === 0 ? line : `${current}\n${line}`

    if (estimateTokens(candidate) > maxTokens) {
      chunks.push(current)
      current = line
      continue
    }

    current = candidate
  }

  if (current.length > 0) chunks.push(current)

  return chunks
}
