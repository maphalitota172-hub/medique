// Builds the two synthetic datasets used by the AI module. Seeded, so results are reproducible.
// Replace with real facility records when available (same column names).
import fs from 'node:fs'
let s = 42
const R = () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
const N = () => { let u = 0; for (let i = 0; i < 6; i++) u += R(); return (u - 3) / Math.sqrt(0.5) }
const pick = a => a[Math.floor(R() * a.length)]
fs.mkdirSync('public/data', { recursive: true })

const MULT = { consult: 1, pharmacy: 0.6, chronic: 1.4 }
const q = ['facility_type,service,hour,weekend,staff,queue_ahead,wait_min']
for (let i = 0; i < 4000; i++) {
  const hosp = R() < 0.55, service = pick(Object.keys(MULT)), hour = 7 + Math.floor(R() * 11), weekend = R() < 0.2 ? 1 : 0
  const staff = hosp ? 3 + Math.floor(R() * 5) : 1 + Math.floor(R() * 3), peak = hour >= 8 && hour <= 11
  const ahead = Math.max(0, Math.round(N() * 6 + (peak ? 18 : 9) * (weekend ? 0.6 : 1) * (hosp ? 1.3 : 0.8)))
  const wait = Math.max(1, 3 + (ahead / staff) * 9 * MULT[service] + (peak ? 5 : 0) - (weekend ? 2 : 0) + N() * 3)
  q.push([hosp ? 'hospital' : 'health_centre', service, hour, weekend, staff, ahead, wait.toFixed(1)].join(','))
}
fs.writeFileSync('public/data/queue_wait.csv', q.join('\n'))

const meds = { para: 60, amox: 25, metf: 18, aml: 15, ors: 20, salb: 6, cotri: 22, tld: 30 }
const k = ['medicine,daily_dispense,stock,days_since_restock,stockout_7d']
for (let i = 0; i < 3000; i++) {
  const m = pick(Object.keys(meds)), daily = +(meds[m] * (0.3 + R() * 1.2)).toFixed(1)
  const stock = Math.floor(R() * 450), dsr = Math.floor(R() * 45), cover = stock / daily
  const p = cover < 7 ? 0.93 : cover < 14 ? 0.25 : 0.04
  k.push([m, daily, stock, dsr, R() < p ? 1 : 0].join(','))
}
fs.writeFileSync('public/data/stock_levels.csv', k.join('\n'))
console.log('Wrote public/data/queue_wait.csv (4000 rows) and stock_levels.csv (3000 rows)')
