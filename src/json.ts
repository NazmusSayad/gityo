import fs from 'fs'
import path from 'path'
import { generateJSONSchema } from './schema'

const outputPath = path.resolve('./schema.json')

if (fs.existsSync(outputPath)) {
  fs.rmSync(outputPath)
}

const jsonSchema = generateJSONSchema()
const jsonString = JSON.stringify(jsonSchema, null, 2)
fs.writeFileSync(outputPath, jsonString)
