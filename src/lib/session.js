import { BASE } from './api'

/* ══════════════════════════════════════════════════════════════
   THE SIGNED-IN SESSION

   Nothing that can be used to sign in is written to disk.

     the refresh token — set by the server as an httpOnly cookie. No
                         script can read it, this one included; the
                         browser attaches it to /api/auth requests and
                         that is the only way it is ever used.
     the access token  — held in this module's memory for the fifteen
                         minutes it lasts. Not in localStorage, not in a
                         readable cookie, gone when the tab closes.

   Both used to live in localStorage, where any injected script could read
   them and, worse, keep them: a refresh token copied out that way is a
   month of access from anywhere. Now the long-lived half is out of reach
   of script entirely, and the short-lived half dies with the page.

   XSS is not defeated by this — a script running on the page can call the
   API as the user for as long as it runs. What it can no longer do is
   walk away with the session.

   ── The cost, and what pays it ──────────────────────────────
   The access token does not survive a reload, so every load starts by
   exchanging the cookie for a new one (restoreSession below). One request
   at boot, and in return there is nothing on disk to steal.

   ── This only works first-party ─────────────────────────────
   The cookie is stored by the browser for the API's own site. Deployed
   with the app on one *.vercel.app host and the API on another, that is a
   third-party cookie: Chrome and Firefox still send it, Safari does not
   store it at all. Serving the API under the app's domain — a proxied
   path, or api.yourfarm.com beside app.yourfarm.com — makes it
   first-party and is what makes this arrangement hold everywhere.
══════════════════════════════════════════════════════════════ */

/* Not a credential: just a note that this browser had a session, so a
   first-time visitor on a public page is not sent to ask for a new access
   token nobody is waiting for. Worthless to anyone who steals it. */
const SIGNED_IN_KEY = 'mt_session'

/* Why the session ended, kept just long enough for the sign-in page to
   say so. Being returned to a login form with no explanation is the worst
   part of an idle timeout — the attendant assumes the app broke. In
   sessionStorage because the redirect reloads the page, and because the
   reason belongs to this tab and should not outlive it. */
const SIGNED_OUT_REASON_KEY = 'mt_signed_out'

/* Written by the release that kept tokens in localStorage. Read once, to
   trade for a cookie, then scrubbed. */
const LEGACY_KEYS = ['mt_token', 'mt_refresh', 'mt_token_expiry', 'mt_refresh_lock']

/* Renew once the access token is past this much of its life.
 *
 * Half, which does two jobs. A request never leaves carrying a token
 * about to die in flight, and a slightly fast clock is covered — that
 * much a few seconds would have done.
 *
 * The other job is the idle timeout. The server only learns that a
 * session is alive when it renews, so how stale its idea of "last used"
 * can be is decided here: renewing at half-life bounds it at half a
 * token lifetime, and the server pads its idle window by exactly that
 * (SESSION_IDLE_MINUTES in lib/refreshTokens.js). Renew later than this
 * and people get signed out short of the idle time they were promised. */
const RENEW_AT_FRACTION = 0.5

/* Forces a CORS preflight, which an origin the API does not know cannot
   pass — that is what stops a hostile page from spending the cookie. */
export const CLIENT_HEADER = { 'X-Requested-With': 'milktrack' }

/* Safari in private mode throws on storage rather than returning null. */
const read = (k) => { try { return localStorage.getItem(k) } catch { return null } }
const write = (k, v) => {
  try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v) } catch { /* ignore */ }
}

/* The session, for as long as this page is open. */
let accessToken    = null
let accessExpiry   = 0
let accessLifetime = 0

const listeners = new Set()

/** Called when the session ends underneath the app — expired, revoked, signed out. */
export function onSessionEnded(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function remember({ token, expiresIn }) {
  accessToken    = token || null
  accessLifetime = token && expiresIn ? Number(expiresIn) * 1000 : 0
  accessExpiry   = accessLifetime ? Date.now() + accessLifetime : 0
  write(SIGNED_IN_KEY, token ? '1' : null)
}

export function clearSession() {
  accessToken    = null
  accessExpiry   = 0
  accessLifetime = 0
  write(SIGNED_IN_KEY, null)
  LEGACY_KEYS.forEach(k => write(k, null))
}

function endSession(reason) {
  clearSession()
  if (reason) { try { sessionStorage.setItem(SIGNED_OUT_REASON_KEY, reason) } catch { /* ignore */ } }
  listeners.forEach(fn => { try { fn(reason) } catch { /* one listener must not stop the others */ } })
}

/**
 * Why the last session ended, read once and forgotten.
 *
 * Returns null when the user simply arrived at the sign-in page, so
 * nothing is said to someone who was never signed out.
 */
export function takeSignedOutReason() {
  try {
    const reason = sessionStorage.getItem(SIGNED_OUT_REASON_KEY)
    sessionStorage.removeItem(SIGNED_OUT_REASON_KEY)
    return reason
  } catch { return null }
}

/** Is this browser carrying a session — in memory, or a cookie left from a previous load? */
export function hasSession() {
  return Boolean(accessToken || read(SIGNED_IN_KEY) || read('mt_refresh'))
}

/* One renewal at a time. Without it a screen that fires six requests on
   mount would spend the cookie six times over, and the server would see
   five of them as a token replayed after it was rotated. */
let inFlight = null

async function doRefresh() {
  /* A token left in storage by the previous release buys one cookie and
     is then gone for good. */
  const legacy = read('mt_refresh')

  let r
  try {
    r = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      /* The point of the whole exercise: the cookie goes, and nothing in
         this file ever sees it. */
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...CLIENT_HEADER },
      body: JSON.stringify(legacy ? { refreshToken: legacy } : {}),
    })
  } catch {
    /* Offline or the server is unreachable. That says nothing about the
       session, so it is left intact and the caller sees a failed request
       it can retry. */
    throw new Error('Could not reach the server')
  }

  LEGACY_KEYS.forEach(k => write(k, null))

  if (r.status === 401 || r.status === 403) {
    /* The server has ended this session — idle too long, past its
       twelve-hour limit, signed out, or revoked because the account
       changed. Retrying cannot help, and the reason is worth keeping:
       "signed out after 30 minutes without activity" is the difference
       between a rule and a bug, to whoever is standing at the till. */
    const said = await r.json().catch(() => ({}))
    endSession(said.error || null)
    return null
  }
  if (!r.ok) throw new Error('Could not renew the session. Try again.')

  const data = await r.json()
  remember(data)
  return data.user ?? null
}

/**
 * Trade the cookie for a fresh access token.
 *
 * Resolves to the user the session belongs to, or null when there is no
 * session left to renew.
 */
export function refreshSession() {
  if (!inFlight) inFlight = doRefresh().finally(() => { inFlight = null })
  return inFlight
}

/** Called once on load: pick the session back up, or establish there is none. */
export async function restoreSession() {
  if (!hasSession()) return null
  try {
    return await refreshSession()
  } catch {
    /* The server could not be reached. Say "not signed in" for now rather
       than wiping a session that is probably still good — the next
       request will try again. */
    return null
  }
}

/** Store what a fresh sign-in returned. The cookie came with the response. */
export function startSession(data) {
  remember(data)
}

/**
 * A usable access token, renewed first if it is expired or nearly so.
 *
 * Returns null when there is no session — callers send the request
 * without a token and let the API answer 401, which is the right answer
 * for an anonymous visitor.
 */
export async function getAccessToken() {
  const renewAt = accessExpiry - accessLifetime * RENEW_AT_FRACTION
  if (accessToken && Date.now() < renewAt) return accessToken
  if (!hasSession()) return null
  await refreshSession()
  return accessToken
}

/**
 * Authorization header for a hand-rolled fetch — the file uploads and
 * downloads that cannot go through apiFetch because they are not JSON.
 * Always await it: it may have to renew the token first.
 */
export async function authHeaders(extra = {}) {
  const token = await getAccessToken()
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra }
}

/** Sign out: end the session on the server, and let it clear the cookie. */
export async function endSessionEverywhere() {
  clearSession()
  try {
    await fetch(`${BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...CLIENT_HEADER },
      body: '{}',
    })
  } catch {
    /* Offline, or the server is down. Nothing usable is left in this
       browser; the token expires on its own. */
  }
}
