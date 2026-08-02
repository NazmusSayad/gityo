import { createPrompt, isEnterKey, useKeypress, useState } from '@inquirer/core'
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

type CommitMessageInputConfig = {
  message: string
  required?: boolean
}

const commitMessageInputPrompt = createPrompt<string, CommitMessageInputConfig>(
  (config, done) => {
    const [status, setStatus] = useState<'idle' | 'done'>('idle')
    const [value, setValue] = useState('')
    const inputPrefix = chalk.dim('❯ ')

    useKeypress((key, readline) => {
      if (!isEnterKey(key)) {
        setValue(readline.line)
        return
      }

      const answer = value

      if (config.required && answer.trim().length === 0) {
        return
      }

      setStatus('done')
      setValue(answer)
      done(answer)
    })

    const prefix = status === 'done' ? chalk.green('✓') : chalk.blue('?')
    const messageColor = status === 'done' ? chalk.green : chalk.blue
    const header = `${prefix} ${messageColor(config.message)}`

    if (status === 'done') {
      if (value.length === 0) return header
      return `${header}\n${chalk.cyan.dim(value)}\n`
    }

    return `${header}\n${inputPrefix}${value}`
  }
)

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

export async function promptForCommitMessageInput(model: string) {
  const message = await commitMessageInputPrompt({
    required: false,
    message: `Commit message ${chalk.reset.dim(`(⏎ submit • ${model})`)}`,
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
