
import { useEffect, useState } from 'react'
import {
  useStore,
  setRole,
  saveProfile,
  bookQueue,
  cancelMine,
  setStatus,
  setStock,
  toggleWatch,
  exportMine,
  deleteMine,
  waiting,
  eta,
  facName,
  medName
} from './lib/store.js'

import { FACILITIES, MEDICINES, SERVICES } from './lib/data.js'
import { can } from './lib/security.js'
import { validate } from './lib/chain.js'
import { apiUrl } from './lib/api.js'
import {
  connectSepoliaWallet,
  readSepoliaAnchorStatus,
  anchorPendingBlocks,
  getSepoliaContractAddress
} from './lib/ethereum.js'
import { Header, Notice } from './ui.jsx'
import Insights from './Insights.jsx'

const fmt = t => new Date(t).toLocaleString()

// ========================================
// ADMIN: STAFF ACCOUNT MANAGEMENT
// ========================================

function StaffAccounts() {
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    role: 'clerk'
  })

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function createStaff(e) {
    e.preventDefault()

    setMessage('')
    setError('')

    const token = localStorage.getItem('mediqueue:token')

    if (!token) {
      setError('Your session has expired. Please log in again.')
      return
    }

    setBusy(true)

    try {
      const response = await fetch(
        apiUrl('/api/auth/create-staff'),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(form)
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Could not create staff account.')
      }

      setMessage(
        `${form.role.charAt(0).toUpperCase() + form.role.slice(1)} account created successfully.`
      )

      setForm({
        fullName: '',
        email: '',
        phone: '',
        password: '',
        role: 'clerk'
      })

    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card">
      <h2>Staff Account Management</h2>

      <p className="muted">
        Create and manage authorised MediQueue staff accounts.
        Only administrators can create staff accounts.
      </p>

      <form className="form" onSubmit={createStaff}>

        <label>
          Full name
          <input
            type="text"
            value={form.fullName}
            onChange={e =>
              setForm({ ...form, fullName: e.target.value })
            }
            placeholder="Enter staff full name"
            required
          />
        </label>

        <label>
          Email address
          <input
            type="email"
            value={form.email}
            onChange={e =>
              setForm({ ...form, email: e.target.value })
            }
            placeholder="staff@example.com"
            required
          />
        </label>

        <label>
          Phone number
          <input
            type="tel"
            value={form.phone}
            onChange={e =>
              setForm({ ...form, phone: e.target.value })
            }
            placeholder="Enter phone number"
          />
        </label>

        <label>
          Temporary password
          <input
            type="password"
            value={form.password}
            onChange={e =>
              setForm({ ...form, password: e.target.value })
            }
            minLength={8}
            placeholder="At least 8 characters"
            required
          />
        </label>

        <label>
          Staff role
          <select
            value={form.role}
            onChange={e =>
              setForm({ ...form, role: e.target.value })
            }
          >
            <option value="clerk">Clerk</option>
            <option value="pharmacist">Pharmacist</option>
          </select>
        </label>

        {message && (
          <p className="ok" role="status">
            {message}
          </p>
        )}

        {error && (
          <p className="bad" role="alert">
            {error}
          </p>
        )}

        <button type="submit" disabled={busy}>
          {busy ? 'Creating account...' : 'Create staff account'}
        </button>

      </form>
    </section>
  )
}

// ========================================
// PATIENT: BOOKING AND PERSONAL DETAILS
// ========================================

function Book({ s }) {
  const [p, setP] = useState({
    name: '',
    phone: '',
    consent: false
  })

  const [f, setF] = useState(FACILITIES[0].id)
  const [sv, setSv] = useState(SERVICES[0].id)

  const saved = !!s.profile.ref

  const mine = s.queue.filter(
    t => t.ref === s.profile.ref
  )

  const notices = s.notices.filter(
    n => n.ref === s.profile.ref
  )

  const ready =
    p.name.trim() &&
    p.phone.trim() &&
    (!s.config.consentRequired || p.consent)

  const download = () => {
    const a = document.createElement('a')

    a.href = URL.createObjectURL(
      new Blob([exportMine()], {
        type: 'application/json'
      })
    )

    a.download = 'my-mediqueue-data.json'
    a.click()

    URL.revokeObjectURL(a.href)
  }

  return (
    <>
      <section className="card">
        <h2>Your details</h2>

        {saved ? (
          <>
            <p>
              Registered as <b>{s.profile.name}</b>, {s.profile.phone}.
            </p>

            <div className="row">
              <button className="ghost" onClick={download}>
                Download my data
              </button>

              <button
                className="ghost danger"
                onClick={() =>
                  confirm('Erase your details, tickets and watch list?') &&
                  deleteMine()
                }
              >
                Erase my data
              </button>
            </div>
          </>
        ) : (
          <div className="form">
            <label>
              Full name
              <input
                value={p.name}
                onChange={e =>
                  setP({ ...p, name: e.target.value })
                }
                autoComplete="name"
              />
            </label>

            <label>
              Phone number
              <input
                value={p.phone}
                onChange={e =>
                  setP({ ...p, phone: e.target.value })
                }
                inputMode="tel"
                autoComplete="tel"
              />
            </label>

            {s.config.consentRequired && (
              <label className="check">
                <input
                  type="checkbox"
                  checked={p.consent}
                  onChange={e =>
                    setP({
                      ...p,
                      consent: e.target.checked
                    })
                  }
                />

                I agree that MediQueue stores my name and phone
                number to manage my queue tickets and notices.
                I can download or erase my data at any time.
              </label>
            )}

            <button
              disabled={!ready}
              onClick={() => saveProfile(p)}
            >
              Save my details
            </button>
          </div>
        )}
      </section>

      {saved && (
        <section className="card">
          <h2>Book a queue</h2>

          <div className="form">
            <label>
              Facility
              <select
                value={f}
                onChange={e => setF(e.target.value)}
              >
                {FACILITIES.map(x => {
                  const n = waiting(s, x.id).length

                  return (
                    <option key={x.id} value={x.id}>
                      {x.name}: {n} waiting, about {eta(x.id, n)} min
                    </option>
                  )
                })}
              </select>
            </label>

            <label>
              Service
              <select
                value={sv}
                onChange={e => setSv(e.target.value)}
              >
                {SERVICES.map(x => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>

            <button
              onClick={() =>
                bookQueue({ facility: f, service: sv })
              }
            >
              Get my queue number
            </button>
          </div>
        </section>
      )}

      {saved && (
        <section className="card">
          <h2>Your tickets</h2>

          {mine.length === 0 ? (
            <p className="muted">
              No tickets yet. Pick a facility above to get a queue number.
            </p>
          ) : (
            <ul className="list">
              {mine.map(t => {
                const ahead = waiting(s, t.facility).filter(
                  x => x.ticket < t.ticket
                ).length

                return (
                  <li key={t.id}>
                    <div>
                      <b>Ticket {t.ticket}</b> at {facName(t.facility)}
                      <br />

                      <span className={'status ' + t.status}>
                        {t.status}
                      </span>{' '}

                      {t.status === 'waiting' && (
                        <span className="muted">
                          {ahead} ahead of you, about {eta(t.facility, ahead)} min
                        </span>
                      )}
                    </div>

                    {t.status === 'waiting' && (
                      <button
                        className="ghost"
                        onClick={() => cancelMine(t.id)}
                      >
                        Cancel
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      {saved && (
        <section className="card">
          <h2>Notices</h2>

          {notices.length === 0 ? (
            <p className="muted">
              Queue calls and stock changes for medicines you follow appear here.
            </p>
          ) : (
            <ul className="list">
              {notices.slice(0, 8).map(n => (
                <li key={n.id}>
                  <div>
                    {n.text}
                    <br />
                    <span className="muted">{fmt(n.time)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  )
}

// ========================================
// CLERK: QUEUE MANAGEMENT
// ========================================

function Desk({ s }) {
  const [f, setF] = useState(FACILITIES[0].id)

  const w = can(s.perms, s.role, 'queue', 'write')

  const list = s.queue
    .filter(
      t =>
        t.facility === f &&
        (t.status === 'waiting' || t.status === 'called')
    )
    .sort((a, b) => a.ticket - b.ticket)

  return (
    <section className="card">
      <h2>Queue desk</h2>

      <label className="inline">
        Facility

        <select
          value={f}
          onChange={e => setF(e.target.value)}
        >
          {FACILITIES.map(x => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
      </label>

      {!w && (
        <p className="muted">
          Read-only: patient names and service types are hidden from your role.
        </p>
      )}

      {list.length === 0 ? (
        <p className="muted">
          Nobody is waiting at this facility.
        </p>
      ) : (
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Patient</th>
                <th>Service</th>
                <th>Status</th>
                {w && <th>Actions</th>}
              </tr>
            </thead>

            <tbody>
              {list.map(t => (
                <tr key={t.id}>
                  <td>{t.ticket}</td>
                  <td>{w ? t.name : 'Hidden'}</td>

                  <td>
                    {w
                      ? SERVICES.find(x => x.id === t.service)?.name
                      : 'Hidden'}
                  </td>

                  <td>
                    <span className={'status ' + t.status}>
                      {t.status}
                    </span>
                  </td>

                  {w && (
                    <td>
                      <div className="row">
                        {t.status === 'waiting' && (
                          <button
                            onClick={() =>
                              setStatus(t.id, 'called')
                            }
                          >
                            Call
                          </button>
                        )}

                        <button
                          className="ghost"
                          onClick={() =>
                            setStatus(t.id, 'completed')
                          }
                        >
                          Complete
                        </button>

                        <button
                          className="ghost"
                          onClick={() =>
                            setStatus(t.id, 'no-show')
                          }
                        >
                          No-show
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

// ========================================
// PHARMACIST: MEDICINE MANAGEMENT
// ========================================

function Meds({ s }) {
  const [m, setM] = useState(MEDICINES[0].id)

  const w = can(s.perms, s.role, 'stock', 'write')

  const watch =
    can(s.perms, s.role, 'booking', 'write') &&
    !!s.profile.ref

  const rows = FACILITIES.map(f => {
    const qty = s.stock[f.id][m]
    const n = waiting(s, f.id).length

    return {
      f,
      qty,
      n,
      wait: eta(f.id, n),
      status:
        qty === 0
          ? 'Out of stock'
          : qty < 20
            ? 'Low'
            : 'In stock'
    }
  })

  const best = rows
    .filter(r => r.qty > 0)
    .sort((a, b) => a.wait - b.wait)[0]

  return (
    <section className="card">
      <h2>Medicine availability</h2>

      <label className="inline">
        Medicine

        <select
          value={m}
          onChange={e => setM(e.target.value)}
        >
          {MEDICINES.map(x => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
      </label>

      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>Facility</th>
              <th>Availability</th>
              {w && <th>Units</th>}
              <th>Waiting</th>
              <th>Wait for a new ticket</th>
              {watch && <th>Notify me</th>}
            </tr>
          </thead>

          <tbody>
            {rows.map(r => {
              const on = s.watch.some(
                x =>
                  x.ref === s.profile.ref &&
                  x.facility === r.f.id &&
                  x.med === m
              )

              return (
                <tr key={r.f.id}>
                  <td>
                    {r.f.name}
                    <br />
                    <span className="muted">{r.f.town}</span>

                    {best?.f.id === r.f.id && (
                      <>
                        {' '}
                        <span className="status completed">
                          Best match
                        </span>
                      </>
                    )}
                  </td>

                  <td>
                    <span
                      className={
                        'stock ' +
                        r.status.split(' ')[0].toLowerCase()
                      }
                    >
                      {r.status}
                    </span>
                  </td>

                  {w && (
                    <td>
                      <input
                        className="qty"
                        type="number"
                        min="0"
                        aria-label={'Units at ' + r.f.name}
                        key={r.f.id + m + r.qty}
                        defaultValue={r.qty}
                        onBlur={e =>
                          setStock(
                            r.f.id,
                            m,
                            Math.max(
                              0,
                              parseInt(e.target.value, 10) || 0
                            )
                          )
                        }
                      />
                    </td>
                  )}

                  <td>{r.n}</td>
                  <td>about {r.wait} min</td>

                  {watch && (
                    <td>
                      <button
                        className={on ? '' : 'ghost'}
                        onClick={() =>
                          toggleWatch(r.f.id, m)
                        }
                      >
                        {on ? 'Following' : 'Follow'}
                      </button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="muted">
        Best match is the facility with {medName(m)} listed and the shortest wait.
        Check again before you travel.
      </p>
    </section>
  )
}

// ========================================
// BLOCKCHAIN LEDGER
// ========================================

function EthereumAnchor({ s, canWrite }) {
  const [provider, setProvider] = useState(null)
  const [account, setAccount] = useState('')
  const [isOwner, setIsOwner] = useState(false)
  const [totalAnchors, setTotalAnchors] = useState(null)
  const [statuses, setStatuses] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [lastTransaction, setLastTransaction] = useState('')

  const contractAddress = getSepoliaContractAddress()
  const pendingBlocks = s.chain.filter(
    block => block.index > 0 && statuses[block.hash] !== true
  )

  async function refreshStatus(activeProvider = provider) {
    if (!activeProvider) {
      throw new Error('Connect Trust Wallet first.')
    }

    const result = await readSepoliaAnchorStatus(activeProvider, s.chain)
    setTotalAnchors(result.totalAnchors)
    setStatuses(result.statuses)
    return result
  }

  async function connectWallet() {
    setBusy(true)
    setError('')
    setMessage('')

    try {
      const result = await connectSepoliaWallet()
      setProvider(result.provider)
      setAccount(result.account)
      setIsOwner(result.isOwner)
      setTotalAnchors(result.totalAnchors)
      const status = await readSepoliaAnchorStatus(result.provider, s.chain)
      setStatuses(status.statuses)
      setTotalAnchors(status.totalAnchors)

      setMessage(
        result.isOwner
          ? 'Trust Wallet connected. This wallet is the smart-contract owner.'
          : 'Trust Wallet connected for viewing. Connect the wallet that deployed the contract to anchor records.'
      )
    } catch (err) {
      setError(err.message || 'Could not connect to Trust Wallet.')
    } finally {
      setBusy(false)
    }
  }

  async function refresh() {
    setBusy(true)
    setError('')
    setMessage('')

    try {
      const result = await refreshStatus()
      setMessage(`Ethereum status refreshed. ${result.totalAnchors} block hash(es) are recorded on Sepolia.`)
    } catch (err) {
      setError(err.message || 'Could not read the smart contract.')
    } finally {
      setBusy(false)
    }
  }

  async function anchor() {
    setBusy(true)
    setError('')
    setMessage('')
    setLastTransaction('')

    try {
      if (!canWrite) {
        throw new Error('Only an administrator with ledger write permission can anchor blocks.')
      }

      if (!isOwner) {
        throw new Error('This wallet is not the contract owner. Connect the Trust Wallet wallet that deployed the smart contract.')
      }

      const localCheck = await validate(s.chain)
      if (!localCheck.ok) {
        throw new Error(`The local ledger is invalid at block ${localCheck.at}: ${localCheck.why}. Fix it before anchoring.`)
      }

      const result = await anchorPendingBlocks(provider, pendingBlocks)
      setLastTransaction(result.transactionHash)
      const refreshed = await refreshStatus(provider)
      setMessage(
        `Successfully anchored ${result.anchoredCount} block hash(es) in Ethereum block ${result.blockNumber}. ${refreshed.totalAnchors} total anchor(s) are now recorded.`
      )
    } catch (err) {
      setError(err.shortMessage || err.reason || err.message || 'Ethereum transaction failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card">
      <h3>Ethereum Sepolia anchoring</h3>
      <p className="muted">
        Connect the administrator's Trust Wallet wallet to anchor hashes of MediQueue audit blocks on the Ethereum Sepolia test network. Only block hashes and limited event metadata are sent on-chain; patient and medical information stays off-chain.
      </p>

      <div className="tiles">
        <div className="tile">
          <div className="v">{totalAnchors === null ? '—' : totalAnchors}</div>
          <small>Hashes recorded on Sepolia</small>
        </div>
        <div className="tile">
          <div className="v">{pendingBlocks.length}</div>
          <small>Local blocks not yet anchored</small>
        </div>
        <div className="tile">
          <div className="v">{account ? 'Connected' : 'Not connected'}</div>
          <small>Trust Wallet wallet status</small>
        </div>
      </div>

      <p className="muted">
        <strong>Contract:</strong>{' '}
        {contractAddress
          ? `${contractAddress.slice(0, 10)}…${contractAddress.slice(-8)}`
          : 'Not configured — follow docs/ETHEREUM_SEPOLIA_SETUP.md'}
      </p>

      {account && (
        <p className="muted">
          <strong>Wallet:</strong> {account}
          {' · '}
          <strong>Permission:</strong> {isOwner ? 'Contract owner' : 'Read-only wallet'}
        </p>
      )}

      <div className="row">
        <button onClick={connectWallet} disabled={busy}>
          {busy ? 'Please wait…' : account ? 'Reconnect Trust Wallet' : 'Connect Trust Wallet'}
        </button>

        <button className="ghost" onClick={refresh} disabled={busy || !provider}>
          Refresh Ethereum status
        </button>

        {canWrite && (
          <button onClick={anchor} disabled={busy || !provider || !isOwner || pendingBlocks.length === 0}>
            Anchor pending blocks
          </button>
        )}
      </div>

      {!canWrite && (
        <p className="muted">
          Your role has read-only ledger access. An administrator must submit Ethereum transactions.
        </p>
      )}

      {error && <p className="bad" role="alert">{error}</p>}
      {message && <p className="ok" role="status">{message}</p>}

      {lastTransaction && (
        <p>
          <strong>Latest Ethereum transaction:</strong>{' '}
          <a href={`https://sepolia.etherscan.io/tx/${lastTransaction}`} target="_blank" rel="noreferrer">
            View on Sepolia Etherscan
          </a>
        </p>
      )}

      <p className="muted">
        Test network only. Use Sepolia test ETH; do not use a mainnet wallet or send real funds for this coursework demonstration.
      </p>
    </section>
  )
}

function Ledger({ s }) {
  const [res, setRes] = useState(null)
  const w = can(s.perms, s.role, 'ledger', 'write')

  const check = async () => {
    setRes(await validate(s.chain))
  }

  const tamper = async () => {
    if (s.chain.length < 3) {
      return setRes({
        ok: false,
        note: 'Book a queue or update stock first, so there is a block to alter.'
      })
    }

    const c = s.chain.map(b => ({ ...b }))
    const i = Math.floor(c.length / 2)

    c[i].data = {
      ...c[i].data,
      tampered: true
    }

    setRes({
      ...(await validate(c)),
      note: `Test copy altered at block ${i}. Your real ledger was not changed.`
    })
  }

  return (
    <section className="card">
      <h2>Blockchain ledger</h2>

      <p className="muted">
        MediQueue keeps a local audit chain using SHA-256 hashes, transaction Merkle roots, proof-of-work and previous-block links. Ethereum Sepolia is used separately to publish and independently verify selected block hashes. This is an Ethereum testnet integration, not Bitcoin.
      </p>

      <div className="row">
        <button onClick={check}>Verify local chain</button>

        {w && (
          <button className="ghost" onClick={tamper}>
            Run local tamper test
          </button>
        )}
      </div>

      {res && (
        <p
          role="status"
          className={res.ok ? 'ok' : 'bad'}
        >
          {res.note && res.note + ' '}

          {res.ok
            ? `Local chain valid, ${s.chain.length} blocks.`
            : res.at !== undefined
              ? `Invalid at block ${res.at}: ${res.why || 'validation failed'}.`
              : ''}
        </p>
      )}

      <EthereumAnchor s={s} canWrite={w} />

      <h3>Local audit blocks</h3>
      <div className="scroll">
        <table className="mono">
          <thead>
            <tr>
              <th>#</th>
              <th>Time</th>
              <th>Event</th>
              <th>Data</th>
              <th>Nonce</th>
              <th>Merkle root</th>
              <th>SHA-256 hash</th>
            </tr>
          </thead>

          <tbody>
            {[...s.chain]
              .reverse()
              .slice(0, 25)
              .map(b => (
                <tr key={b.index}>
                  <td>{b.index}</td>
                  <td>{fmt(b.time)}</td>
                  <td>{b.type}</td>
                  <td>{JSON.stringify(b.data)}</td>
                  <td>{b.nonce}</td>
                  <td title={b.merkleRoot || 'Legacy block'}>
                    {b.merkleRoot ? `${b.merkleRoot.slice(0, 10)}…` : 'Legacy'}
                  </td>
                  <td title={b.hash}>
                    {b.hash.slice(0, 10)}…
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ========================================
// MAIN APPLICATION
// ========================================

export default function App({ user, onLogout }) {
  const s = useStore()

  useEffect(() => {
    setRole(user.role)
  }, [user.role])

  const ok = moduleName =>
    can(s.perms, s.role, moduleName, 'read')

  // Admin gets the staff management tab.
  // Other tabs depend on the existing permission matrix.
  const tabs = [
    ...(user.role === 'admin'
      ? [['staff', 'Staff accounts', null]]
      : []),

    ...[
      ['book', 'Book a queue', 'booking'],
      ['desk', 'Queue desk', 'queue'],
      ['meds', 'Medicines', 'stock'],
      ['ledger', 'Ledger', 'ledger'],
      ['insights', 'Insights', 'analytics']
    ].filter(t => t[2] && ok(t[2]))
  ]

  const [tab, setTab] = useState(
    user.role === 'admin' ? 'staff' : 'book'
  )

  const active = tabs.some(t => t[0] === tab)
    ? tab
    : tabs[0]?.[0]

  return (
    <>
      <Header
        title="MediQueue Lesotho"
        user={user}
        onLogout={onLogout}
      >
        {ok('security') && (
          <a href="./security.html">
            Security module
          </a>
        )}
      </Header>

      <main>
        <Notice />

        <div className="tabs" role="tablist">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={active === id}
              className={active === id ? 'on' : ''}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {tabs.length === 0 && (
          <p className="card">
            Your role has no access to any module.
            Ask an administrator to update permissions.
          </p>
        )}

        {active === 'staff' && user.role === 'admin' && (
          <StaffAccounts />
        )}

        {active === 'book' && <Book s={s} />}

        {active === 'desk' && <Desk s={s} />}

        {active === 'meds' && <Meds s={s} />}

        {active === 'ledger' && <Ledger s={s} />}

        {active === 'insights' && <Insights />}
      </main>
    </>
  )
}
