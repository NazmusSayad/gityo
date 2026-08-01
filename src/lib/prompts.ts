import { checkbox, confirm, input } from '@inquirer/prompts'
import chalk from 'chalk'
import { customInput } from './custom-input'

const selectionTheme = {
  prefix: {
    idle: chalk.blue('?'),
    done: chalk.green(''),
  },

  style: {
    message: (txt: string, status: 'idle' | 'done') =>
      status === 'done' ? chalk.green(txt) : chalk.blue(txt),
  },
}

export async function promptForGeneratedCommitAction() {
  function mapResponse(value: string) {
    const normalized = value.trim().toLowerCase()

    if (normalized === '' || normalized === 'enter' || normalized === 'y') {
      return 'accept' as const
    }

    if (normalized === 'n') {
      return 'cancel' as const
    }

    if (normalized === 'r') {
      return 'regenerate' as const
    }

    return undefined
  }

  return mapResponse(
    await input({
      message: `${'Accept generated commit message?'} ${chalk.reset.dim('[Y/n/r]')}`,
      theme: selectionTheme,
    })
  )
}

export async function promptForFilesToStage(files: string[]) {
  return checkbox({
    message: `Select files to stage ${chalk.reset.dim('(⏎ submit)')}`,
    choices: files.map((file) => ({
      name: file,
      value: file,
    })),
    pageSize: 12,
    theme: {
      ...selectionTheme,
      style: {
        ...selectionTheme.style,
        answer: () => '',
      },
    },
  })
}

export async function promptForCommitMessageInput(model: {
  hasKey: boolean
  name: string
}) {
  const message = await customInput({
    required: !model.hasKey,
    message: `Commit message ${chalk.reset.dim(`(⏎ submit • ${model.name})`)}`,
  })

  return message.trim()
}

export async function promptForPostCommand(commandLabel: string) {
  return confirm({
    message: `Run post command: ${commandLabel}?`,
    default: true,
    theme: selectionTheme,
  })
}
