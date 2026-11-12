
import { useState } from 'react'
import { apiUrl } from './lib/api.js'
import { initializeDatabase } from './lib/store.js'

export default function Auth({ onAuthenticated }) {
  const [mode, setMode] = useState('login')

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: ''
  })

  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const change = e => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    })
  }

  async function submit(e) {
    e.preventDefault()

    setError('')
    setBusy(true)

    try {
      const response = await fetch(
        apiUrl(`/api/auth/${mode === 'login' ? 'login' : 'register'}`),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(form)
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed.')
      }

      // Save the token before loading shared application data.
      localStorage.setItem('mediqueue:token', data.token)

      // Load shared application data using the new token.
      await initializeDatabase()

      // Only enter the dashboard after database loading succeeds.
      onAuthenticated(data.user)

    } catch (err) {
      localStorage.removeItem('mediqueue:token')

      setError(
        err.message ||
        'Cannot connect to MediQueue. Check that the backend is running.'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-wrap">
      <section className="card auth-card">
        <h1>MediQueue Lesotho</h1>

        <p className="muted">
          {mode === 'login'
            ? 'Sign in to manage your queue and account.'
            : 'Create a patient account to book and track queue tickets.'}
        </p>

        <form className="form" onSubmit={submit}>
          {mode === 'register' && (
            <>
              <label>
                Full name
                <input
                  name="fullName"
                  value={form.fullName}
                  onChange={change}
                  required
                  autoComplete="name"
                />
              </label>

              <label>
                Phone number
                <input
                  name="phone"
                  value={form.phone}
                  onChange={change}
                  autoComplete="tel"
                />
              </label>
            </>
          )}

          <label>
            Email address
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={change}
              required
              autoComplete="email"
            />
          </label>

          <label>
            Password
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={change}
              required
              minLength="8"
              autoComplete={
                mode === 'login'
                  ? 'current-password'
                  : 'new-password'
              }
            />
          </label>

          {error && (
            <p className="bad" role="alert">
              {error}
            </p>
          )}

          <button disabled={busy}>
            {busy
              ? 'Connecting to database...'
              : mode === 'login'
                ? 'Sign in'
                : 'Create account'}
          </button>
        </form>

        <p>
          {mode === 'login'
            ? 'New patient?'
            : 'Already registered?'}

          {' '}

          <button
            className="link-button"
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login')
              setError('')
            }}
          >
            {mode === 'login'
              ? 'Create an account'
              : 'Sign in'}
          </button>
        </p>

        {mode === 'register' && (
          <small className="muted">
            Patient accounts can be registered here.
            Staff accounts must be created by an administrator.
          </small>
        )}
      </section>
    </main>
  )
}
