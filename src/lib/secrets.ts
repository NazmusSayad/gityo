const SERVICE_NAME = 'gityo'
import * as keytar from 'keytar'

export async function getStoredApiKey(provider: string) {
  return keytar.getPassword(SERVICE_NAME, provider)
}

export async function setStoredApiKey(provider: string, apiKey: string) {
  await keytar.setPassword(SERVICE_NAME, provider, apiKey)
}

export async function listStoredApiKeys() {
  const credentials = await keytar.findCredentials(SERVICE_NAME)

  return credentials.map((credential) => ({
    provider: credential.account,
    apiKey: credential.password,
  }))
}
