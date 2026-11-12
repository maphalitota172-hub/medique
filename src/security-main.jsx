import { createRoot } from 'react-dom/client'
import Security from './Security'
import './styles.css'

async function start() {
  const token = localStorage.getItem('mediqueue:token')
  if (!token) { document.getElementById('root').innerHTML = '<main><p class="card">Please sign in through the MediQueue home page first.</p></main>'; return }
  try {
    const response = await fetch('http://localhost:5000/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
    if (!response.ok) throw new Error('Your session has expired.')
    const { user } = await response.json()
    if (user.role !== 'admin') throw new Error('Administrator access is required.')
    createRoot(document.getElementById('root')).render(<Security />)
  } catch (e) {
    document.getElementById('root').innerHTML = `<main><p class="card">${e.message}</p><p><a href="/">Return to MediQueue</a></p></main>`
  }
}
start()
