const BASE = '/api'

function getToken() {
  return localStorage.getItem('mt_token')
}

export async function apiFetch(path, opts = {}) {
  const token = getToken()
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(opts.headers || {}),
  }
  if (opts.body instanceof FormData) delete headers['Content-Type']

  const r = await fetch(BASE + path, { ...opts, headers })
  if (!r.ok) {
    const e = await r.json().catch(() => ({}))
    throw new Error(e.error || r.statusText)
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
