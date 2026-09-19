import { input } from '@inquirer/prompts'
import chalk from 'chalk'

export const selectionTheme = {
  prefix: {
    idle: chalk.blue('?'),
    done: chalk.green('✓'),
  },

  style: {
    message: (txt: string, status: 'idle' | 'done') =>
      status === 'done' ? chalk.green(txt) : chalk.blue(txt),
  },
}

export async function acceptGenerated(
  question: string,
  regenerateHint: string
) {
  const value = await input({
    message: `${question} ${chalk.reset.dim('[Y/r]')}`,
    theme: selectionTheme,
    validate: (v) => {
      const normalized = v.trim()
      if (
        normalized === 'Y' ||
        normalized === 'y' ||
        normalized === 'r' ||
        normalized === ''
      ) {
        return true
      }

      return `Press Enter for yes, or type r to ${regenerateHint}.`
    },
  })

  const normalized = value.trim().toLowerCase()

  if (normalized === '' || normalized === 'y') {
    return true
  }

  return false
}
