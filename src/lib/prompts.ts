import { confirm, input } from '@inquirer/prompts'
import chalk from 'chalk'

const selectionTheme = {
  prefix: {
    idle: chalk.blue('?'),
    done: chalk.green('✓'),
  },

  style: {
    message: (txt: string, status: 'idle' | 'done') =>
      status === 'done' ? chalk.green(txt) : chalk.blue(txt),
  },
}

export function acceptGeneratedCommitMessage() {
  return acceptGenerated(
    'generated commit message',
    'generate a new commit message'
  )
}

export function acceptGeneratedPullRequest() {
  return acceptGenerated(
    'generated pull request',
    'generate a new pull request'
  )
}

async function acceptGenerated(subject: string, regenerateHint: string) {
  const value = await input({
    message: `Accept ${subject}? ${chalk.reset.dim('[Y/r]')}`,
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

export async function promptForPostCommand(commandLabel: string) {
  return confirm({
    message: `Run post command: ${commandLabel}?`,
    default: true,
    theme: selectionTheme,
  })
}

export function confirmPullRequestMerge(description: string) {
  return confirm({
    message: `Merge pull request ${description}?`,
    default: true,
    theme: selectionTheme,
  })
}
