import { useState } from 'react'
import { apiFetch } from '../lib/api'
import { Btn } from './ui'

/* ══════════════════════════════════════════════════════════════
   NEW PRODUCT — a sealed pack the processing unit makes

   Adding one here is what makes the workbook parser recognise it and the
   blank template give it rows, so the form is careful about the one mistake
   that matters: adding a misspelling of something that already exists. The
   server compares the name with every product it knows; a near match comes
   back asking to confirm, and that question is shown here as it is, with
   the person adding the product choosing which it is.

   Used on Stock & Issuing, and on the Processing Unit's upload result
   (prefilled from the unknown row) so a new product can be added and the
   month uploaded again without leaving the page.
══════════════════════════════════════════════════════════════ */

/** Litres per pack read off a size label — "250ML" → 0.25, "1L" → 1. Mirrors the server. */
export function guessLitres(size) {
  const s = String(size || '').toUpperCase().replace(/O(?=\.?\d)/g, '0')
  const m = /(\d*\.?\d+)\s*(ML|LTR|LITRES?|L)\b/.exec(s)
  if (!m) return ''
  const n = Number(m[1])
  if (!(n > 0)) return ''
  return String(m[2] === 'ML' ? Math.round(n) / 1000 : n)
}

const FIELD_LABEL = 'block text-[11px] uppercase tracking-wider mb-1'

export default function NewProductForm({ initial = {}, onAdded, onCancel, compact = false }) {
  const [form, setForm] = useState({
    product: initial.product || '',
    size: initial.size || '',
    litres_per_pack: initial.litres_per_pack != null ? String(initial.litres_per_pack) : guessLitres(initial.size),
    retail_price: '',
    wholesale_price: '',
  })
  // Litres follow the size as it is typed, until someone sets them by hand.
  const [litresTouched, setLitresTouched] = useState(initial.litres_per_pack != null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [confirmMsg, setConfirmMsg] = useState(null)

  const set = (key, value) => {
    setConfirmMsg(null); setError(null)
    setForm(f => {
      const next = { ...f, [key]: value }
      if (key === 'size' && !litresTouched) next.litres_per_pack = guessLitres(value)
      return next
    })
  }

  const submit = async (confirmNew = false) => {
    setBusy(true); setError(null)
    try {
      const created = await apiFetch('/products', {
        method: 'POST',
        body: JSON.stringify({
          sold_by: 'pack',
          product: form.product,
          size: form.size,
          litres_per_pack: form.litres_per_pack === '' ? null : Number(form.litres_per_pack),
          retail_price: Number(form.retail_price) || 0,
          wholesale_price: Number(form.wholesale_price) || 0,
          confirm_new: confirmNew,
        }),
      })
      setConfirmMsg(null)
      onAdded?.(created)
    } catch (err) {
      if (err.body?.needs_confirmation) setConfirmMsg(err.message)
      else setError(err.message)
    } finally { setBusy(false) }
  }

  const ready = form.product.trim() && form.size.trim() && Number(form.litres_per_pack) > 0

  const fields = [
    ['product', 'Product', 'e.g. Greek Yoghurt', 'text'],
    ['size', 'Pack size', 'e.g. 250ML', 'text'],
    ['litres_per_pack', 'Litres per pack', 'e.g. 0.25', 'number'],
    ...(compact ? [] : [
      ['retail_price', 'Retail (TSh)', '0', 'number'],
      ['wholesale_price', 'Wholesale (TSh)', '0', 'number'],
    ]),
  ]

  return (
    <div className="rounded-lg p-4" style={{ background: 'var(--cream-dark)' }}>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(130px, 100%), 1fr))' }}>
        {fields.map(([key, label, ph, type]) => (
          <div key={key}>
            <label className={FIELD_LABEL} style={{ color: 'var(--ink-60)' }}>{label}</label>
            <input type={type} step={type === 'number' ? 'any' : undefined} min={type === 'number' ? '0' : undefined}
              className="w-full" placeholder={ph} value={form[key]} aria-label={label}
              onChange={e => {
                if (key === 'litres_per_pack') setLitresTouched(true)
                set(key, e.target.value)
              }} />
          </div>
        ))}
      </div>
      {form.size.trim() && !(Number(form.litres_per_pack) > 0) && (
        <p className="text-xs mt-2" style={{ color: 'var(--amber)' }}>
          How many litres is one pack? It could not be read from “{form.size}”.
        </p>
      )}
      {error && <p className="text-xs mt-2" style={{ color: 'var(--red)' }}>✗ {error}</p>}
      {confirmMsg ? (
        <div className="mt-3 rounded-md p-3 text-xs" style={{ background: 'rgba(232,160,32,0.12)', color: 'var(--ink)' }}>
          <div className="mb-2">⚠ {confirmMsg}</div>
          <div className="flex gap-2 justify-end">
            <Btn size="sm" onClick={() => setConfirmMsg(null)}>Let me fix the name</Btn>
            <Btn size="sm" variant="primary" disabled={busy} onClick={() => submit(true)}>
              Yes, it is a new product
            </Btn>
          </div>
        </div>
      ) : (
        <div className="flex gap-2 justify-end mt-3">
          {onCancel && <Btn size="sm" onClick={onCancel}>Cancel</Btn>}
          <Btn size="sm" variant="primary" disabled={busy || !ready} onClick={() => submit(false)}>
            {busy ? 'Adding…' : 'Add product'}
          </Btn>
        </div>
      )}
    </div>
  )
}
