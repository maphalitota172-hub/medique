export const ROLES = ['patient', 'clerk', 'pharmacist', 'admin']
export const LEVELS = ['none', 'read', 'write']
export const MODULES = [
  ['booking', 'Book and track own queue ticket'],
  ['queue', 'Queue desk (call, complete, no-show)'],
  ['stock', 'Medicine stock'],
  ['ledger', 'Blockchain ledger'],
  ['analytics', 'AI insights (write = retrain)'],
  ['security', 'Security configuration']
]
export const DEFAULT_PERMS = {
  patient:    { booking: 'write', queue: 'none',  stock: 'read',  ledger: 'none', analytics: 'none',  security: 'none' },
  clerk:      { booking: 'none',  queue: 'write', stock: 'read',  ledger: 'read', analytics: 'read',  security: 'none' },
  pharmacist: { booking: 'none',  queue: 'read',  stock: 'write', ledger: 'read', analytics: 'read',  security: 'none' },
  admin:      { booking: 'none',  queue: 'read',  stock: 'read',  ledger: 'write', analytics: 'write', security: 'write' }
}
const rank = { none: 0, read: 1, write: 2 }
export const can = (perms, role, mod, level) => rank[perms?.[role]?.[mod] ?? 'none'] >= rank[level]

// Part C1: data classification (also exported to docs/data_classification.csv)
export const DATA_CLASSIFICATION = [
  { item: 'Facility names, towns and services', cls: 'public', where: 'Facility lists', controls: 'None needed; integrity checked on release' },
  { item: 'Medicine availability status per facility (In stock, Low, Out)', cls: 'public', where: 'Medicines tab', controls: 'Status only; exact quantities hidden from patients' },
  { item: 'Queue length and estimated wait (no identities)', cls: 'public', where: 'Booking form, Medicines tab', controls: 'Aggregated counts only' },
  { item: 'Patient name and phone number', cls: 'private', where: 'Profile, queue ticket', controls: 'Consent, role-based access, retention limit, erasure on request' },
  { item: 'Queue ticket linked to a person', cls: 'private', where: 'Queue desk, My tickets', controls: 'Only the owner and queue clerks can see identity' },
  { item: 'Medicine watch list (which medicine a patient follows)', cls: 'confidential', where: 'Stock notifications', controls: 'Owner-only; can imply a health condition' },
  { item: 'Staff accounts and role assignments', cls: 'confidential', where: 'Security module', controls: 'Admin only' },
  { item: 'Blockchain ledger entries (pseudonymous hashes)', cls: 'confidential', where: 'Ledger tab', controls: 'No direct identifiers on chain; staff read-only' },
  { item: 'Chronic care service type on a ticket (e.g. HIV care)', cls: 'restricted', where: 'Queue ticket', controls: 'Special-category health data; visible only to queue clerks, never written to the chain' },
  { item: 'Permission matrix and security settings', cls: 'restricted', where: 'Security module', controls: 'Admin write, changes logged to the ledger' },
  { item: 'AI training datasets', cls: 'private', where: 'Insights', controls: 'Synthetic or aggregated; no personal records' }
]

// Part C3: GDPR compliance levels for this prototype
export const GDPR_CHECKS = [
  { article: 'Art. 5(1)(c) Data minimisation', status: 'Compliant', evidence: 'Only name and phone are collected; no ID numbers or addresses.' },
  { article: 'Art. 6 and 7 Lawful basis and consent', status: 'Compliant', evidence: 'Explicit consent checkbox before profile creation (configurable).' },
  { article: 'Art. 5(1)(e) Storage limitation', status: 'Compliant', evidence: 'Finished tickets are purged after the configured retention period.' },
  { article: 'Art. 15 and 20 Access and portability', status: 'Compliant', evidence: '"Download my data" exports profile, tickets, watch list and notices as JSON.' },
  { article: 'Art. 17 Right to erasure', status: 'Partial', evidence: 'Off-chain data is erased. Ledger keeps only a pseudonymous hash, which cannot be deleted.' },
  { article: 'Art. 25 Privacy by design', status: 'Compliant', evidence: 'Pseudonymised ledger, role-based access, restricted classes hidden by default.' },
  { article: 'Art. 9 Special category (health) data', status: 'Partial', evidence: 'Classified as restricted, but stored unencrypted in browser storage in this prototype.' },
  { article: 'Art. 13 Transparency', status: 'Partial', evidence: 'Short consent text only; a full privacy notice is still needed.' },
  { article: 'Art. 30 Records of processing', status: 'Partial', evidence: 'The classification register covers data items; processing purposes not yet documented.' },
  { article: 'Art. 32 Security of processing', status: 'Partial', evidence: 'RBAC and tamper-evident ledger exist; real authentication, TLS and encryption at rest are not built.' },
  { article: 'Art. 33 Breach notification', status: 'Gap', evidence: 'No incident response or 72-hour notification procedure.' },
  { article: 'Art. 35 Data protection impact assessment', status: 'Gap', evidence: 'No DPIA completed for health data processing.' }
]
export const gdprScore = () =>
  Math.round(100 * GDPR_CHECKS.reduce((a, c) => a + ({ Compliant: 1, Partial: 0.5, Gap: 0 }[c.status]), 0) / GDPR_CHECKS.length)
