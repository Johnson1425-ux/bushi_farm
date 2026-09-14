import React, { createContext, useContext, useState, useEffect } from 'react'
import { BASE } from './api'
import {
  startSession, restoreSession, endSessionEverywhere, onSessionEnded, CLIENT_HEADER,
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

    /* Nothing survives a reload but the cookie, so every load starts by
       exchanging it for an access token. The same call says who the
       session belongs to, so there is no second request to /auth/me. */
    restoreSession()
      .then(user => { if (!cancelled) setUser(user) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [])

  const login = async (username, password) => {
    const r = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      /* The session cookie arrives on this response and is stored by the
         browser; without this the Set-Cookie is dropped on the floor. */
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...CLIENT_HEADER },
      body: JSON.stringify({ username, password }),
    })
    const data = await r.json()
    if (!r.ok) throw new Error(data.error || 'Login failed')
    /* The access token and when it expires. The refresh token is not in
       here — it went into the httpOnly cookie, out of reach of this code
       and of anything injected alongside it. */
    startSession(data)
    setUser(data.user)
  }

  /* Signing out tells the server, which revokes the session and clears
     the cookie. Forgetting it here is not enough on its own — that is the
     whole point of a session the server can end. */
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
