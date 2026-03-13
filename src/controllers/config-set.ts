import {
  readGlobalConfig,
  readProjectConfig,
  writeGlobalConfig,
  writeProjectConfig,
} from '../lib/load-config'

export async function setConfigController(
  scope: 'local' | 'global',
  keyArgument?: string,
  valueArgument?: string
) {
  const key = keyArgument?.trim()
  const rawValue = valueArgument?.trim()
  const target = scope

  if (!key) {
    throw new Error('Usage: config set <key> <value>')
  }

  if (key === 'model') {
    throw new Error('Use: config set model [provider] [name] [apiKey]')
  }

  if (
    key !== 'autoAcceptCommitMessage' &&
    key !== 'autoRunPostCommand' &&
    key !== 'postCommand' &&
    key !== 'customInstructions'
  ) {
    throw new Error(
      `Unsupported key '${key}'. Use autoAcceptCommitMessage, autoRunPostCommand, postCommand, customInstructions, or model.`
    )
  }

  if (!rawValue) {
    throw new Error(
      `Missing value for '${key}'. Usage: config set ${key} <value>`
    )
  }

  const config =
    target === 'local'
      ? ((await readProjectConfig(process.cwd())) ?? {})
      : ((await readGlobalConfig()) ?? {})

  if (key === 'autoAcceptCommitMessage') {
    config.autoAcceptMessage = parseBoolean(rawValue)
  }

  if (key === 'autoRunPostCommand') {
    config.autoRunPostCommand = parseBoolean(rawValue)
  }

  if (key === 'postCommand') {
    if (rawValue !== 'push' && rawValue !== 'push-and-pull') {
      throw new Error("Invalid postCommand. Use 'push' or 'push-and-pull'.")
    }

    config.postCommand = rawValue
  }

  if (key === 'customInstructions') {
    if (rawValue.length === 0) {
      throw new Error('customInstructions cannot be empty.')
    }

    config.instructions = rawValue
  }

  if (target === 'local') {
    await writeProjectConfig(process.cwd(), config)
  } else {
    await writeGlobalConfig(config)
  }

  console.log(`Updated ${key} in ${target} config.`)
}

function parseBoolean(value: string) {
  const normalized = value.trim().toLowerCase()

  if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
    return true
  }

  if (normalized === 'false' || normalized === '0' || normalized === 'no') {
    return false
  }

  throw new Error(`Invalid boolean value '${value}'. Use true or false.`)
}
