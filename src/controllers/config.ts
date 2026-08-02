import path from 'node:path'
import {
  GLOBAL_CONFIG_FILE_PATH,
  PROJECT_CONFIG_FILE_NAME,
} from '../lib/load-config'

export const CONFIG_SCHEMA_URL =
  'https://github.com/NazmusSayad/gityo/raw/refs/heads/schema/schema.json'

export async function showConfigController() {
  const projectConfigPath = path.join(process.cwd(), PROJECT_CONFIG_FILE_NAME)

  console.log(`Project config: ${projectConfigPath}`)
  console.log(`Global config:  ${GLOBAL_CONFIG_FILE_PATH}`)
  console.log('')
  console.log('Edit one of these files to manage your config.')
  console.log(
    'Set "$schema" in your config file to get autocompletion and validation:'
  )
  console.log(CONFIG_SCHEMA_URL)
}
