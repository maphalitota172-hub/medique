import dotenv from 'dotenv'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDb } from '../server/db.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

dotenv.config({
  path: path.join(root, '.env'),
  override: true
})

const schemaPath = path.join(root, 'database.turso.sql')
const sql = await fs.readFile(schemaPath, 'utf8')
const db = createDb()

await db.executeMultiple(sql)

const tables = await db.execute(
  "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
)

console.log('Turso schema applied. Tables:')
for (const row of tables.rows) {
  console.log(` - ${row.name}`)
}
