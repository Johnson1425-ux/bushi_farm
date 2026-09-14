import { BASE } from './api'

/* ══════════════════════════════════════════════════════════════
   THE SIGNED-IN SESSION

   Two tokens, with different lives:

     access  — sent on every request, good for about fifteen minutes.
     refresh — kept only to obtain the next access token, good for a month,
               rotated each time it is used, and revocable by the server.

   Everything that needs a token asks getAccessToken() rather than reading
   storage, because by the time a page has been open for an hour the stored
   access token is long dead and the refresh has to happen first. The call
   is cheap: it returns the stored token untouched until it is close to
   expiring.

   ── Why localStorage ────────────────────────────────────────
   A refresh token in an httpOnly cookie would be out of reach of any
   script on the page, which is better — but the API is on a different
   origin to this app, so that cookie is a third-party cookie and today's
   browsers drop it. Rather than build a session that quietly stops working
   in Safari, the token is stored here and kept short-lived, rotated and
   revocable instead. Those are the defences that survive the move; if the
   API is ever served from the same origin as the app, the refresh token
   belongs in a cookie and this file is where that change lands.
══════════════════════════════════════════════════════════════ */

const ACCESS_KEY  = 'mt_token'      // unchanged: an open tab keeps its session
const REFRESH_KEY = 'mt_refresh'
const EXPIRY_KEY  = 'mt_token_expiry'
const LOCK_KEY    = 'mt_refresh_lock'

/* Refresh this long before the token actually expires, so a request never
   leaves with a token that dies in flight. Also covers a client clock that
   runs slightly fast. */
const RENEW_BEFORE_MS = 60 * 1000;

/* How long one tab may hold the refresh lock before the others stop
   waiting for it — a tab that was closed mid-refresh must not wedge the
   rest of them. */
const LOCK_TTL_MS = 10 * 1000;

/* Safari in private mode throws on every storage call rather than
   returning null, and a thrown getter here would take the whole app down
   on load. */
const read = (k) => { try { return localStorage.getItem(k) } catch { return null } }
const write = (k, v) => {
  try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v) } catch { /* ignore */ }
}

const listeners = new Set()

/** Called when the session ends underneath the app — expired, revoked, signed out elsewhere. */
export function onSessionEnded(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function saveSession({ token, refreshToken, expiresIn }) {
  write(ACCESS_KEY, token || null)
  if (refreshToken) write(REFRESH_KEY, refreshToken)
  write(EXPIRY_KEY, expiresIn ? String(Date.now() + Number(expiresIn) * 1000) : null)
}

export function clearSession() {
  write(ACCESS_KEY, null); write(REFRESH_KEY, null)
  write(EXPIRY_KEY, null); write(LOCK_KEY, null)
}

/** Is there anything to work with — a live access token, or a refresh token to get one? */
export function hasSession() {
  return Boolean(read(ACCESS_KEY) || read(REFRESH_KEY))
}

export const getRefreshToken = () => read(REFRESH_KEY)

function endSession() {
  clearSession()
  listeners.forEach(fn => { try { fn() } catch { /* a listener must not stop the others */ } })
}

/* One refresh at a time within this tab. Without it, a screen that fires
   six requests on mount would spend the refresh token six times over and
   five of them would come back as a replay. */
let inFlight = null

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

/**
 * Wait for whichever tab is already refreshing.
 *
 * Tabs share storage but not memory, so the in-tab guard above says nothing
 * about the tab next to it. Both would present the same refresh token, and
 * only one can spend it. A lock in storage keeps that to one request; the
 * server also forgives a rotation raced by seconds, which covers the gap
 * between reading the lock and writing it.
 *
 * Returns the token the other tab obtained, or null if it never arrived —
 * in which case this tab goes ahead and refreshes itself.
 */
async function waitForOtherTab() {
  const held = read(LOCK_KEY)
  const heldAt = held ? Number(held) : 0
  if (!heldAt || Date.now() - heldAt > LOCK_TTL_MS) return null

  const before = read(ACCESS_KEY)
  const until  = heldAt + LOCK_TTL_MS
  while (Date.now() < until) {
    await sleep(120)
    const now = read(ACCESS_KEY)
    if (now && now !== before) return now      // the other tab published one
    if (!read(LOCK_KEY)) return read(ACCESS_KEY)  // it finished, or gave up
  }
  return null
}

async function doRefresh() {
  const shared = await waitForOtherTab()
  if (shared) return shared

  const refreshToken = read(REFRESH_KEY)
  if (!refreshToken) { endSession(); return null }

  write(LOCK_KEY, String(Date.now()))
  try {
    const r = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })

    if (r.status === 401 || r.status === 403) {
      /* The server has decided this session is over — expired, signed out,
         or revoked because the account changed. Retrying cannot help. */
      endSession()
      return null
    }
    if (!r.ok) {
      /* A 500 or a gateway error says nothing about the session, so the
         tokens stay put and the caller sees a failed request it can retry. */
      throw new Error('Could not renew the session. Try again.')
    }

    const data = await r.json()
    saveSession(data)
    return data.token
  } finally {
    write(LOCK_KEY, null)
  }
}

/** Force a renewal now — what a 401 on a live token asks for. */
export function refreshSession() {
  if (!inFlight) inFlight = doRefresh().finally(() => { inFlight = null })
  return inFlight
}

/**
 * A usable access token, renewed first if it is expired or nearly so.
 *
 * Returns null when there is no session to renew — callers send the request
 * without a token and let the API answer 401, which is what an anonymous
 * visitor on a public page should get.
 */
export async function getAccessToken() {
  const token  = read(ACCESS_KEY)
  const expiry = Number(read(EXPIRY_KEY))

  /* No recorded expiry means a token stored before sessions were split in
     two. It is still honoured by the API until it runs out, and the 401
     handler takes over after that. */
  if (token && (!expiry || Date.now() < expiry - RENEW_BEFORE_MS)) return token
  if (!read(REFRESH_KEY)) return token || null

  return refreshSession()
}

/**
 * Authorization header for a hand-rolled fetch — file uploads and
 * downloads, which cannot go through apiFetch because they are not JSON.
 * Always await it: it may have to renew the token first.
 */
export async function authHeaders(extra = {}) {
  const token = await getAccessToken()
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra }
}

/** Sign out: end the session on the server as well as forgetting it here. */
export async function endSessionEverywhere() {
  const refreshToken = read(REFRESH_KEY)
  clearSession()
  if (!refreshToken) return
  try {
    await fetch(`${BASE}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
  } catch {
    /* Offline, or the server is down. The token is already gone from this
       device; it will expire on its own, and the server keeps no session
       this browser can still use. */
  }
}
