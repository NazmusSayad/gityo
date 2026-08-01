import { Command } from '@commander-js/extra-typings'
import { showConfigController } from './controllers/config'
import { setConfigController } from './controllers/config-set'
import { setConfigModelController } from './controllers/config-set-model'
import { mainController } from './controllers/main'
import { resolveScope } from './helpers/resolve-scope'
import { handleError } from './lib/handle-error'

export const app = new Command()
  .name('gityo')
  .description(
    'Stage changes, generate or enter a commit message, create a commit, and run a post-commit git command.'
  )
  .option('-s, --stage', 'Stage all changes without asking.')
  .option('-g, --generate', 'Generate a commit message without asking.')
  .option(
    '-m, --message <message>',
    'Use the provided message as the commit message.'
  )
  .option('-p, --post', 'Run the post-commit git command without asking.')
  .option(
    '-y, --yolo',
    'Skip all questions, and stage, generate message, commit, run post command. [Will fail if no model available]'
  )
  .action((options) => {
    if (options.generate && options.message) {
      console.error('Cannot use --generate and --message together.')
      process.exit(1)
    }

    handleError(() => mainController(options))
  })

const configProgram = app
  .command('config')
  .description('View and update gityo configuration.')
  .action(() => {
    handleError(showConfigController)
  })

const configSetProgram = configProgram
  .command('set')
  .description(
    'Set a config value, or set model with provider, name, and API key.'
  )
  .option('-l, --local', 'Use the local config.')
  .option('-g, --global', 'Use the global config.')
  .argument('[key]', 'Config key to set.')
  .argument('[value]', 'Value to set the config key to.')
  .action((key, value, options) => {
    handleError(() =>
      setConfigController(
        resolveScope(options.global, options.local),
        key,
        value
      )
    )
  })

configSetProgram
  .command('model')
  .description('Set the model provider, name, and API key.')
  .option('-l, --local', 'Use the local config.')
  .option('-g, --global', 'Use the global config.')
  .argument('[provider]', 'Model provider.')
  .argument('[name]', 'Model name.')
  .argument('[apiKey]', 'API key for the provider.')
  .action((provider, name, apiKey, options) => {
    handleError(() =>
      setConfigModelController(
        resolveScope(options.global, options.local),
        provider,
        name,
        apiKey
      )
    )
  })
