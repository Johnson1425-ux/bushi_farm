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
 *
 * usePrompt() is the same dialog with a field in it, standing in for
 * window.prompt() the way confirm() stands in for window.confirm(). It
 * resolves the trimmed text, or null if the question was declined — so a
 * call site reads the way the native one did:
 *
 *     const reason = await prompt({
 *       title: `Void ${sale.receipt_no}`,
 *       input: { label: 'Reason', required: true },
 *     })
 *     if (!reason) return
 */
const ConfirmContext = createContext(null)

const INPUT_DEFAULTS = {
  label: '',
  placeholder: '',
  defaultValue: '',
  required: true,
  maxLength: 200,
}

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

  /* The pending promise, parked in a ref so a re-render cannot lose it. A
     dialog that never settles would leave the caller's await hanging
     forever, which is a silently broken button.

     `declined` is what a question resolves to when it is not answered —
     false for a confirm, null for a prompt — so that superseding it and
     unmounting under it both know what "no" means here. */
  const pending = useRef(null)

  const settle = useCallback((answer) => {
    const p = pending.current
    pending.current = null
    setRequest(null)
    p?.resolve(answer)
  }, [])

  const open = useCallback((options, declined) => {
    const opts = typeof options === 'string' ? { message: options } : (options || {})
    return new Promise((resolve) => {
      /* A second question while one is still open — a double click on a
         delete button — declines the first rather than stranding it.
         Nothing was answered, so nothing should happen. */
      const previous = pending.current
      pending.current = { resolve, declined }
      previous?.resolve(previous.declined)
      setRequest({ ...DEFAULTS, input: null, ...opts })
    })
  }, [])

  /* A confirm is a yes or no, never a field: dropping any input here keeps
     the boolean it resolves honest whatever the caller passed. */
  const confirm = useCallback((options) => {
    const opts = typeof options === 'string' ? { message: options } : (options || {})
    return open({ ...opts, input: null }, false)
  }, [open])

  const prompt = useCallback((options) => {
    const opts = typeof options === 'string' ? { message: options } : (options || {})
    return open({ ...opts, input: { ...INPUT_DEFAULTS, ...(opts.input || {}) } }, null)
  }, [open])

  /* Unmounting with a question still open answers it for the same reason:
     an await that never returns is worse than a declined action. */
  useEffect(() => () => {
    pending.current?.resolve(pending.current.declined)
    pending.current = null
  }, [])

  /* One object, kept stable, so a page that takes confirm() out of context
     is not re-rendered every time this provider is. */
  const api = React.useMemo(() => ({ confirm, prompt }), [confirm, prompt])

  return (
    <ConfirmContext.Provider value={api}>
      {children}
      {request && <ConfirmDialog request={request} onSettle={settle} />}
    </ConfirmContext.Provider>
  )
}

function ConfirmDialog({ request, onSettle }) {
  const { title, message, detail, confirmLabel, cancelLabel, tone, input } = request
  const confirmRef = useRef(null)
  const inputRef = useRef(null)
  const [value, setValue] = useState(input?.defaultValue ?? '')

  /* What the question resolves to when it is declined: a prompt hands back
     null the way window.prompt did, a confirm hands back false. */
  const declined = input ? null : false
  const answer = input ? value.trim() : true
  const blocked = !!input?.required && !value.trim()

  const cancel = useCallback(() => onSettle(declined), [onSettle, declined])

  const accept = useCallback((e) => {
    e?.preventDefault()
    if (blocked) return
    onSettle(answer)
  }, [onSettle, answer, blocked])

  /* Escape cancels. Enter is left to the form: the deciding button is its
     submit control, so Enter confirms from anywhere inside the dialog —
     including from the field — and a required field still gets its say
     rather than being submitted empty by a keystroke the form never saw.
     The Escape listener is on the document because the click that opened
     the dialog may have left focus on a button behind the backdrop. */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); cancel() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [cancel])

  /* The page behind must not scroll away under the dialog — on a phone the
     backdrop covers the viewport and a scroll gesture would otherwise move
     the list the question is about. */
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [])

  /* Focus lands on the field when there is one to fill in, and otherwise
     on the deciding button, so the dialog is reachable by keyboard and
     read out by a screen reader the moment it opens. */
  useEffect(() => { (inputRef.current || confirmRef.current)?.focus() }, [])

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
      onMouseDown={e => { if (e.target === e.currentTarget) cancel() }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(10,30,20,0.45)', backdropFilter: 'blur(2px)' }}
    >
      <form
        onSubmit={accept}
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

            {input && (
              <div className="mt-3.5">
                {input.label && (
                  <label
                    htmlFor="confirm-input"
                    className="block text-[11px] uppercase tracking-wider font-medium mb-1.5"
                    style={{ color: 'var(--ink-60)' }}
                  >
                    {input.label}
                  </label>
                )}
                <input
                  id="confirm-input"
                  ref={inputRef}
                  type="text"
                  value={value}
                  onChange={e => setValue(e.target.value)}
                  placeholder={input.placeholder || undefined}
                  maxLength={input.maxLength || undefined}
                  required={!!input.required}
                  style={{ width: '100%' }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={cancel}
            className="inline-flex items-center justify-center font-medium rounded-lg border border-ink-10 px-4 py-2 text-sm cursor-pointer transition-all duration-150 hover:bg-cream-dark"
            style={{ background: 'var(--surface)', color: 'var(--ink)', outlineOffset: 2 }}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="submit"
            disabled={blocked}
            className={`inline-flex items-center justify-center font-medium rounded-lg border px-4 py-2 text-sm transition-all duration-150 ${blocked ? 'cursor-not-allowed' : 'cursor-pointer hover:opacity-90'}`}
            style={{ background: fill, borderColor: fill, color: fillText, outlineOffset: 2, opacity: blocked ? 0.5 : 1 }}
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  )
}

function useDialogs(hook) {
  const api = useContext(ConfirmContext)
  if (!api) throw new Error(`${hook}() needs a <ConfirmProvider> above it`)
  return api
}

/** An async confirm(): resolves true or false. */
export function useConfirm() {
  return useDialogs('useConfirm').confirm
}

/** An async prompt(): resolves the trimmed text, or null if declined. */
export function usePrompt() {
  return useDialogs('usePrompt').prompt
}
