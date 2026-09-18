import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { takeSignedOutReason } from '../lib/session'
import { Logo } from '../components/ui'

export default function Login() {
  const { login }  = useAuth()
  const navigate   = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  /* Set when the session ended on its own rather than by anyone asking —
     an idle timeout, the twelve-hour limit, an admin changing the
     account. Shown once, so a fresh visitor sees nothing. */
  const [endedBecause, setEndedBecause] = useState('')

  useEffect(() => { setEndedBecause(takeSignedOutReason() || '') }, [])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-green-900 flex items-center justify-center relative">

      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: [
            'repeating-linear-gradient(0deg, #fff 0px, #fff 1px, transparent 1px, transparent 40px)',
            'repeating-linear-gradient(90deg, #fff 0px, #fff 1px, transparent 1px, transparent 40px)',
          ].join(', '),
        }}
      />

      <div className="bg-surface rounded-[20px] w-[380px] max-w-[90vw] shadow-[0_24px_80px_rgba(0,0,0,0.3)] relative"
        style={{ padding: '44px 48px' }}>

        {/* Logo */}
        <div className="text-center" style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
            <Logo size={64} />
          </div>
          <div className="font-serif text-[26px] text-ink">Milktrack</div>
          <div className="text-[12px] text-ink-30 uppercase tracking-[0.5px]" style={{ marginTop: 4 }}>Farm Analytics</div>
        </div>

        <form onSubmit={submit}>

          <div style={{ marginBottom: 16 }}>
            <label className="block text-[12px] font-medium text-ink-60 uppercase tracking-[0.4px]"
              style={{ marginBottom: 6 }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
              required
              placeholder="Enter your username"
              className="w-full"
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label className="block text-[12px] font-medium text-ink-60 uppercase tracking-[0.4px]"
              style={{ marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              placeholder="Enter your password"
              className="w-full"
            />
          </div>

          {endedBecause && !error && (
            <div className="bg-amber/10 border border-amber/30 rounded-lg text-[13px] text-ink-60"
              style={{ padding: '10px 14px', marginBottom: 16 }}>
              {endedBecause}
            </div>
          )}

          {error && (
            <div className="bg-red/10 border border-red/30 rounded-lg text-[13px] text-red"
              style={{ padding: '10px 14px', marginBottom: 16 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={[
              'w-full text-white text-sm font-semibold border-0 transition-colors duration-150',
              loading ? 'bg-green-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-800 cursor-pointer',
            ].join(' ')}
            style={{ padding: '12px', borderRadius: 10 }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

        </form>
      </div>
    </div>
  )
}