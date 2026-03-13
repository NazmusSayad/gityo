import chalk from 'chalk'
import readline from 'node:readline'

export async function runWithLoading<T>(label: string, task: () => Promise<T>) {
  if (!process.stdout.isTTY) {
    return task()
  }

  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
  let index = 0

  const interval = setInterval(() => {
    readline.cursorTo(process.stdout, 0)
    process.stdout.write(
      `${chalk.cyan(frames[index])} ${chalk.cyan(label)} ${chalk.gray('...')}`
    )
    index = (index + 1) % frames.length
  }, 80)

  try {
    return await task()
  } finally {
    clearInterval(interval)
    readline.cursorTo(process.stdout, 0)
    readline.clearLine(process.stdout, 0)
  }
}
