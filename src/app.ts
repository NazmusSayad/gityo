import { NoArg } from 'noarg'
import { mainController } from './controllers/main'
import { listModelsController } from './controllers/models-list'
import { setModelsController } from './controllers/models-set'
import { handleError } from './lib/handle-error'

export const app = NoArg.create('gityo', {
  description:
    'Stage changes, generate or enter a commit message, create a commit, and run a post-commit git command.',
}).on(async () => handleError(mainController))

const modelsProgram = app.create('models', {
  description: 'Manage configured models and stored API keys.',
  config: { skipGlobalFlags: true },
})

modelsProgram
  .create('list', {
    description: 'List configured model groups and any stored API keys.',
  })
  .on(() => handleError(listModelsController))

modelsProgram
  .create('set', {
    description:
      'Set or update a stored API key for a provider or custom base URL.',
    arguments: [{ name: 'provider', type: NoArg.string() }],
    optionalArguments: [{ name: 'api-key', type: NoArg.string() }],
  })
  .on(async ([provider, apiKey]) => {
    handleError(() => setModelsController(provider, apiKey))
  })
