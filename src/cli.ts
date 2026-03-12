import { NoArg } from 'noarg'
import { listModelsCommand, setModelKeyCommand } from './commands/models'
import { runCommand } from './commands/run'

export async function startCli(args: string[]) {
  const app = NoArg.create('gityo', {
    description:
      'Stage changes, generate or enter a commit message, create a commit, and run a post-commit git command.',
  }).on(() => {
    void runCommand().catch(handleFatalError)
  })

  const modelsProgram = app.create('models', {
    description: 'Manage configured models and stored API keys.',
    config: { skipGlobalFlags: true },
  })

  modelsProgram
    .create('set', {
      description:
        'Set or update a stored API key for a provider or custom base URL.',
      arguments: [{ name: 'provider', type: NoArg.string() }],
      optionalArguments: [{ name: 'api-key', type: NoArg.string() }],
    })
    .on(([provider, apiKey]) => {
      void setModelKeyCommand(provider, apiKey).catch(handleFatalError)
    })

  modelsProgram
    .create('list', {
      description: 'List configured model groups and any stored API keys.',
    })
    .on(() => {
      void listModelsCommand().catch(handleFatalError)
    })

  app.start(args)
}

function handleFatalError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error'

  if (message === 'Prompt cancelled.') {
    process.stderr.write('Cancelled.\n')
    return
  }

  process.stderr.write(`${message}\n`)
  process.exitCode = 1
}
