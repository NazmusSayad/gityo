import { Command } from '@commander-js/extra-typings'
import pkg from '../package.json'
import { showConfigController } from './controllers/config'
import { mainController } from './controllers/main'
import { handleError } from './lib/handle-error'

export const app = new Command()
  .name('gityo')
  .version(`v${pkg.version}`, '-v, --version', 'Show the current version.')
  .description(
    'Stage changes, generate or enter a commit message, create a commit, and run a post-commit git command.'
  )
  .option(
    '-g, --generate',
    'Generate a commit message and commit without asking.'
  )
  .option(
    '-i, --input <input>',
    'Use the provided input as the commit message.'
  )
  .option('-p, --post', 'Run the post-commit git command without asking.')
  .option(
    '-m, --model <model>',
    'Model key from config to use (defaults to "default").'
  )
  .option(
    '-y, --yolo',
    'Skip all questions, and generate message, commit, run post command. [Will fail if no model available]'
  )
  .action((options) => {
    if (options.generate && options.input) {
      console.error('Cannot use --generate and --input together.')
      process.exit(1)
    }

    handleError(() => mainController(options))
  })

app
  .command('config')
  .description('Show where to manage your gityo configuration.')
  .action(() => {
    handleError(showConfigController)
  })
