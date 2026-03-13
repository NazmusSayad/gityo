import { checkbox, confirm, input, password, select } from '@inquirer/prompts'
import chalk from 'chalk'

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

export async function promptForCommitMessageInput(model?: {
  hasKey: boolean
  name: string
}) {
  const message = await input({
    required: !model?.hasKey,
    message: `Commit message ${chalk.reset.dim(`(⏎ submit${model ? ` • ${model.name}` : ''})`)}`,

    transformer: (value) => {
      return value.length === 0 ? '' : chalk.magenta.dim(`\n${value}`)
    },

    theme: {
      ...selectionTheme,
      style: {
        ...selectionTheme.style,
        answer: () => '',
      },
    },
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

export async function promptForProviderSelection(providers: string[]) {
  const customProviderValue = '__custom__'
  const selected = await select({
    message: 'Choose a provider or custom base URL',
    theme: selectionTheme,
    choices: [
      ...providers.map((provider) => ({
        name: provider,
        value: provider,
      })),
      {
        name: 'Custom base URL',
        value: customProviderValue,
      },
    ],
  })

  if (selected !== customProviderValue) {
    return selected
  }

  const baseUrl = await input({
    message: 'Custom base URL',
    validate: (value) => {
      try {
        const url = new URL(value)

        return url.protocol === 'https:'
          ? true
          : 'Custom base URLs must use https.'
      } catch {
        return 'Enter a valid https URL.'
      }
    },
  })

  return baseUrl.trim()
}

export async function promptForModelName() {
  return input({
    message: 'Model name',
    validate: (value) =>
      value.trim().length > 0 ? true : 'Model name cannot be empty.',
  })
}

export async function promptForApiKey(provider: string) {
  return password({
    message: `API key for ${provider}`,
    mask: '*',
    validate: (value) =>
      value.trim().length > 0 ? true : 'API key cannot be empty.',
  })
}
