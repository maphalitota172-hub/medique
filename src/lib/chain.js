// Local educational proof-of-work audit chain for MediQueue.
// Uses SHA-256 hashing, a Merkle root, nonce mining and previous-block links.
// Ethereum Sepolia anchoring is implemented separately in src/lib/ethereum.js.
export const DIFFICULTY = 3
export const GENESIS = {
  index: 0,
  time: '2026-01-01T00:00:00.000Z',
  type: 'GENESIS',
  data: {},
  prev: '0',
  nonce: 0,
  hash: '0'.repeat(64),
  version: 1,
  merkleRoot: '0'.repeat(64),
  difficulty: DIFFICULTY
}

const hex = bytes =>
  [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('')

export async function sha256(text) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text)
  )
  return hex(digest)
}

// Double SHA-256 is used here to demonstrate a proof-of-work block header.
export async function doubleSha256(text) {
  const first = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text)
  )
  const second = await crypto.subtle.digest('SHA-256', first)
  return hex(second)
}

const transactionHash = async transaction =>
  doubleSha256(JSON.stringify(transaction))

export async function merkleRoot(transactions) {
  if (!transactions.length) return '0'.repeat(64)
  let level = await Promise.all(transactions.map(transactionHash))

  while (level.length > 1) {
    if (level.length % 2) level.push(level[level.length - 1])
    const next = []
    for (let i = 0; i < level.length; i += 2) {
      next.push(await doubleSha256(level[i] + level[i + 1]))
    }
    level = next
  }
  return level[0]
}

const legacyBody = b =>
  `${b.index}|${b.time}|${b.type}|${JSON.stringify(b.data)}|${b.prev}|${b.nonce}`

const powHeader = b =>
  `${b.version}|${b.index}|${b.time}|${b.merkleRoot}|${b.prev}|${b.difficulty}|${b.nonce}`

const meetsTarget = (hash, difficulty) =>
  hash.startsWith('0'.repeat(difficulty))

export async function mine(prev, type, data) {
  const transaction = { type, data, time: new Date().toISOString() }
  const b = {
    index: prev.index + 1,
    time: transaction.time,
    type,
    data,
    prev: prev.hash,
    nonce: 0,
    version: 1,
    merkleRoot: await merkleRoot([transaction]),
    difficulty: DIFFICULTY
  }

  for (;;) {
    b.hash = await doubleSha256(powHeader(b))
    if (meetsTarget(b.hash, b.difficulty)) return b
    b.nonce++
  }
}

export async function validate(chain) {
  if (!Array.isArray(chain) || chain.length === 0) {
    return { ok: false, at: 0, why: 'chain is empty' }
  }

  for (let i = 1; i < chain.length; i++) {
    const b = chain[i]
    const previous = chain[i - 1]

    if (b.prev !== previous.hash) {
      return { ok: false, at: i, why: 'link to previous block is broken' }
    }

    // Keep compatibility with blocks created by the earlier project version.
    if (b.version === undefined) {
      if ((await sha256(legacyBody(b))) !== b.hash ||
          !b.hash.startsWith('0'.repeat(2))) {
        return { ok: false, at: i, why: 'legacy block contents do not match its hash' }
      }
      continue
    }

    const expectedRoot = await merkleRoot([{
      type: b.type,
      data: b.data,
      time: b.time
    }])

    if (expectedRoot !== b.merkleRoot) {
      return { ok: false, at: i, why: 'transaction Merkle root is invalid' }
    }

    const expectedHash = await doubleSha256(powHeader(b))
    if (expectedHash !== b.hash || !meetsTarget(b.hash, b.difficulty)) {
      return { ok: false, at: i, why: 'proof-of-work or block hash is invalid' }
    }
  }

  return { ok: true }
}
