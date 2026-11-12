import { createClient } from '@libsql/client'

export function createDb() {
  const url = process.env.TURSO_DATABASE_URL
  const authToken = process.env.TURSO_AUTH_TOKEN

  if (!url) {
    throw new Error('TURSO_DATABASE_URL is missing. Check your main .env file.')
  }

  if (!authToken) {
    throw new Error('TURSO_AUTH_TOKEN is missing. Check your main .env file.')
  }

  return createClient({
    url,
    authToken
  })
}

export async function query(db, sql, args = []) {
  const result = await db.execute({ sql, args })
  return result.rows
}

export function isUniqueConstraint(error) {
  const code = String(error?.code || '')
  const message = String(error?.message || '')

  return (
    code.includes('SQLITE_CONSTRAINT') ||
    /UNIQUE constraint failed/i.test(message)
  )
}
