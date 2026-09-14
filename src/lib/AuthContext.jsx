import React, { createContext, useContext, useState, useEffect } from 'react'
import { BASE } from './api'
import {
  saveSession, clearSession, hasSession, getAccessToken,
  endSessionEverywhere, onSessionEnded,
} from './session'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    /* A session that ends anywhere in the app — a refresh the server
       refused, an account an admin changed — empties the user here too, so
       the route guards send them to sign in rather than leaving a shell of
       a page behind. */
    const stop = onSessionEnded(() => setUser(null))
    return stop
  }, [])

  useEffect(() => {
    let cancelled = false
    if (!hasSession()) { setLoading(false); return }

    /* Renew first if the stored access token has gone stale — which, at
       fifteen minutes, it usually has by the time the tab is reopened. */
    getAccessToken()
      .then(token => {
        if (!token) return Promise.reject(new Error('no session'))
        return fetch(`${BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('rejected')))
      .then(({ user }) => { if (!cancelled) setUser(user) })
      .catch(() => clearSession())
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [])

  const login = async (username, password) => {
    const r = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const data = await r.json()
    if (!r.ok) throw new Error(data.error || 'Login failed')
    /* Both tokens and when the access one expires; the client renews on
       that clock rather than waiting to be told 401. */
    saveSession(data)
    setUser(data.user)
  }

  /* Signing out tells the server, so the refresh token stops working for
     anyone who has a copy of it. Forgetting it here is no longer enough on
     its own — that is the whole point of a session the server can end. */
  const logout = async () => {
    setUser(null)
    await endSessionEverywhere()
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
