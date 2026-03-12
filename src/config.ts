import { readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { z } from 'zod'
import type { GityoConfig, LoadedConfig, ModelConfigEntry } from './types'

const modelEntrySchema = z.union([
  z.string().min(1),
  z.object({
    name: z.string().min(1),
    reasoning: z.union([z.boolean(), z.string().min(1)]).optional(),
  }),
])

const configFileSchema = z.object({
  models: z.record(z.string().min(1), z.array(modelEntrySchema)).optional(),
  defaultModel: z.string().min(1).optional(),
  autoAcceptCommitMessage: z.boolean().optional(),
  postCommand: z.enum(['push', 'push-and-pull']).optional(),
  autoRunPostCommand: z.boolean().optional(),
  customInstructions: z.string().min(1).optional(),
})

export async function loadConfig(cwd = process.cwd()): Promise<LoadedConfig> {
  const paths = getConfigPaths(cwd)
  const [globalConfig, projectConfig, projectInstructions] = await Promise.all([
    readConfigFile(paths.globalConfigPath),
    readConfigFile(paths.projectConfigPath),
    readInstructionsFile(paths.projectInstructionsPath),
  ])

  const config = mergeConfigs(globalConfig, projectConfig, projectInstructions)

  return { config, paths }
}

export function getConfigPaths(cwd = process.cwd()) {
  return {
    globalConfigPath: path.join(os.homedir(), '.config', 'gityo.json'),
    projectConfigPath: path.join(cwd, '.gityo.config.json'),
    projectInstructionsPath: path.join(cwd, '.gityo.instructions.md'),
  }
}

async function readConfigFile(filePath: string) {
  const contents = await readOptionalFile(filePath)

  if (contents === undefined) {
    return undefined
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(contents)
  } catch (error) {
    throw new Error(formatFileError(filePath, getErrorMessage(error)))
  }

  const result = configFileSchema.safeParse(parsed)

  if (!result.success) {
    throw new Error(formatFileError(filePath, result.error.message))
  }

  return result.data
}

async function readInstructionsFile(filePath: string) {
  const contents = await readOptionalFile(filePath)

  if (contents === undefined) {
    return undefined
  }

  const value = contents.trim()

  return value.length > 0 ? value : undefined
}

async function readOptionalFile(filePath: string) {
  try {
    return await readFile(filePath, 'utf8')
  } catch (error) {
    if (isMissingFileError(error)) {
      return undefined
    }

    throw error
  }
}

function mergeConfigs(
  globalConfig: Partial<GityoConfig> | undefined,
  projectConfig: Partial<GityoConfig> | undefined,
  projectInstructions: string | undefined
): GityoConfig {
  const mergedModels = mergeModels(globalConfig?.models, projectConfig?.models)

  return {
    models: mergedModels,
    defaultModel: projectConfig?.defaultModel ?? globalConfig?.defaultModel,
    autoAcceptCommitMessage:
      projectConfig?.autoAcceptCommitMessage ??
      globalConfig?.autoAcceptCommitMessage ??
      false,
    postCommand:
      projectConfig?.postCommand ?? globalConfig?.postCommand ?? 'push',
    autoRunPostCommand:
      projectConfig?.autoRunPostCommand ??
      globalConfig?.autoRunPostCommand ??
      false,
    customInstructions:
      projectInstructions ??
      projectConfig?.customInstructions ??
      globalConfig?.customInstructions,
  }
}

function mergeModels(
  globalModels: Record<string, ModelConfigEntry[]> | undefined,
  projectModels: Record<string, ModelConfigEntry[]> | undefined
) {
  return {
    ...(globalModels ?? {}),
    ...(projectModels ?? {}),
  }
}

function isMissingFileError(error: unknown) {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof error.code === 'string' &&
    error.code === 'ENOENT'
  )
}

function formatFileError(filePath: string, message: string) {
  return `Invalid config in ${filePath}: ${message}`
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error'
}
