import React from 'react'
import toast, { Toaster as HotToaster } from 'react-hot-toast'

/**
 * One place the app says something went right or wrong.
 *
 * Three pages had each grown their own version of this — a <Notice> banner,
 * a piece of notice state, and a setTimeout to clear it — and two more
 * reached for window.alert(). They drifted: five seconds on the till, six
 * on stock, four on users, and an alert that waited for an OK it did not
 * need. The banners also pushed the page down as they appeared, so a table
 * jumped under the pointer at the moment the user was reading the result of
 * what they had just done.
 *
 * A toast sits above the page instead of displacing it, and every page gets
 * the same one:
 *
 *     notify.success('Branch added.')
 *     notify.error(e.message)
 *
 * Reserve these for things that happened — a save, a delete, a request that
 * failed. State that persists, and that the user has to act on, still
 * belongs on the page: a sign-in error next to the form, "no branch is
 * assigned to this account" where the branch would be, a report that could
 * not load in the panel it would have filled.
 */

/* Long enough to read without hunting for it, and an error stays longer
   than a success because it is the one you may need to read twice. */
const DURATION = { success: 4000, error: 6500, warn: 5500, info: 4500 }

const TONE = {
  success: { icon: '✓', fg: 'var(--green-800)', chip: 'var(--green-100)' },
  error:   { icon: '✕', fg: 'var(--red)',       chip: 'rgba(217,64,64,0.12)' },
  warn:    { icon: '!', fg: 'var(--amber)',     chip: 'rgba(232,160,32,0.15)' },
  info:    { icon: 'i', fg: 'var(--ink-60)',    chip: 'var(--cream-dark)' },
}

/**
 * The toast body: the tone's chip, the message, and the ✕ the banners had.
 *
 * The dismiss button is kept because these replace notices that carried one,
 * and an error the user has read and understood should not have to be waited
 * out before the next action.
 */
function Body({ id, kind, text }) {
  const tone = TONE[kind] || TONE.info
  return (
    <span className="flex items-start gap-2.5 w-full">
      <span
        aria-hidden="true"
        className="inline-flex items-center justify-center shrink-0 rounded-full text-[11px] font-semibold"
        style={{ width: 20, height: 20, marginTop: 1, background: tone.chip, color: tone.fg }}
      >
        {tone.icon}
      </span>
      <span className="flex-1 min-w-0" style={{ color: 'var(--ink)', wordBreak: 'break-word' }}>{text}</span>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => toast.dismiss(id)}
        className="border-0 bg-transparent cursor-pointer leading-none text-[13px] shrink-0"
        style={{ color: 'var(--ink-30)', marginTop: 2 }}
      >
        ✕
      </button>
    </span>
  )
}

/**
 * The toast currently showing each message, so a repeat replaces it.
 *
 * A failing request that retries — a poll, a panel reloading on every filter
 * change — used to overwrite one banner. Left alone it would stack the same
 * sentence half a dozen times instead, which reads as six problems rather
 * than one that has not gone away. Re-showing it also restarts the clock,
 * which re-showing the same toast id would not.
 */
const showing = new Map()

const push = (kind, text) => {
  const message = typeof text === 'string' ? text : String(text?.message || text || '')
  if (!message) return null

  const previous = showing.get(message)
  if (previous) toast.dismiss(previous)

  const id = toast.custom(
    (t) => (
      <div
        className="rounded-lg border border-ink-10 text-[13px]"
        style={{
          background: 'var(--surface)',
          padding: '11px 13px',
          /* One width for every toast rather than each sized to its own
             text: right-aligned, ragged left edges read as clutter when
             two or three stack up. */
          width: 'min(360px, calc(100vw - 32px))',
          boxShadow: '0 10px 32px rgba(10,30,20,.18)',
          /* react-hot-toast drives enter and exit from t.visible; without
             this the toast pops in and out with no transition at all. */
          opacity: t.visible ? 1 : 0,
          transform: t.visible ? 'none' : 'translateY(-8px)',
          transition: 'opacity .18s ease, transform .18s ease',
        }}
        role={kind === 'error' ? 'alert' : 'status'}
      >
        <Body id={t.id} kind={kind} text={message} />
      </div>
    ),
    { duration: DURATION[kind] ?? DURATION.info }
  )

  showing.set(message, id)
  /* Drop the bookkeeping once the toast is gone, or the map would grow for
     the life of the session. The extra second covers the exit animation. */
  setTimeout(() => {
    if (showing.get(message) === id) showing.delete(message)
  }, (DURATION[kind] ?? DURATION.info) + 1000)

  return id
}

export const notify = {
  success: (text) => push('success', text),
  error:   (text) => push('error',   text),
  warn:    (text) => push('warn',    text),
  info:    (text) => push('info',    text),
  dismiss: (id) => toast.dismiss(id),
}

/**
 * Mounted once, at the root — the public pages and the sign-in screen are
 * inside it too, not just the signed-in shell.
 *
 * The offset clears the headers that sit at the top of the two layouts: the
 * app's own bar on a phone, and the public site's sticky nav.
 */
export function Toaster() {
  return (
    <HotToaster
      position="top-right"
      containerStyle={{ top: 72, right: 16 }}
      gutter={10}
    />
  )
}

export default notify
