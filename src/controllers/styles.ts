import { createRenderer } from 'markdansi'
import type { z } from 'zod'
import { PR_BODY_STYLES, PR_TITLE_STYLES } from '../lib/llm/pr'
import { BUILTIN_STYLES, resolveInstructionContent } from '../lib/llm/style'
import { loadConfig } from '../lib/load-config'
import type { instructionSchema } from '../schema'

const renderMarkdown = createRenderer({ width: 80, listIndent: 2 })

export async function showCommitStylesController() {
  const config = await loadConfig()

  await renderStyles('Commit styles', {
    ...BUILTIN_STYLES,
    ...config.commitStyles,
  })
}

export async function showPrStylesController() {
  const config = await loadConfig()

  await renderStyles('PR title styles', {
    ...PR_TITLE_STYLES,
    ...config.prTitleStyles,
  })
  await renderStyles('PR body styles', {
    ...PR_BODY_STYLES,
    ...config.prBodyStyles,
  })
}

async function renderStyles(
  heading: string,
  styles: Record<string, z.infer<typeof instructionSchema>>
) {
  const sections = [`# ${heading}`]

  for (const key of Object.keys(styles)) {
    const content = await resolveInstructionContent(styles[key])
    sections.push(`## ${key}\n\n${content.trim()}`)
  }

  console.log(renderMarkdown(sections.join('\n\n')).trim())
  console.log('')
}
