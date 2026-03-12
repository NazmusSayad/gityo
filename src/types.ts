export type PostCommand = 'push' | 'push-and-pull'

export type ModelConfigEntry =
  | string
  | {
      name: string
      reasoning?: boolean | string
    }

export type ModelGroupConfig = Record<string, ModelConfigEntry[]>

export interface GityoConfig {
  models: ModelGroupConfig
  defaultModel?: string
  autoAcceptCommitMessage: boolean
  postCommand: PostCommand
  autoRunPostCommand: boolean
  customInstructions?: string
}

export interface LoadedConfig {
  config: GityoConfig
  paths: {
    globalConfigPath: string
    projectConfigPath: string
    projectInstructionsPath: string
  }
}

export interface RepositoryState {
  branch: string
  files: string[]
}

export interface ModelOption {
  id: string
  label: string
  kind: 'anthropic' | 'google' | 'openai' | 'openai-compatible'
  provider: string
  name: string
  baseUrl?: string
  reasoning?: boolean | string
}
