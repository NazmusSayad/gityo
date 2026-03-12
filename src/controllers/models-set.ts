import { loadConfig } from '../lib/load-config'
import { promptForApiKey, promptForProviderSelection } from '../lib/prompts'
import { setStoredApiKey } from '../lib/secrets'

export async function setModelsController(
  providerArgument?: string,
  apiKeyArgument?: string
) {
  const config = await loadConfig()
  const provider =
    providerArgument?.trim() ??
    (await promptForProviderSelection(
      Array.from(
        new Set([
          'anthropic',
          'google',
          'openai',
          'openrouter',
          ...Object.keys(config.models),
        ])
      )
    ))
  const apiKey = (apiKeyArgument ?? (await promptForApiKey(provider))).trim()

  await setStoredApiKey(provider, apiKey)

  console.log(`Stored API key for ${provider}.`)
}
