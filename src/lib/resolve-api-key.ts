export function resolveApiKey(apiKeyEnv: string | string[] | undefined) {
  if (!apiKeyEnv) {
    return null
  }

  const envVars = Array.isArray(apiKeyEnv) ? apiKeyEnv : [apiKeyEnv]

  for (const name of envVars) {
    const value = process.env[name]

    if (value !== undefined && value.length > 0) {
      return value
    }
  }

  return null
}
