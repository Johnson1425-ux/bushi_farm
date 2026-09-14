import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useTheme } from './ThemeContext'

/**
 * One confirmation dialog for the whole app.
 *
 * Every destructive action used to go through window.confirm(). That dialog
 * is the browser's, not ours: it ignores the theme, cannot say which farm or
 * which cow in anything but plain text, shows the site's hostname above the
 * question, and on some phones is dismissed by a stray tap before it has
 * been read. Worse, it blocks the main thread, so a background refresh
 * lands the moment it closes rather than while it is open.
 *
 * useConfirm() hands back an async confirm() that resolves true or false, so
 * a call site reads almost exactly as it did before:
 *
 *     if (!await confirm('Delete this record?')) return
 *
 * or, with the parts spelled out:
 *
 *     const ok = await confirm({
 *       title: 'Delete user',
 *       message: `Delete "${u.username}"?`,
 *       detail: 'This cannot be undone.',
 *       confirmLabel: 'Delete',
 *       tone: 'danger',
 *     })
 */
const ConfirmContext = createContext(null)

const DEFAULTS = {
  title: 'Are you sure?',
  message: '',
  detail: '',
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  tone: 'danger',
}

export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null)

  /* The pending promise's resolve, parked in a ref so a re-render cannot
     lose it. A dialog that never settles would leave the caller's await
     hanging forever, which is a silently broken button. */
  const resolver = useRef(null)

  const settle = useCallback((answer) => {
    const resolve = resolver.current
    resolver.current = null
    setRequest(null)
    resolve?.(answer)
  }, [])

  const confirm = useCallback((options) => {
    const opts = typeof options === 'string' ? { message: options } : (options || {})
    return new Promise((resolve) => {
      /* A second confirm() while one is still open — a double click on a
         delete button — answers the first with "no" rather than stranding
         it. Nothing was confirmed, so nothing should happen. */
      resolver.current?.(false)
      resolver.current = resolve
      setRequest({ ...DEFAULTS, ...opts })
    })
  }, [])

  /* Unmounting with a question still open answers it "no" for the same
     reason: an await that never returns is worse than a declined action. */
  useEffect(() => () => { resolver.current?.(false); resolver.current = null }, [])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {request && <ConfirmDialog request={request} onSettle={settle} />}
    </ConfirmContext.Provider>
  )
}

function ConfirmDialog({ request, onSettle }) {
  const { title, message, detail, confirmLabel, cancelLabel, tone } = request
  const confirmRef = useRef(null)

  /* Escape cancels, Enter confirms — the two keys the native dialog
     answered to, kept so the habit still works. The listener is on the
     document because the click that opened the dialog may have left focus
     on a button that is now behind the backdrop. */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onSettle(false) }
      else if (e.key === 'Enter') { e.preventDefault(); onSettle(true) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onSettle])

  /* The page behind must not scroll away under the dialog — on a phone the
     backdrop covers the viewport and a scroll gesture would otherwise move
     the list the question is about. */
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [])

  /* Focus lands on the deciding button so the dialog is reachable by
     keyboard and read out by a screen reader the moment it opens. */
  useEffect(() => { confirmRef.current?.focus() }, [])

  const { dark } = useTheme() || {}
  const danger = tone === 'danger'

  /* The deciding button is filled, so its label has to stay readable on
     whatever it is filled with. The palette's red and green are darkened
     for the light theme and lightened for the dark one, which flips which
     label colour has the contrast: white on the light theme's deep tones,
     near-black on the dark theme's bright ones. Reading a delete button
     wrong is exactly the mistake this dialog exists to prevent. */
  const fill = danger ? (dark ? 'var(--red)' : '#c23434') : 'var(--green-600)'
  const fillText = dark ? '#0f1a12' : '#fff'

  return (
    <div
      onMouseDown={e => { if (e.target === e.currentTarget) onSettle(false) }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(10,30,20,0.45)', backdropFilter: 'blur(2px)' }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={message ? 'confirm-message' : undefined}
        className="rounded-lg border border-ink-10 w-full max-w-[420px] p-6"
        style={{ background: 'var(--surface)', animation: 'fadeUp .15s ease', boxShadow: '0 18px 50px rgba(10,30,20,.28)' }}
      >
        <div className="flex items-start gap-3.5">
          <span
            aria-hidden="true"
            className="inline-flex items-center justify-center shrink-0 rounded-full text-base font-semibold"
            style={{
              width: 36, height: 36,
              background: danger ? 'rgba(217,64,64,0.12)' : 'var(--green-100)',
              color: danger ? 'var(--red)' : 'var(--green-800)',
            }}
          >
            {danger ? '!' : '?'}
          </span>
          <div className="min-w-0">
            <h2 id="confirm-title" className="font-serif text-[19px] leading-tight" style={{ color: 'var(--ink)' }}>
              {title}
            </h2>
            {message && (
              <p id="confirm-message" className="text-sm mt-2 whitespace-pre-line" style={{ color: 'var(--ink)' }}>
                {message}
              </p>
            )}
            {detail && (
              <p className="text-[12px] mt-2 whitespace-pre-line" style={{ color: 'var(--ink-60)' }}>
                {detail}
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={() => onSettle(false)}
            className="inline-flex items-center justify-center font-medium rounded-lg border border-ink-10 px-4 py-2 text-sm cursor-pointer transition-all duration-150 hover:bg-cream-dark"
            style={{ background: 'var(--surface)', color: 'var(--ink)', outlineOffset: 2 }}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={() => onSettle(true)}
            className="inline-flex items-center justify-center font-medium rounded-lg border px-4 py-2 text-sm cursor-pointer transition-all duration-150 hover:opacity-90"
            style={{ background: fill, borderColor: fill, color: fillText, outlineOffset: 2 }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export function useConfirm() {
  const confirm = useContext(ConfirmContext)
  if (!confirm) throw new Error('useConfirm() needs a <ConfirmProvider> above it')
  return confirm
}
