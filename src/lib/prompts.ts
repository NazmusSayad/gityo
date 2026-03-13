import { checkbox, confirm, input, password, select } from '@inquirer/prompts'
import chalk from 'chalk'
import readline from 'node:readline'
import { AppUserCanceledError } from './errors'

type SelectedModel = {
  provider: string
  name: string
  reasoning?: boolean | string
}

export async function promptForFilesToStage(branch: string, files: string[]) {
  console.log(`${chalk.cyan(' Branch')} ${chalk.white(branch)}\n`)

  return checkbox({
    message: `Select files to stage ${chalk.gray('(Enter = all)')}`,
    choices: files.map((file) => ({
      name: file,
      value: file,
    })),

    pageSize: 12,
    theme: {
      prefix: {
        idle: chalk.blue('?'),
        done: chalk.green(''),
      },

      style: {
        message: (txt: string, status: 'idle' | 'done') =>
          status === 'done' ? chalk.green(txt) : chalk.blue(txt),
      },
    },
  })
}

export async function promptForCommitMessageInput(
  modelOptions: SelectedModel[],
  defaultModelIndex = 0
) {
  const initialIndex =
    defaultModelIndex >= 0 && defaultModelIndex < modelOptions.length
      ? defaultModelIndex
      : 0

  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    const message = await input({
      message: `${chalk.blue('󰜘 Commit message')} ${chalk.gray('(empty = generate)')}${modelOptions[initialIndex] ? ` ${chalk.gray(`| model: ${modelOptions[initialIndex].provider}:${modelOptions[initialIndex].name}`)}` : ''}`,
    })

    return {
      message: message.trim(),
      selectedModelIndex: modelOptions[initialIndex] ? initialIndex : undefined,
    }
  }

  return new Promise<{ message: string; selectedModelIndex?: number }>(
    (resolve, reject) => {
      const stdin = process.stdin
      let currentValue = ''
      let activeIndex = initialIndex
      let renderedLineCount = 0
      const modifiedEnterSequences = new Set([
        '\u001b[13;2u',
        '\u001b[13;5u',
        '\u001b[27;2;13~',
        '\u001b[27;5;13~',
      ])

      readline.emitKeypressEvents(stdin)
      stdin.setRawMode(true)
      stdin.resume()

      function clearRenderedBlock() {
        if (renderedLineCount === 0) {
          return
        }

        readline.cursorTo(process.stdout, 0)

        for (let lineIndex = 0; lineIndex < renderedLineCount; lineIndex += 1) {
          readline.clearLine(process.stdout, 0)

          if (lineIndex < renderedLineCount - 1) {
            readline.moveCursor(process.stdout, 0, -1)
          }
        }

        readline.cursorTo(process.stdout, 0)
        renderedLineCount = 0
      }

      function render() {
        clearRenderedBlock()

        const selectedModel = modelOptions[activeIndex]
          ? `${modelOptions[activeIndex].provider}:${modelOptions[activeIndex].name}`
          : 'none'

        const ui = [
          `${chalk.blue('󰜘 Commit message')} ${chalk.gray(
            '(Tab switch model • Enter=submit • +Enter/^Enter=new line)'
          )}`,

          `${chalk.cyan('󰒲 Model')} ${chalk.white(selectedModel)}`,
          currentValue.length > 0 ? currentValue : chalk.gray(''),
        ].join('\n')

        process.stdout.write(ui)
        renderedLineCount = ui.split('\n').length
      }

      function cleanup() {
        stdin.off('keypress', onKeypress)
        process.off('SIGINT', onSigint)
        stdin.setRawMode(false)
        clearRenderedBlock()
        process.stdout.write('\n')
      }

      function onSigint() {
        cleanup()
        reject(new AppUserCanceledError())
      }

      function onKeypress(chunk: string, key: readline.Key) {
        if (key.ctrl && key.name === 'c') {
          cleanup()
          reject(new AppUserCanceledError())
          return
        }

        if (
          (key.shift && (key.name === 'return' || key.name === 'enter')) ||
          (key.ctrl && (key.name === 'return' || key.name === 'enter')) ||
          key.name === 'linefeed' ||
          (key.ctrl && key.name === 'j') ||
          (key.meta && (key.name === 'return' || key.name === 'enter')) ||
          modifiedEnterSequences.has(chunk)
        ) {
          currentValue += '\n'
          render()
          return
        }

        if (key.name === 'return' || key.name === 'enter') {
          cleanup()
          resolve({
            message: currentValue.trim(),
            selectedModelIndex: modelOptions[activeIndex]
              ? activeIndex
              : undefined,
          })
          return
        }

        if (key.name === 'backspace') {
          currentValue = currentValue.slice(0, -1)
          render()
          return
        }

        if (key.name === 'tab' && modelOptions.length > 0) {
          activeIndex = (activeIndex + 1) % modelOptions.length
          render()
          return
        }

        if (
          chunk.length > 0 &&
          !key.ctrl &&
          !key.meta &&
          key.name !== 'escape' &&
          key.name !== 'tab'
        ) {
          currentValue += chunk
          render()
        }
      }

      render()
      process.on('SIGINT', onSigint)
      stdin.on('keypress', onKeypress)
    }
  )
}

export async function promptForGeneratedCommitAction(message: string) {
  console.log(
    `\n${chalk.magenta('󰚩 Generated message')} ${chalk.white(message)}`
  )

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

  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    return mapResponse(
      await input({
        message: 'Accept generated commit message? [Y/n/r]',
      })
    )
  }

  return new Promise<'accept' | 'cancel' | 'regenerate'>((resolve, reject) => {
    const stdin = process.stdin

    readline.emitKeypressEvents(stdin)
    stdin.setRawMode(true)
    stdin.resume()
    console.log('Press enter or y to accept, n to cancel, r to regenerate.')

    function cleanup() {
      stdin.off('keypress', onKeypress)
      process.off('SIGINT', onSigint)
      stdin.setRawMode(false)
    }

    function onSigint() {
      cleanup()
      reject(new AppUserCanceledError())
    }

    function onKeypress(chunk: string, key: readline.Key) {
      if (key.ctrl && key.name === 'c') {
        cleanup()
        reject(new AppUserCanceledError())
        return
      }

      const action = mapResponse(key.name ?? chunk)

      if (!action) {
        return
      }

      cleanup()
      resolve(action)
    }

    process.on('SIGINT', onSigint)
    stdin.on('keypress', onKeypress)
  })
}

export async function promptForPostCommand(commandLabel: string) {
  return confirm({
    message: `Run post command: ${commandLabel}?`,
    default: true,
  })
}

export async function promptForProviderSelection(providers: string[]) {
  const customProviderValue = '__custom__'
  const selected = await select({
    message: 'Choose a provider or custom base URL',
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

export async function promptForApiKey(provider: string) {
  return password({
    message: `API key for ${provider}`,
    mask: '*',
    validate: (value) =>
      value.trim().length > 0 ? true : 'API key cannot be empty.',
  })
}
