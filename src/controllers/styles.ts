import chalk from 'chalk'
import type { z } from 'zod'
import {
  COMMIT_STYLE_PROMPTS,
  PR_BODY_PROMPTS,
  PR_TITLE_PROMPTS,
  type Prompt,
} from '../lib/llm/prompts-registry.js'
import { loadConfig } from '../lib/load-config.js'
import type { instructionSchema } from '../schema.js'

type StyleEntry = {
  key: string
  description: string
}

export async function showStylesController() {
  const config = await loadConfig()

  printStyles(
    'Commit styles',
    mergeStyles(COMMIT_STYLE_PROMPTS, config.commitStyles)
  )
  printStyles(
    'PR title styles',
    mergeStyles(PR_TITLE_PROMPTS, config.prTitleStyles)
  )
  printStyles(
    'PR body styles',
    mergeStyles(PR_BODY_PROMPTS, config.prBodyStyles)
  )
}

function mergeStyles(
  builtin: Record<string, Prompt>,
  custom: Record<string, z.infer<typeof instructionSchema>> | undefined
) {
  const entries: StyleEntry[] = Object.entries(builtin).map((entry) => ({
    key: entry[0],
    description: entry[1].description,
  }))

  for (const key of Object.keys(custom ?? {})) {
    if (builtin[key]) {
      continue
    }

    entries.push({ key, description: 'Custom style' })
  }

  return entries
}

function printStyles(title: string, entries: StyleEntry[]) {
  console.log(chalk.bold(title))

  for (const entry of entries) {
    console.log(`- ${entry.key}: ${chalk.dim(entry.description)}`)
  }

  console.log('')
}
