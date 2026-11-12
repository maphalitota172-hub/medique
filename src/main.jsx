import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import Auth from './Auth'
import './styles.css'

function Root() {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)
  useEffect(() => {
    const token = localStorage.getItem('mediqueue:token')
    if (!token) { setChecking(false); return }
    fetch('http://localhost:5000/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(async r => { if (!r.ok) throw new Error('Session expired'); return r.json() })
      .then(data => setUser(data.user))
      .catch(() => localStorage.removeItem('mediqueue:token'))
      .finally(() => setChecking(false))
  }, [])
  if (checking) return <main><p className="card">Checking your session…</p></main>
  return user ? <App user={user} onLogout={() => { localStorage.removeItem('mediqueue:token'); location.reload() }} /> : <Auth onAuthenticated={setUser} />
}
createRoot(document.getElementById('root')).render(<Root />)
