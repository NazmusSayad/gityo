import { mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

type LastUsedModel = {
  provider: string
  name: string
}

const stateFilePath = path.join(os.homedir(), '.config', 'gityo-state.json')

export async function getLastUsedModel() {
  const state = await readStateFile()

  if (!state || typeof state !== 'object') {
    return undefined
  }

  const value = (state as { lastUsedModel?: unknown }).lastUsedModel

  if (!value || typeof value !== 'object') {
    return undefined
  }

  const provider = (value as { provider?: unknown }).provider
  const name = (value as { name?: unknown }).name

  if (
    typeof provider !== 'string' ||
    provider.length === 0 ||
    typeof name !== 'string' ||
    name.length === 0
  ) {
    return undefined
  }

  return { provider, name }
}

export async function setLastUsedModel(model: LastUsedModel) {
  const directoryPath = path.dirname(stateFilePath)
  await mkdir(directoryPath, { recursive: true })

  const state = await readStateFile()
  const nextState =
    state && typeof state === 'object'
      ? { ...(state as Record<string, unknown>) }
      : {}

  nextState.lastUsedModel = model

  await writeFile(stateFilePath, `${JSON.stringify(nextState, null, 2)}\n`, 'utf8')
}

async function readStateFile() {
  let contents: string

  try {
    contents = await readFile(stateFilePath, 'utf8')
  } catch (error) {
    if (isMissingFileError(error)) {
      return undefined
    }

    throw error
  }

  try {
    return JSON.parse(contents)
  } catch {
    return undefined
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
