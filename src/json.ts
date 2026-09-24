import fs from 'fs'
import path from 'path'
import { configSchema } from './schema.js'

const outputPath = path.resolve('./schema.json')

if (fs.existsSync(outputPath)) {
  fs.rmSync(outputPath)
}

const jsonSchema = configSchema.toJSONSchema()
const jsonString = JSON.stringify(jsonSchema, null, 2)
fs.writeFileSync(outputPath, jsonString)
