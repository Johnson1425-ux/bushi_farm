import { getAccessToken, getRefreshToken, refreshSession, clearSession } from './session'

// Use an environment variable, fallback to '/api' for local dev
const apiHost = import.meta.env.VITE_API_URL || ''; 

// Ensure we have a clean path
export const BASE = apiHost.endsWith('/') 
  ? apiHost.slice(0, -1) + '/api' 
  : apiHost + '/api';

/**
 * Every call to the API.
 *
 * Access tokens are short-lived now, so the token is fetched through
 * getAccessToken() — which renews it first when it is about to expire —
 * rather than read straight out of storage. A request that still comes
 * back 401 is retried once against a freshly minted token: that covers the
 * token dying between being read and being received, and the case where a
 * long-open tab wakes up to a dead session it can still renew.
 */
export async function apiFetch(path, opts = {}) {
  const send = async (token) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    }
    if (opts.body instanceof FormData) delete headers['Content-Type']
    return fetch(BASE + path, { ...opts, headers })
  }

  const token = await getAccessToken()
  let r = await send(token)

  if (r.status === 401 && token) {
    /* Renew and try once more — but only if there is a refresh token to
       renew with, so a 401 that means "not allowed" cannot turn into a
       second pointless request. The body is a string or FormData, both of
       which can be sent again as they are. */
    const renewed = getRefreshToken() ? await refreshSession() : null
    if (renewed && renewed !== token) r = await send(renewed)

    if (r.status === 401) {
      /* The session is genuinely over. Without this a tab left open
         overnight fails every call inline and never returns to sign-in.
         Only a request that carried a token lands here, so an anonymous
         visitor reading a public page is not dragged to the login form. */
      clearSession()
      if (window.location.pathname !== '/login') {
        window.location.replace('/login')
      }
    }
  }

  if (!r.ok) {
    const e = await r.json().catch(() => ({}))
    /* The message alone loses everything the API said beyond it — the
       shortfall list behind a refused dispatch, the parser's issue list
       behind a rejected upload. Callers that want the detail read
       err.body; callers that only want to show something read err.message
       exactly as before. */
    const err = new Error(e.error || r.statusText)
    err.status = r.status
    err.body   = e
    throw err
  }
  return r.json()
}

export function toDateStr(v) {
  if (!v) return ''
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  const s = String(v)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const d = new Date(s)
  return isNaN(d) ? s.slice(0, 10) : d.toISOString().slice(0, 10)
}

export function initials(n) {
  return n.split(/[\s\-_]+/).map(w => w[0] || '').join('').toUpperCase().slice(0, 2) || '??'
}

export function statusClass(val, overall) {
  if (val >= overall * 1.1) return 'high'
  if (val <= overall * 0.85) return 'low'
  return 'mid'
}

export const CMP_COLORS = ['#2a8a56', '#3478c8', '#e8a020', '#d94040']
