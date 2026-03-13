import { SUPPORTED_PROVIDERS } from '@/schema'
import {
  readGlobalConfig,
  readProjectConfig,
  writeGlobalConfig,
  writeProjectConfig,
} from '../lib/load-config'
import {
  promptForApiKey,
  promptForModelName,
  promptForProviderSelection,
} from '../lib/prompts'
import { setStoredApiKey } from '../lib/secrets'

export async function setConfigModelController(
  scope: 'local' | 'global',
  providerArgument?: string,
  modelNameArgument?: string,
  apiKeyArgument?: string
) {
  const target = scope

  const config =
    target === 'local'
      ? ((await readProjectConfig(process.cwd())) ?? {})
      : ((await readGlobalConfig()) ?? {})

  const provider =
    providerArgument?.trim() ??
    (await promptForProviderSelection([
      ...SUPPORTED_PROVIDERS,
      ...(config.model ? [config.model.provider] : []),
    ]))

  const name = (modelNameArgument ?? (await promptForModelName())).trim()
  const apiKey = (apiKeyArgument ?? (await promptForApiKey(provider))).trim()

  config.model = {
    provider,
    name,
    reasoning: config.model?.reasoning ?? false,
  }

  if (target === 'local') {
    await Promise.all([
      writeProjectConfig(process.cwd(), config),
      setStoredApiKey(provider, apiKey),
    ])
  } else {
    await Promise.all([
      writeGlobalConfig(config),
      setStoredApiKey(provider, apiKey),
    ])
  }

  console.log(`Updated model in ${target} config to ${provider}:${name}.`)
}
