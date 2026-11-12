import { useStore, setRole } from './lib/store'
import { ROLES } from './lib/security'

export const Header = ({ title, children, user, onLogout }) => (
  <header className="top">
    <div className="brand"><b>MediQueue Lesotho</b><span>{title}</span></div>
    <nav>
      {children}
      <span className="role">{user?.full_name} · {user?.role}</span>
      <button className="ghost" onClick={onLogout}>Sign out</button>
    </nav>
  </header>
)
export const Notice = () => (
  <p className="notice" role="note">
    Medicine availability changes through the day, and a stock notice does not guarantee a medicine will be dispensed.
    Queue booking does not replace emergency care: in an emergency, go straight to the nearest facility.
  </p>
)
export const Tile = ({ label, value, hint }) => (
  <div className="tile"><div className="v">{value}</div><div>{label}</div>{hint && <small>{hint}</small>}</div>
)
