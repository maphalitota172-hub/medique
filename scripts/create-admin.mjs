import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import { createDb, query } from '../server/db.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

dotenv.config({
  path: path.join(root, '.env'),
  override: true
})

const {
  ADMIN_NAME,
  ADMIN_EMAIL,
  ADMIN_PASSWORD
} = process.env

if (
  !ADMIN_NAME ||
  !ADMIN_EMAIL ||
  !ADMIN_PASSWORD ||
  ADMIN_PASSWORD.length < 8
) {
  console.error(
    'Set ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD (8+ characters) in .env first.'
  )
  process.exit(1)
}

const db = createDb()

try {
  const roles = await query(
    db,
    'SELECT role_id FROM roles WHERE role_name = ? LIMIT 1',
    ['admin']
  )

  if (!roles.length) {
    throw new Error(
      'The admin role is missing from the roles table.'
    )
  }

  const email = ADMIN_EMAIL.trim().toLowerCase()
  const hash = await bcrypt.hash(ADMIN_PASSWORD, 12)

  const usernameBase = (email.split('@')[0] || 'admin')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 45) || 'admin'

  const username = `${usernameBase}_${randomBytes(4).toString('hex')}`

  const existing = await query(
    db,
    'SELECT user_id FROM users WHERE email = ? LIMIT 1',
    [email]
  )

  if (existing.length) {
    await db.execute({
      sql: `UPDATE users
       SET
         full_name = ?,
         password_hash = ?,
         role_id = ?,
         account_status = 'active',
         updated_at = datetime('now')
       WHERE user_id = ?`,
      args: [
        ADMIN_NAME,
        hash,
        roles[0].role_id,
        existing[0].user_id
      ]
    })
  } else {
    await db.execute({
      sql: `INSERT INTO users
       (
         role_id,
         full_name,
         username,
         email,
         password_hash,
         account_status
       )
       VALUES (?, ?, ?, ?, ?, 'active')`,
      args: [
        roles[0].role_id,
        ADMIN_NAME,
        username,
        email,
        hash
      ]
    })
  }

  console.log(`Administrator account ready: ${email}`)

} catch (error) {
  console.error('Admin creation failed:', error.message)
  process.exitCode = 1
}
