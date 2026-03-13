import { mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { configSchema, resolveConfig } from '../schema'

const PROJECT_CONFIG_FILE_NAME = '.gityo.config.json'
const GLOBAL_CONFIG_FILE_PATH = path.join(os.homedir(), '.config', 'gityo.json')

export async function loadConfig(cwd = process.cwd()) {
  const [globalConfig, projectConfig, projectInstructions] = await Promise.all([
    readGlobalConfig(),
    readProjectConfig(cwd),
    readInstructionsFile(path.join(cwd, '.gityo.instructions.md')),
  ])

  return resolveConfig({
    ...(globalConfig ?? {}),
    ...(projectConfig ?? {}),
    customInstructions:
      projectInstructions ??
      projectConfig?.instructions ??
      globalConfig?.instructions,
  })
}

export async function readProjectConfig(cwd = process.cwd()) {
  return readConfigFile(path.join(cwd, PROJECT_CONFIG_FILE_NAME))
}

export async function readGlobalConfig() {
  return readConfigFile(GLOBAL_CONFIG_FILE_PATH)
}

export async function writeProjectConfig(cwd = process.cwd(), config: unknown) {
  const configPath = path.join(cwd, PROJECT_CONFIG_FILE_NAME)
  await writeConfigFile(configPath, config)
}

export async function writeGlobalConfig(config: unknown) {
  await writeConfigFile(GLOBAL_CONFIG_FILE_PATH, config)
}

async function writeConfigFile(configPath: string, config: unknown) {
  const result = configSchema.safeParse(config)

  if (!result.success) {
    throw new Error(`Invalid config update: ${result.error.message}`)
  }

  await mkdir(path.dirname(configPath), { recursive: true })

  await writeFile(
    configPath,
    `${JSON.stringify(result.data, null, 2)}\n`,
    'utf8'
  )
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

async function readInstructionsFile(filePath: string) {
  let contents: string

  try {
    contents = await readFile(filePath, 'utf8')
  } catch (error) {
    if (isMissingFileError(error)) {
      return undefined
    }

    throw error
  }

  const value = contents.trim()

  return value.length > 0 ? value : undefined
}

function isMissingFileError(error: unknown) {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof error.code === 'string' &&
    error.code === 'ENOENT'
  )
}
