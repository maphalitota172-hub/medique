import { useStore, setPerm, setConfig, resetAll } from './lib/store.js'
import { MODULES, ROLES, LEVELS, can, DATA_CLASSIFICATION, GDPR_CHECKS, gdprScore } from './lib/security.js'
import { Header, Tile } from './ui.jsx'

export default function Security() {
  const s = useStore()
  const read = can(s.perms, s.role, 'security', 'read'), write = can(s.perms, s.role, 'security', 'write')
  if (!read) return (
    <>
      <Header title="Security configuration"><a href="./index.html">Back to app</a></Header>
      <main><p className="card bad">Access denied. Only administrators can open this module. Use the role menu to sign in as admin.</p></main>
    </>
  )
  const counts = ['public', 'private', 'confidential', 'restricted'].map(c => [c, DATA_CLASSIFICATION.filter(d => d.cls === c).length])
  return (
    <>
      <Header title="Security configuration"><a href="./index.html">Back to app</a></Header>
      <main>
        <p className="notice">This module is a separate page (security.html). In production, host it on its own domain, such as security.mediqueue.example, behind stronger authentication.</p>

        <section className="card">
          <h2>Access permissions</h2>
          <p className="muted">Choose what each role can do in each module. Every change is written to the ledger. The admin role keeps write access here so it cannot lock itself out.</p>
          <div className="scroll"><table>
            <thead><tr><th>Module</th>{ROLES.map(r => <th key={r}>{r}</th>)}</tr></thead>
            <tbody>{MODULES.map(([id, label]) => (
              <tr key={id}><td>{label}</td>{ROLES.map(r => (
                <td key={r}><select aria-label={`${r} access to ${label}`} value={s.perms[r][id]} disabled={!write || (r === 'admin' && id === 'security')} onChange={e => setPerm(r, id, e.target.value)}>
                  {LEVELS.map(l => <option key={l}>{l}</option>)}</select></td>
              ))}</tr>
            ))}</tbody>
          </table></div>
        </section>

        <section className="card">
          <h2>Privacy settings</h2>
          <div className="form">
            <label>Keep finished tickets for (days)
              <input type="number" min="1" max="365" disabled={!write} value={s.config.retentionDays} onChange={e => setConfig({ retentionDays: Math.max(1, +e.target.value || 1) })} /></label>
            <label className="check"><input type="checkbox" disabled={!write} checked={s.config.consentRequired} onChange={e => setConfig({ consentRequired: e.target.checked })} />
              Require explicit consent before a patient profile is created</label>
          </div>
        </section>

        <section className="card">
          <h2>Data classification</h2>
          <div className="tiles">{counts.map(([c, n]) => <Tile key={c} label={c} value={n} />)}</div>
          <div className="scroll"><table>
            <thead><tr><th>Data item</th><th>Class</th><th>Where it appears</th><th>Controls</th></tr></thead>
            <tbody>{DATA_CLASSIFICATION.map(d => <tr key={d.item}><td>{d.item}</td><td><span className={'chip ' + d.cls}>{d.cls}</span></td><td>{d.where}</td><td>{d.controls}</td></tr>)}</tbody>
          </table></div>
        </section>

        <section className="card">
          <h2>GDPR compliance</h2>
          <div className="tiles"><Tile label="Overall score" value={gdprScore() + '%'} hint="Compliant = 1, Partial = 0.5, Gap = 0" /></div>
          <div className="scroll"><table>
            <thead><tr><th>Requirement</th><th>Level</th><th>Evidence</th></tr></thead>
            <tbody>{GDPR_CHECKS.map(c => <tr key={c.article}><td>{c.article}</td><td><span className={'chip g-' + c.status.toLowerCase()}>{c.status}</span></td><td>{c.evidence}</td></tr>)}</tbody>
          </table></div>
        </section>

        {write && <section className="card"><h2>Demo data</h2>
          <button className="ghost danger" onClick={() => confirm('Reset all demo data, permissions and the ledger?') && resetAll()}>Reset everything</button></section>}
      </main>
    </>
  )
}
