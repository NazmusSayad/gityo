import chalk from 'chalk'
import { AppUserCanceledError } from './errors'

export function handleError(fn: () => Promise<void> | void) {
  Promise.resolve()
    .then(fn)
    .catch((err) => {
      if (err instanceof AppUserCanceledError) {
        return console.log('Cancelled.')
      }

      if (err instanceof Error) {
        console.error(chalk.red('ERROR:'), err.message)
        process.exit(1)
      }
    })
}
