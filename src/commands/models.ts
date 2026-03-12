import { loadConfig } from '../config'
import { getConfiguredProviders } from '../models'
import { promptForApiKey, promptForProviderSelection } from '../prompts'
import { listStoredApiKeys, maskApiKey, setStoredApiKey } from '../secrets'

export async function setModelKeyCommand(
  providerArgument?: string,
  apiKeyArgument?: string
) {
  const { config } = await loadConfig()
  const provider = await resolveProvider(providerArgument, config)
  const apiKey = (apiKeyArgument ?? (await promptForApiKey(provider))).trim()

  await setStoredApiKey(provider, apiKey)

  process.stdout.write(`Stored API key for ${provider}.\n`)
}

export async function listModelsCommand() {
  const [{ config }, storedKeys] = await Promise.all([
    loadConfig(),
    listStoredApiKeys(),
  ])

  const providers = Array.from(
    new Set([
      ...Object.keys(config.models),
      ...storedKeys.map((key) => key.provider),
    ])
  ).sort((left, right) => left.localeCompare(right))

  if (providers.length === 0) {
    process.stdout.write(
      'No configured model groups or stored API keys found.\n'
    )
    return
  }

  for (const provider of providers) {
    const models = config.models[provider] ?? []
    const storedKey = storedKeys.find(
      (entry) => entry.provider === provider
    )?.apiKey
    const modelNames = models.map((entry) =>
      typeof entry === 'string' ? entry : entry.name
    )

    process.stdout.write(`${provider}\n`)
    process.stdout.write(`  key: ${maskApiKey(storedKey)}\n`)
    process.stdout.write(
      `  models: ${modelNames.length > 0 ? modelNames.join(', ') : '(none configured)'}\n\n`
    )
  }
}

async function resolveProvider(
  providerArgument: string | undefined,
  config: Awaited<ReturnType<typeof loadConfig>>['config']
) {
  if (providerArgument) {
    return providerArgument.trim()
  }

  return promptForProviderSelection(getConfiguredProviders(config))
}
