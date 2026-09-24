import { readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { configSchema, resolveConfig } from '../schema.js'

export const PROJECT_CONFIG_FILE_NAME = '.gityo.json'
export const GLOBAL_CONFIG_FILE_PATH = path.join(
  os.homedir(),
  '.config',
  'gityo.json'
)

export async function loadConfig(cwd = process.cwd()) {
  const [globalConfig, projectConfig] = await Promise.all([
    readGlobalConfig(),
    readProjectConfig(cwd),
  ])

  return resolveConfig({
    ...(globalConfig ?? {}),
    ...(projectConfig ?? {}),
    models: {
      ...globalConfig?.models,
      ...projectConfig?.models,
    },
    commitStyles: {
      ...globalConfig?.commitStyles,
      ...projectConfig?.commitStyles,
    },
    prTitleStyles: {
      ...globalConfig?.prTitleStyles,
      ...projectConfig?.prTitleStyles,
    },
    prBodyStyles: {
      ...globalConfig?.prBodyStyles,
      ...projectConfig?.prBodyStyles,
    },
  })
}

async function readProjectConfig(cwd = process.cwd()) {
  return readConfigFile(path.join(cwd, PROJECT_CONFIG_FILE_NAME))
}

async function readGlobalConfig() {
  return readConfigFile(GLOBAL_CONFIG_FILE_PATH)
}

async function readConfigFile(filePath: string) {
  let contents: string

  try {
    contents = await readFile(filePath, 'utf8')
  } catch (error) {
    if (isMissingFileError(error)) {
      return undefined
    }

    throw error
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(contents)
  } catch (error) {
    throw new Error(
      `Invalid config in ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }

  const result = configSchema.safeParse(parsed)

  if (!result.success) {
    throw new Error(`Invalid config in ${filePath}: ${result.error.message}`)
  }

  return result.data
}

function isMissingFileError(error: unknown) {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof error.code === 'string' &&
    error.code === 'ENOENT'
  )
}
