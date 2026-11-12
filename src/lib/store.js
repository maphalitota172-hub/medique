
import { useSyncExternalStore } from 'react'
import { FACILITIES, MEDICINES, seedStock } from './data'
import { GENESIS, mine, sha256 } from './chain'
import { DEFAULT_PERMS, can } from './security'

const KEY = 'mediqueue:v1'
const API = 'http://localhost:5000/api/state'

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('mediqueue:token') || ''}`
})

let databaseReady = false
let saveTimer = null
let saveQueue = Promise.resolve()

const fresh = () => ({
  role: 'patient',
  profile: { name: '', phone: '', ref: '' },
  queue: [],
  counters: {},
  stock: seedStock(),
  stockUpdatedAt: {},
  watch: [],
  notices: [],
  chain: [GENESIS],
  perms: DEFAULT_PERMS,
  config: {
    retentionDays: 30,
    consentRequired: true
  }
})

const purge = s => {
  const retentionDays = Number(s.config?.retentionDays) || 30
  const cut = Date.now() - retentionDays * 864e5

  return {
    ...s,
    queue: (s.queue || []).filter(
      t =>
        t.status === 'waiting' ||
        t.status === 'called' ||
        new Date(t.joined) > cut
    )
  }
}

const load = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY))
    if (saved) return purge({ ...fresh(), ...saved })
  } catch (error) {
    console.warn('Could not load local MediQueue data:', error)
  }

  return fresh()
}

let state = load()
const subs = new Set()

function notifySubscribers() {
  subs.forEach(listener => listener())
}

// Save the latest state to the browser and queue a MySQL save.
export function set(patch) {
  state = { ...state, ...patch }

  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch (error) {
    console.error('Local storage save failed:', error)
  }

  if (databaseReady) {
    clearTimeout(saveTimer)

    saveTimer = setTimeout(() => {
      saveToDatabase().catch(error => {
        console.error('MediQueue database save failed:', error)
      })
    }, 300)
  }

  notifySubscribers()
}

// Serialise saves so older requests cannot overwrite newer state.
function saveToDatabase() {
  const snapshot = JSON.stringify(state)

  saveQueue = saveQueue.then(async () => {
    const response = await fetch(API, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders()
      },
      body: snapshot
    })

    const result = await response.json().catch(() => ({}))

    if (!response.ok || !result.ok) {
      throw new Error(
        result.error || `Database save failed: HTTP ${response.status}`
      )
    }

    console.log('MediQueue data successfully saved to MySQL.')
    return true
  })

  return saveQueue
}

// Call this function after successful login.
export async function initializeDatabase() {
  databaseReady = false

  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }

  const token = localStorage.getItem('mediqueue:token')

  if (!token) {
    throw new Error('Please sign in before connecting to the database.')
  }

  try {
    const response = await fetch(API, {
      method: 'GET',
      headers: authHeaders()
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(data.error || 'Could not load database records.')
    }

    if (data.state) {
      state = purge({
        ...fresh(),
        ...data.state
      })

      localStorage.setItem(KEY, JSON.stringify(state))
      notifySubscribers()
    } else {
      // First initialisation: save existing local state.
      await saveToDatabase()
    }

    databaseReady = true

    console.log('MediQueue database synchronisation is active.')
    return true

  } catch (error) {
    databaseReady = false
    console.error('Database initialisation failed:', error)
    throw error
  }
}

// Wait for pending changes to be saved.
export async function flushDatabase() {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }

  if (!databaseReady) {
    throw new Error('Database synchronisation is not initialised.')
  }

  return saveToDatabase()
}

// Synchronise another browser tab.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', event => {
    if (event.key === KEY) {
      state = load()
      notifySubscribers()
    }
  })
}

export const useStore = () =>
  useSyncExternalStore(
    listener => {
      subs.add(listener)
      return () => subs.delete(listener)
    },
    () => state
  )

// ---------------- LEDGER ----------------

let q = Promise.resolve()

export const log = (type, data) => {
  q = q.then(async () => {
    const c = state.chain
    const block = await mine(c[c.length - 1], type, data)

    set({
      chain: [...state.chain, block]
    })
  })

  return q
}

// ---------------- HELPERS ----------------

export const facName = id =>
  FACILITIES.find(f => f.id === id)?.name ?? id

export const medName = id =>
  MEDICINES.find(m => m.id === id)?.name ?? id

export const waiting = (s, f) =>
  s.queue.filter(t => t.facility === f && t.status === 'waiting')

export const eta = (f, n) => {
  const facility = FACILITIES.find(x => x.id === f)
  return facility
    ? Math.round(3 + (n / facility.staff) * 9)
    : 0
}

const pseudo = async p =>
  (await sha256('mq-salt|' + p)).slice(0, 12)

const allow = (mod, level) => {
  if (can(state.perms, state.role, mod, level)) return true

  log('ACCESS_DENIED', {
    role: state.role,
    module: mod,
    level
  })

  return false
}

const notify = (ref, text) =>
  set({
    notices: [
      {
        id: Date.now() + Math.random(),
        ref,
        text,
        time: new Date().toISOString()
      },
      ...state.notices
    ].slice(0, 100)
  })

// ---------------- ACTIONS ----------------

export const setRole = role => set({ role })

export async function saveProfile({ name, phone }) {
  if (!allow('booking', 'write')) return

  const ref = await pseudo(phone)

  set({
    profile: { name, phone, ref }
  })

  log('PROFILE_CREATED', { ref })
}

export async function bookQueue({ facility, service }) {
  if (!allow('booking', 'write') || !state.profile.ref) return

  const n = (state.counters[facility] || 0) + 1

  const ticket = {
    id: `${facility}-${n}`,
    ticket: n,
    facility,
    service,
    name: state.profile.name,
    ref: state.profile.ref,
    status: 'waiting',
    joined: new Date().toISOString()
  }

  set({
    queue: [...state.queue, ticket],
    counters: {
      ...state.counters,
      [facility]: n
    }
  })

  log('QUEUE_BOOKED', {
    ticket: ticket.id,
    ref: ticket.ref
  })
}

export function cancelMine(id) {
  if (!allow('booking', 'write')) return

  const ticket = state.queue.find(
    x => x.id === id && x.ref === state.profile.ref
  )

  if (!ticket) return

  set({
    queue: state.queue.map(x =>
      x.id === id
        ? { ...x, status: 'cancelled' }
        : x
    )
  })

  log('QUEUE_CANCELLED', {
    ticket: id,
    ref: ticket.ref
  })
}

export function setStatus(id, status) {
  if (!allow('queue', 'write')) return

  const ticket = state.queue.find(x => x.id === id)
  if (!ticket) return

  set({
    queue: state.queue.map(x =>
      x.id === id
        ? { ...x, status }
        : x
    )
  })

  log('QUEUE_' + status.toUpperCase(), {
    ticket: id,
    ref: ticket.ref
  })

  if (status === 'called') {
    notify(
      ticket.ref,
      `Ticket ${ticket.ticket} at ${facName(ticket.facility)}: please go to the desk now.`
    )
  }
}

export function setStock(fid, mid, qty) {
  if (!allow('stock', 'write')) return

  qty = Number(qty)

  if (!Number.isInteger(qty) || qty < 0) {
    console.error('Stock quantity must be a non-negative whole number.')
    return
  }

  if (!state.stock[fid] || state.stock[fid][mid] === undefined) {
    console.error('Unknown facility or medicine.')
    return
  }

  const old = state.stock[fid][mid]

  if (old === qty) return

  set({
    stock: {
      ...state.stock,
      [fid]: {
        ...state.stock[fid],
        [mid]: qty
      }
    },
    stockUpdatedAt: {
      ...(state.stockUpdatedAt || {}),
      [fid]: {
        ...(state.stockUpdatedAt?.[fid] || {}),
        [mid]: new Date().toISOString()
      }
    }
  })

  log('STOCK_UPDATE', {
    facility: fid,
    medicine: mid,
    from: old,
    to: qty
  })

  const msg =
    old === 0 && qty > 0
      ? 'is now listed as in stock'
      : qty === 0
        ? 'is now out of stock'
        : null

  if (msg) {
    state.watch
      .filter(w => w.facility === fid && w.med === mid)
      .forEach(w =>
        notify(
          w.ref,
          `${medName(mid)} ${msg} at ${facName(fid)}. Availability can change, and this does not guarantee it will be dispensed.`
        )
      )
  }
}

export function toggleWatch(facility, med) {
  if (!allow('booking', 'write') || !state.profile.ref) return

  const ref = state.profile.ref

  const has = state.watch.some(
    w =>
      w.ref === ref &&
      w.facility === facility &&
      w.med === med
  )

  set({
    watch: has
      ? state.watch.filter(
          w =>
            !(w.ref === ref &&
              w.facility === facility &&
              w.med === med)
        )
      : [...state.watch, { ref, facility, med }]
  })
}

export const exportMine = () => {
  const ref = state.profile.ref

  return JSON.stringify({
    profile: state.profile,
    tickets: state.queue.filter(t => t.ref === ref),
    watch: state.watch.filter(w => w.ref === ref),
    notices: state.notices.filter(n => n.ref === ref)
  }, null, 2)
}

export function deleteMine() {
  const ref = state.profile.ref

  set({
    queue: state.queue.filter(t => t.ref !== ref),
    watch: state.watch.filter(w => w.ref !== ref),
    notices: state.notices.filter(n => n.ref !== ref),
    profile: {
      name: '',
      phone: '',
      ref: ''
    }
  })

  log('DATA_ERASED', { ref })
}

export function setPerm(role, mod, level) {
  if (!allow('security', 'write')) return

  set({
    perms: {
      ...state.perms,
      [role]: {
        ...state.perms[role],
        [mod]: level
      }
    }
  })

  log('PERMISSION_CHANGE', {
    by: state.role,
    role,
    module: mod,
    level
  })
}

export function setConfig(patch) {
  if (!allow('security', 'write')) return

  set({
    config: {
      ...state.config,
      ...patch
    }
  })

  log('CONFIG_CHANGE', patch)
}

export const resetAll = () => {
  if (allow('security', 'write')) {
    set({
      ...fresh(),
      role: state.role
    })
  }
}
