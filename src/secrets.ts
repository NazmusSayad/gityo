const SERVICE_NAME = 'gityo'

export async function getStoredApiKey(provider: string) {
  const keytar = await loadKeytar()

  return keytar.getPassword(SERVICE_NAME, provider)
}

export async function setStoredApiKey(provider: string, apiKey: string) {
  const keytar = await loadKeytar()

  await keytar.setPassword(SERVICE_NAME, provider, apiKey)
}

export async function listStoredApiKeys() {
  const keytar = await loadKeytar()
  const credentials = await keytar.findCredentials(SERVICE_NAME)

  return credentials
    .map((credential) => ({
      provider: credential.account,
      apiKey: credential.password,
    }))
    .sort((left, right) => left.provider.localeCompare(right.provider))
}

export function maskApiKey(apiKey: string | null | undefined) {
  if (!apiKey) {
    return '(not set)'
  }

  if (apiKey.length <= 8) {
    return `${apiKey.slice(0, 2)}***`
  }

  return `${apiKey.slice(0, 4)}***${apiKey.slice(-4)}`
}

async function loadKeytar() {
  try {
    const keytarModule = await import('keytar')

    if (
      'findCredentials' in keytarModule &&
      typeof keytarModule.findCredentials === 'function'
    ) {
      return keytarModule
    }

    if (
      'default' in keytarModule &&
      keytarModule.default &&
      typeof keytarModule.default === 'object' &&
      'findCredentials' in keytarModule.default
    ) {
      return keytarModule.default
    }

    throw new Error('Unable to load keytar exports.')
  } catch {
    throw new Error(
      'Secure API key storage is unavailable. Reinstall dependencies and ensure keytar can build or download its native binary.'
    )
  }
}
