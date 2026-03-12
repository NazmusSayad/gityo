import { checkbox, confirm, input, password, select } from '@inquirer/prompts'
import chalk from 'chalk'
import readline from 'node:readline'
import type { ModelOption, RepositoryState } from './types'

export async function promptForFilesToStage(repositoryState: RepositoryState) {
  process.stdout.write(`${chalk.bold('branch:')} ${repositoryState.branch}\n\n`)

  return checkbox({
    message: 'changes (press enter with no selection to stage all):',
    choices: repositoryState.files.map((file) => ({
      name: file,
      value: file,
    })),
    pageSize: 12,
  })
}

export async function promptForCommitMessageInput(
  modelOptions: ModelOption[],
  defaultModel?: ModelOption
) {
  const initialIndex = getInitialModelIndex(modelOptions, defaultModel)

  if (!canUseRawInput()) {
    const message = await input({
      message: buildCommitPromptLabel(modelOptions[initialIndex]),
    })

    return {
      message: message.trim(),
      activeModel: modelOptions[initialIndex],
    }
  }

  return new Promise<{ message: string; activeModel?: ModelOption }>(
    (resolve, reject) => {
      const stdin = process.stdin
      let currentValue = ''
      let activeIndex = initialIndex

      readline.emitKeypressEvents(stdin)
      stdin.setRawMode(true)
      stdin.resume()

      function onKeypress(chunk: string, key: readline.Key) {
        if (key.ctrl && key.name === 'c') {
          cleanup()
          reject(new Error('Prompt cancelled.'))
          return
        }

        if (key.name === 'return' || key.name === 'enter') {
          const activeModel = modelOptions[activeIndex]

          cleanup()
          resolve({
            message: currentValue.trim(),
            activeModel,
          })
          return
        }

        if (key.name === 'backspace') {
          currentValue = currentValue.slice(0, -1)
          renderCommitInput(currentValue, modelOptions[activeIndex])
          return
        }

        if (key.name === 'tab' && modelOptions.length > 0) {
          activeIndex = (activeIndex + 1) % modelOptions.length
          renderCommitInput(currentValue, modelOptions[activeIndex])
          return
        }

        if (isPrintableChunk(chunk, key)) {
          currentValue += chunk
          renderCommitInput(currentValue, modelOptions[activeIndex])
        }
      }

      function cleanup() {
        stdin.off('keypress', onKeypress)
        stdin.setRawMode(false)
        readline.clearLine(process.stdout, 0)
        readline.cursorTo(process.stdout, 0)
        process.stdout.write('\n')
      }

      renderCommitInput(currentValue, modelOptions[activeIndex])
      stdin.on('keypress', onKeypress)
    }
  )
}

export async function promptForGeneratedCommitAction(message: string) {
  process.stdout.write(`\n${chalk.bold('generated:')} ${message}\n`)

  if (!canUseRawInput()) {
    const response = await input({
      message: 'Accept generated commit message? [Y/n/r]',
    })

    return mapGeneratedCommitResponse(response)
  }

  return new Promise<'accept' | 'cancel' | 'regenerate'>((resolve, reject) => {
    const stdin = process.stdin

    readline.emitKeypressEvents(stdin)
    stdin.setRawMode(true)
    stdin.resume()
    process.stdout.write(
      'Press enter or y to accept, n to cancel, r to regenerate.\n'
    )

    function onKeypress(chunk: string, key: readline.Key) {
      if (key.ctrl && key.name === 'c') {
        cleanup()
        reject(new Error('Prompt cancelled.'))
        return
      }

      const action = mapGeneratedCommitResponse(key.name ?? chunk)

      if (!action) {
        return
      }

      cleanup()
      resolve(action)
    }

    function cleanup() {
      stdin.off('keypress', onKeypress)
      stdin.setRawMode(false)
    }

    stdin.on('keypress', onKeypress)
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

export async function promptForPostCommand(commandLabel: string) {
  return confirm({
    message: `Run post command: ${commandLabel}?`,
    default: true,
  })
}

function canUseRawInput() {
  return process.stdin.isTTY && typeof process.stdin.setRawMode === 'function'
}

function getInitialModelIndex(
  modelOptions: ModelOption[],
  defaultModel?: ModelOption
) {
  if (!defaultModel) {
    return 0
  }

  const index = modelOptions.findIndex((model) => model.id === defaultModel.id)

  return index >= 0 ? index : 0
}

function buildCommitPromptLabel(activeModel?: ModelOption) {
  const modelLabel = activeModel ? ` | model: ${activeModel.label}` : ''

  return `Commit message (enter = use typed message, empty = generate${modelLabel})`
}

function renderCommitInput(currentValue: string, activeModel?: ModelOption) {
  readline.clearLine(process.stdout, 0)
  readline.cursorTo(process.stdout, 0)
  process.stdout.write(`${buildCommitPromptLabel(activeModel)} ${currentValue}`)
}

function isPrintableChunk(chunk: string, key: readline.Key) {
  return (
    chunk.length > 0 &&
    !key.ctrl &&
    !key.meta &&
    key.name !== 'escape' &&
    key.name !== 'tab'
  )
}

function mapGeneratedCommitResponse(value: string) {
  const normalized = value.trim().toLowerCase()

  if (normalized === '' || normalized === 'enter' || normalized === 'y') {
    return 'accept'
  }

  if (normalized === 'n') {
    return 'cancel'
  }

  if (normalized === 'r') {
    return 'regenerate'
  }

  return undefined
}
