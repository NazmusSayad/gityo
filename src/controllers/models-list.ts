import { loadConfig } from '../lib/load-config'
import { listStoredApiKeys } from '../lib/secrets'

export async function listModelsController() {
  const [config, storedKeys] = await Promise.all([
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
    console.log('No configured model groups or stored API keys found.')
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

    console.log(
      `${provider}\n  key: ${maskApiKey(storedKey)}\n  models: ${modelNames.length > 0 ? modelNames.join(', ') : '(none configured)'}\n`
    )
  }
}

function maskApiKey(apiKey: string | null | undefined) {
  if (!apiKey) {
    return '(not set)'
  }

  if (apiKey.length <= 8) {
    return `${apiKey.slice(0, 2)}***`
  }

  return `${apiKey.slice(0, 4)}***${apiKey.slice(-4)}`
}
