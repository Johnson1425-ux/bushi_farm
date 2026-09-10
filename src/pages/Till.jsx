import { useState, useEffect, useCallback, useMemo } from 'react'
import { apiFetch } from '../lib/api'
import { Card, CardTitle, Btn, PageHeader, EmptyState } from '../components/ui'
import { useAuth } from '../lib/AuthContext'

/* ══════════════════════════════════════════════════════════════
   THE TILL

   Selling is fast, repetitive work, so the page is built around one
   motion: tap a product, it lands in the basket. Quantities are adjusted
   in the basket rather than asked for up front, because most sales are
   one or two of a thing and typing a "1" every time is friction paid on
   every customer.

   The farm sells on two price lists — over the counter, and to the
   agents who take a crate at a time — so the till leads with which one
   is in use. Switching it reprices the whole basket, because that is
   almost always what was meant; a single line can still be flipped on
   its own for the customer who buys a crate and a bottle.

   The second tab is the end of the day. Everything the receipts already
   know is filled in; what the attendant supplies is only what no receipt
   records — money collected against old debts, money paid out of the
   drawer, and what was actually counted.
══════════════════════════════════════════════════════════════ */

const fmt    = (n, dec = 0) => Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: dec })
const fmtTsh = (n) => `TSh ${fmt(n, 2)}`
const num    = (v) => Number(v) || 0
const today  = () => new Date().toISOString().slice(0, 10)

const PAYMENT_METHODS = [['cash', 'Cash'], ['mobile', 'Mobile'], ['card', 'Card'], ['credit', 'Credit']]
const TIERS = [['retail', 'Retail'], ['wholesale', 'Wholesale']]

/** The list price for a tier. An unset wholesale price falls back to
    retail — the same rule the server applies, so the basket total the
    attendant sees is the one the receipt will carry. */
const priceFor = (p, tier) =>
  (tier === 'wholesale' && num(p.wholesale_price) > 0) ? num(p.wholesale_price) : num(p.retail_price)

const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #receipt-print, #receipt-print * { visibility: visible !important; }
  #receipt-print {
    position: absolute; left: 0; top: 0; width: 100%;
    padding: 0; margin: 0; background: #fff; color: #000;
  }
  #receipt-print .no-print { display: none !important; }
}
`

function Notice({ kind = 'error', children, onClose }) {
  const styles = {
    error:   { bg: 'rgba(217,64,64,0.08)', border: 'var(--red)',       color: 'var(--red)' },
    success: { bg: 'var(--green-50)',      border: 'var(--green-100)', color: 'var(--green-800)' },
    warn:    { bg: 'rgba(232,160,32,0.1)', border: 'var(--amber)',     color: 'var(--amber)' },
  }[kind]
  return (
    <div className="rounded-lg border mb-4 text-[13px] flex items-start justify-between gap-3"
      style={{ padding: '10px 16px', background: styles.bg, borderColor: styles.border, color: styles.color }}>
      <div className="flex-1">{children}</div>
      {onClose && (
        <button onClick={onClose} className="border-0 bg-transparent cursor-pointer leading-none"
          style={{ color: 'inherit', opacity: 0.6 }}>✕</button>
      )}
    </div>
  )
}

function Segmented({ options, value, onChange, size = 'md' }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {options.map(([v, label]) => (
        <button key={v} onClick={() => onChange(v)}
          className={`rounded-lg border cursor-pointer ${size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-3 py-1.5'}`}
          style={{
            background: value === v ? 'var(--green-600)' : 'transparent',
            color: value === v ? '#fff' : 'var(--ink-60)',
            borderColor: value === v ? 'var(--green-600)' : 'var(--ink-10)',
          }}>{label}</button>
      ))}
    </div>
  )
}

function TabBtn({ label, active, onClick, badge }) {
  return (
    <button onClick={onClick} className="px-4 py-2 text-sm font-medium border-0 bg-transparent cursor-pointer"
      style={{
        color: active ? 'var(--green-600)' : 'var(--ink-60)',
        borderBottom: active ? '2px solid var(--green-600)' : '2px solid transparent',
      }}>
      {label}
      {badge && (
        <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
          style={{ background: 'var(--amber)', color: '#fff' }}>{badge}</span>
      )}
    </button>
  )
}

/* ── the receipt, on screen and on paper ── */
function Receipt({ sale, onClose, onVoid, canVoid }) {
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(10,30,20,0.45)' }}>
      <style>{PRINT_CSS}</style>
      <div id="receipt-print" className="rounded-[16px] w-full max-w-sm p-7 max-h-[90vh] overflow-y-auto"
        style={{ background: 'var(--surface)' }}>
        <div className="text-center mb-4">
          <div className="font-serif text-[20px]" style={{ color: 'var(--ink)' }}>Bushi Farm</div>
          <div className="text-xs" style={{ color: 'var(--ink-60)' }}>{sale.branch_name}</div>
        </div>

        <div className="text-xs mb-3 pb-3" style={{ color: 'var(--ink-60)', borderBottom: '1px dashed var(--ink-10)' }}>
          <div className="flex justify-between"><span>Receipt</span><span style={{ fontFamily: "'DM Mono', monospace" }}>{sale.receipt_no}</span></div>
          <div className="flex justify-between"><span>Date</span><span>{sale.sold_on}</span></div>
          <div className="flex justify-between"><span>Served by</span><span>{sale.cashier || '—'}</span></div>
          {sale.customer_name && <div className="flex justify-between"><span>Customer</span><span>{sale.customer_name}</span></div>}
        </div>

        <table className="w-full text-[12px] mb-3">
          <tbody>
            {sale.items.map(i => (
              <tr key={i.id}>
                <td className="py-1" style={{ color: 'var(--ink)' }}>
                  {i.product} {i.size}
                  <div style={{ color: 'var(--ink-60)', fontSize: 11 }}>
                    {fmt(i.units)} × {fmtTsh(i.unit_price)}
                    {i.price_tier === 'wholesale' && ' (wholesale)'}
                  </div>
                </td>
                <td className="py-1 text-right align-top" style={{ fontFamily: "'DM Mono', monospace" }}>
                  {fmtTsh(i.line_total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="text-[13px] pt-3" style={{ borderTop: '1px dashed var(--ink-10)' }}>
          <div className="flex justify-between" style={{ color: 'var(--ink-60)' }}>
            <span>Subtotal</span><span>{fmtTsh(sale.subtotal)}</span>
          </div>
          {num(sale.discount) > 0 && (
            <div className="flex justify-between" style={{ color: 'var(--amber)' }}>
              <span>Discount</span><span>−{fmtTsh(sale.discount)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold mt-1" style={{ fontSize: 16, color: 'var(--ink)' }}>
            <span>Total</span><span>{fmtTsh(sale.total)}</span>
          </div>
          <div className="flex justify-between mt-1" style={{ color: 'var(--ink-60)' }}>
            <span>Paid by</span><span className="capitalize">{sale.payment_method}</span>
          </div>
        </div>

        {sale.status === 'voided' && (
          <div className="mt-3 text-center text-[13px] font-semibold py-2 rounded"
            style={{ background: 'rgba(217,64,64,0.1)', color: 'var(--red)' }}>
            VOIDED — {sale.void_reason}
          </div>
        )}

        <div className="text-center text-[11px] mt-4" style={{ color: 'var(--ink-30)' }}>Thank you</div>

        <div className="no-print flex gap-2 justify-end mt-5">
          {canVoid && sale.status !== 'voided' && (
            <Btn size="sm" variant="danger" onClick={() => onVoid(sale)}>Void</Btn>
          )}
          <Btn size="sm" onClick={() => window.print()}>Print</Btn>
          <Btn size="sm" variant="primary" onClick={onClose}>Done</Btn>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   CASH UP
══════════════════════════════════════════════════════════════ */
function CashUp({ branchId, isAttendant, onNotice }) {
  const [date,    setDate]    = useState(today())
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy,    setBusy]    = useState(false)
  const [form,    setForm]    = useState(null)
  const [expenses, setExpenses] = useState([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const q = new URLSearchParams({ date })
      if (!isAttendant && branchId) q.set('branch_id', branchId)
      const d = await apiFetch(`/pos/cash-up?${q}`)
      setData(d)
      setForm({
        debtor_receipts: d.debtor_receipts || '',
        prepaids:        d.prepaids || '',
        counted_cash:    d.counted_cash || '',
        mobile_counted:  d.mobile_counted || '',
        bank_deposit:    d.bank_deposit || '',
        float_retained:  d.float_retained || '',
        notes:           d.notes || '',
      })
      setExpenses(d.expenses.length ? d.expenses.map(e => ({ ...e })) : [])
    } catch (e) {
      onNotice({ kind: 'error', text: e.message })
    } finally { setLoading(false) }
  }, [date, branchId, isAttendant, onNotice])

  useEffect(() => { load() }, [load])

  /* The expected figure is recomputed here as the attendant types, from
     the same arithmetic the server uses, so the variance moves while they
     are still counting rather than only after a save. */
  const expenseTotal = expenses.reduce((a, e) => a + num(e.amount), 0)
  const expected = data
    ? num(data.takings.cash_sales) + num(form?.debtor_receipts) + num(form?.prepaids) - expenseTotal
    : 0
  const variance = num(form?.counted_cash) - expected

  const save = async (close) => {
    if (close && !confirm('Close the day? The count is signed off and only a manager can reopen it.')) return
    setBusy(true)
    try {
      const d = await apiFetch('/pos/cash-up', {
        method: 'POST',
        body: JSON.stringify({
          ...(isAttendant ? {} : { branch_id: branchId }),
          date,
          debtor_receipts: num(form.debtor_receipts),
          prepaids:        num(form.prepaids),
          counted_cash:    num(form.counted_cash),
          mobile_counted:  num(form.mobile_counted),
          bank_deposit:    num(form.bank_deposit),
          float_retained:  num(form.float_retained),
          notes:           form.notes,
          expenses:        expenses.filter(e => num(e.amount) > 0 && e.description?.trim()),
          close,
        }),
      })
      setData(d)
      onNotice({ kind: 'success', text: close ? `${date} closed.` : 'Cash-up saved.' })
      if (close) await load()
    } catch (e) {
      onNotice({ kind: 'error', text: e.message })
    } finally { setBusy(false) }
  }

  const reopen = async () => {
    try {
      setData(await apiFetch(`/pos/cash-up/${data.id}/reopen`, { method: 'POST', body: JSON.stringify({}) }))
      onNotice({ kind: 'success', text: 'Day reopened.' })
      await load()
    } catch (e) { onNotice({ kind: 'error', text: e.message }) }
  }

  if (loading || !data) return <div className="p-8 text-center text-sm" style={{ color: 'var(--ink-30)' }}>Loading…</div>

  const closed = data.status === 'closed'
  const locked = closed && isAttendant
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const Money = ({ label, value, onChange, hint, disabled }) => (
    <div>
      <label className="block text-[11px] font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--ink-60)' }}>{label}</label>
      <input type="number" min="0" step="any" value={value} disabled={disabled}
        onChange={e => onChange(e.target.value)} placeholder="0" className="w-full" />
      {hint && <div className="text-[11px] mt-0.5" style={{ color: 'var(--ink-30)' }}>{hint}</div>}
    </div>
  )

  return (
    <div>
      <div className="flex flex-wrap gap-3 items-center rounded-lg mb-4 p-4" style={{ background: 'var(--cream-dark)' }}>
        <span className="text-xs uppercase tracking-wider font-medium" style={{ color: 'var(--ink-60)' }}>Trading day</span>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} max={today()} />
        {closed && (
          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider"
            style={{ background: 'var(--green-100)', color: 'var(--green-800)' }}>
            closed by {data.closed_by}
          </span>
        )}
        {closed && !isAttendant && <Btn size="sm" onClick={reopen}>Reopen</Btn>}
      </div>

      <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        {/* What the receipts already say. */}
        <Card>
          <CardTitle>The day's takings</CardTitle>
          <p className="text-xs mb-3" style={{ color: 'var(--ink-60)' }}>
            Read back from the receipts — nothing to enter here.
          </p>
          {[
            ['Receipts',      fmt(data.takings.receipts),          'var(--ink)'],
            ['Total sales',   fmtTsh(data.takings.sales),          'var(--ink)'],
            ['Cash',          fmtTsh(data.takings.cash_sales),     'var(--green-600)'],
            ['Mobile',        fmtTsh(data.takings.mobile_sales),   'var(--ink-60)'],
            ['Card',          fmtTsh(data.takings.card_sales),     'var(--ink-60)'],
            ['On credit',     fmtTsh(data.takings.credit_sales),   'var(--amber)'],
            ['Discounts',     fmtTsh(data.takings.discounts),      'var(--ink-60)'],
          ].map(([label, value, color]) => (
            <div key={label} className="flex justify-between py-1.5 text-[13px]"
              style={{ borderBottom: '1px solid var(--ink-10)' }}>
              <span style={{ color: 'var(--ink-60)' }}>{label}</span>
              <span style={{ color, fontWeight: 500, fontFamily: "'DM Mono', monospace" }}>{value}</span>
            </div>
          ))}
          <div className="text-[11px] mt-2" style={{ color: 'var(--ink-30)' }}>
            Credit sales are not expected in the drawer — no money changed hands.
          </div>
        </Card>

        {/* What only a person knows. */}
        <Card>
          <CardTitle>Money in and out</CardTitle>
          <div className="grid gap-3 mb-4">
            <Money label="Collected from debtors" value={form.debtor_receipts} disabled={locked}
              onChange={v => set('debtor_receipts', v)} hint="Paid against an earlier credit sale" />
            <Money label="Taken in advance" value={form.prepaids} disabled={locked}
              onChange={v => set('prepaids', v)} hint="Paid now for a delivery later" />
          </div>

          <div className="text-[11px] font-medium uppercase tracking-wider mb-1.5" style={{ color: 'var(--ink-60)' }}>
            Paid out of the drawer
          </div>
          {expenses.map((e, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input type="text" placeholder="What for" value={e.description || ''} disabled={locked}
                onChange={ev => setExpenses(list => list.map((x, j) => j === i ? { ...x, description: ev.target.value } : x))}
                style={{ flex: 1 }} />
              <input type="number" min="0" step="any" placeholder="0" value={e.amount ?? ''} disabled={locked}
                onChange={ev => setExpenses(list => list.map((x, j) => j === i ? { ...x, amount: ev.target.value } : x))}
                style={{ width: 110, textAlign: 'right' }} />
              {!locked && (
                <button onClick={() => setExpenses(list => list.filter((_, j) => j !== i))}
                  className="border-0 bg-transparent cursor-pointer px-1" style={{ color: 'var(--ink-30)' }}>✕</button>
              )}
            </div>
          ))}
          {!locked && (
            <Btn size="sm" onClick={() => setExpenses(list => [...list, { description: '', amount: '' }])}>
              + Add expense
            </Btn>
          )}
          {expenses.length > 0 && (
            <div className="flex justify-between text-[13px] mt-3 pt-2" style={{ borderTop: '1px solid var(--ink-10)' }}>
              <span style={{ color: 'var(--ink-60)' }}>Expenses</span>
              <span style={{ color: 'var(--red)', fontFamily: "'DM Mono', monospace" }}>−{fmtTsh(expenseTotal)}</span>
            </div>
          )}
        </Card>

        {/* The count. */}
        <Card>
          <CardTitle>The count</CardTitle>
          <div className="grid gap-3 mb-4">
            <Money label="Cash counted" value={form.counted_cash} disabled={locked}
              onChange={v => set('counted_cash', v)} />
            <Money label="Mobile money received" value={form.mobile_counted} disabled={locked}
              onChange={v => set('mobile_counted', v)}
              hint={`Receipts say ${fmtTsh(data.takings.mobile_sales)}`} />
            <Money label="Banked" value={form.bank_deposit} disabled={locked}
              onChange={v => set('bank_deposit', v)} />
            <Money label="Float kept in the shop" value={form.float_retained} disabled={locked}
              onChange={v => set('float_retained', v)} />
          </div>

          <div className="rounded-lg p-4" style={{ background: 'var(--cream-dark)' }}>
            <div className="flex justify-between text-[13px] mb-1" style={{ color: 'var(--ink-60)' }}>
              <span>Cash sales</span><span>{fmtTsh(data.takings.cash_sales)}</span>
            </div>
            <div className="flex justify-between text-[13px] mb-1" style={{ color: 'var(--ink-60)' }}>
              <span>+ debtors, prepaid</span><span>{fmtTsh(num(form.debtor_receipts) + num(form.prepaids))}</span>
            </div>
            <div className="flex justify-between text-[13px] mb-2" style={{ color: 'var(--ink-60)' }}>
              <span>− expenses</span><span>{fmtTsh(expenseTotal)}</span>
            </div>
            <div className="flex justify-between text-[14px] font-semibold pt-2"
              style={{ borderTop: '1px solid var(--ink-10)', color: 'var(--ink)' }}>
              <span>Drawer should hold</span><span>{fmtTsh(expected)}</span>
            </div>
            <div className="flex justify-between text-[16px] font-semibold mt-2"
              style={{ color: Math.abs(variance) < 0.005 ? 'var(--green-600)' : 'var(--red)' }}>
              <span>{variance > 0 ? 'Over by' : variance < 0 ? 'Short by' : 'Balanced'}</span>
              <span>{Math.abs(variance) < 0.005 ? '✓' : fmtTsh(Math.abs(variance))}</span>
            </div>
          </div>

          <div className="mt-3">
            <label className="block text-[11px] font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--ink-60)' }}>Notes</label>
            <input type="text" value={form.notes} disabled={locked}
              onChange={e => set('notes', e.target.value)}
              placeholder="Anything worth explaining" className="w-full" />
          </div>

          {!locked && (
            <div className="flex gap-2 justify-end mt-4">
              <Btn size="sm" disabled={busy} onClick={() => save(false)}>Save</Btn>
              <Btn size="sm" variant="primary" disabled={busy} onClick={() => save(true)}>
                {closed ? 'Re-close day' : 'Close the day'}
              </Btn>
            </div>
          )}
          {locked && (
            <div className="text-xs mt-3" style={{ color: 'var(--ink-60)' }}>
              This day is closed. Ask a manager to reopen it if the count was wrong.
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   PAGE
══════════════════════════════════════════════════════════════ */
export default function Till() {
  const { user } = useAuth()
  const isAttendant = user?.role === 'attendant'

  const [tab,        setTab]        = useState('sell')
  const [branchId,   setBranchId]   = useState(user?.branch_id ?? null)
  const [branches,   setBranches]   = useState([])
  const [catalogue,  setCatalogue]  = useState([])
  const [recent,     setRecent]     = useState([])
  const [day,        setDay]        = useState(null)
  const [tier,       setTier]       = useState('retail')
  const [cart,       setCart]       = useState({})
  const [customer,   setCustomer]   = useState('')
  const [payment,    setPayment]    = useState('cash')
  const [discount,   setDiscount]   = useState('')
  const [busy,       setBusy]       = useState(false)
  const [loading,    setLoading]    = useState(true)
  const [notice,     setNotice]     = useState(null)
  const [receipt,    setReceipt]    = useState(null)
  const [error,      setError]      = useState(null)

  const load = useCallback(async () => {
    try {
      const brs = await apiFetch('/branches')
      setBranches(brs)
      const id = branchId ?? brs[0]?.id ?? null
      if (!id) {
        setError('No branch is assigned to this account yet. Ask an admin to set one.')
        return
      }
      if (id !== branchId) setBranchId(id)

      const q = isAttendant ? '' : `?branch_id=${id}`
      const [cat, sales, dayTotals] = await Promise.all([
        apiFetch(`/pos/catalogue${q}`),
        apiFetch(`/pos/sales${isAttendant ? '?limit=20' : `?branch_id=${id}&limit=20`}`),
        apiFetch(`/pos/day${q}`),
      ])
      setCatalogue(cat); setRecent(sales); setDay(dayTotals); setError(null)
    } catch (e) {
      setError(e.message)
    } finally { setLoading(false) }
  }, [branchId, isAttendant])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 5000)
    return () => clearTimeout(t)
  }, [notice])

  /* A basket line remembers its own tier. Switching the till's tier
     repoints every line that had not been flipped by hand, so the common
     case — this whole sale is an agent's — is one tap. */
  const add = (p) => setCart(c => ({
    ...c,
    [p.product_id]: { units: (c[p.product_id]?.units || 0) + 1, tier: c[p.product_id]?.tier ?? null },
  }))
  const setQty = (id, units) => setCart(c => {
    const next = { ...c }
    if (units <= 0) delete next[id]
    else next[id] = { ...next[id], units }
    return next
  })
  const flipTier = (id, current) => setCart(c => ({
    ...c, [id]: { ...c[id], tier: current === 'retail' ? 'wholesale' : 'retail' },
  }))

  const lines = useMemo(() => Object.entries(cart).map(([id, entry]) => {
    const p = catalogue.find(c => String(c.product_id) === String(id))
    if (!p) return null
    const lineTier = entry.tier || tier
    const price = priceFor(p, lineTier)
    return {
      ...p,
      available: p.units,
      units: entry.units,
      tier: lineTier,
      pinned: !!entry.tier,
      price,
      lineTotal: entry.units * price,
      over: entry.units > p.units,
    }
  }).filter(Boolean), [cart, catalogue, tier])

  const subtotal = lines.reduce((a, l) => a + l.lineTotal, 0)
  const disc     = Math.min(Math.max(num(discount), 0), subtotal)
  const total    = subtotal - disc
  const anyOver  = lines.some(l => l.over)

  const complete = async () => {
    setBusy(true)
    try {
      const sale = await apiFetch('/pos/sales', {
        method: 'POST',
        body: JSON.stringify({
          ...(isAttendant ? {} : { branch_id: branchId }),
          sold_on: today(),
          payment_method: payment,
          price_tier: tier,
          customer_name: customer || null,
          discount: disc,
          items: lines.map(l => ({
            product_id: l.product_id,
            units: l.units,
            /* Only a line the attendant deliberately flipped names its own
               tier; the rest follow the sale, so the server and the screen
               price them the same way. */
            ...(l.pinned ? { price_tier: l.tier } : {}),
          })),
        }),
      })
      setCart({}); setCustomer(''); setDiscount(''); setPayment('cash')
      setReceipt(sale)
      await load()
    } catch (e) {
      const short = e.body?.shortfalls
      setNotice({
        kind: 'error',
        text: short?.length
          ? `${e.message}: ` + short.map(s => `${s.product} ${s.size} (${fmt(s.wanted)} wanted, ${fmt(s.on_hand)} on hand)`).join('; ')
          : e.message,
      })
    } finally { setBusy(false) }
  }

  const voidSale = async (sale) => {
    const reason = prompt(`Void ${sale.receipt_no}? Give a reason — it goes on the record.`)
    if (!reason || !reason.trim()) return
    try {
      await apiFetch(`/pos/sales/${sale.id}/void`, {
        method: 'POST', body: JSON.stringify({ reason: reason.trim() }),
      })
      setNotice({ kind: 'success', text: `${sale.receipt_no} voided and the stock put back.` })
      setReceipt(null)
      await load()
    } catch (e) {
      setNotice({ kind: 'error', text: e.message })
    }
  }

  const openReceipt = async (id) => {
    try { setReceipt(await apiFetch(`/pos/sales/${id}`)) }
    catch (e) { setNotice({ kind: 'error', text: e.message }) }
  }

  if (loading) return <div className="p-8 text-center text-sm" style={{ color: 'var(--ink-30)' }}>Loading…</div>

  if (error) {
    return (
      <div style={{ animation: 'fadeUp .2s ease' }}>
        <PageHeader title="Till" sub="Sell from branch stock" />
        <Card><EmptyState>{error}</EmptyState></Card>
      </div>
    )
  }

  const branchName = branches.find(b => b.id === branchId)?.name || 'Till'

  return (
    <div style={{ animation: 'fadeUp .2s ease' }}>
      <PageHeader title={`Till — ${branchName}`} sub="Sell from branch stock and close the day">
        {!isAttendant && branches.length > 1 && (
          <select value={branchId ?? ''} onChange={e => { setLoading(true); setCart({}); setBranchId(Number(e.target.value)) }}>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
      </PageHeader>

      {notice && <Notice kind={notice.kind} onClose={() => setNotice(null)}>{notice.text}</Notice>}

      {day && (
        <div className="grid gap-3.5 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
          {[
            { label: "Today's takings", value: fmtTsh(day.revenue), color: 'var(--green-600)' },
            { label: 'Receipts',        value: fmt(day.receipts),   color: 'var(--ink)' },
            { label: 'Cash',            value: fmtTsh(day.cash),    color: 'var(--ink-60)' },
            { label: 'Mobile',          value: fmtTsh(day.mobile),  color: 'var(--ink-60)' },
            { label: 'On credit',       value: fmtTsh(day.credit),  color: num(day.credit) ? 'var(--amber)' : 'var(--ink-30)' },
          ].map(k => (
            <div key={k.label} className="rounded-lg border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--ink-10)' }}>
              <div className="text-[11px] uppercase tracking-wider font-medium mb-1" style={{ color: 'var(--ink-60)' }}>{k.label}</div>
              <div className="font-semibold" style={{ fontSize: 19, color: k.color, lineHeight: 1.2 }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex mb-5" style={{ borderBottom: '1px solid var(--ink-10)' }}>
        <TabBtn label="Sell" active={tab === 'sell'} onClick={() => setTab('sell')}
          badge={lines.length || null} />
        <TabBtn label="Cash up" active={tab === 'cashup'} onClick={() => setTab('cashup')} />
      </div>

      {tab === 'cashup' && (
        <CashUp branchId={branchId} isAttendant={isAttendant} onNotice={setNotice} />
      )}

      {tab === 'sell' && (
        <div className="grid gap-5" style={{ gridTemplateColumns: 'minmax(0, 1.5fr) minmax(280px, 1fr)' }}>
          {/* ── products ── */}
          <div style={{ minWidth: 0 }}>
            <Card>
              <CardTitle>
                Tap to add
                <span className="flex items-center gap-2 font-normal">
                  <span className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--ink-60)' }}>Price list</span>
                  <Segmented options={TIERS} value={tier} onChange={setTier} />
                </span>
              </CardTitle>
              {catalogue.length === 0 ? (
                <EmptyState>Nothing in stock at this branch yet.</EmptyState>
              ) : (
                <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
                  {catalogue.map(p => {
                    const inCart = cart[p.product_id]?.units || 0
                    const out    = p.units <= 0
                    const price  = priceFor(p, tier)
                    const noPrice = price <= 0
                    const usingRetailFallback = tier === 'wholesale' && num(p.wholesale_price) <= 0 && price > 0
                    return (
                      <button key={p.product_id} onClick={() => add(p)} disabled={out || noPrice}
                        className="rounded-lg border text-left p-3 cursor-pointer transition-all"
                        style={{
                          background: inCart ? 'var(--green-50)' : 'var(--surface)',
                          borderColor: inCart ? 'var(--green-600)' : 'var(--ink-10)',
                          opacity: out || noPrice ? 0.45 : 1,
                          cursor: out || noPrice ? 'not-allowed' : 'pointer',
                        }}>
                        <div className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>{p.product}</div>
                        <div className="text-[11px] mb-1.5" style={{ color: 'var(--ink-60)', fontFamily: "'DM Mono', monospace" }}>{p.size}</div>
                        <div className="text-[13px] font-semibold" style={{ color: 'var(--green-600)' }}>
                          {noPrice ? 'No price set' : fmtTsh(price)}
                        </div>
                        <div className="text-[11px] mt-0.5" style={{ color: out ? 'var(--red)' : 'var(--ink-30)' }}>
                          {out ? 'Out of stock' : `${fmt(p.units)} in stock`}
                          {inCart > 0 && ` · ${inCart} in basket`}
                        </div>
                        {usingRetailFallback && (
                          <div className="text-[10px] mt-0.5" style={{ color: 'var(--amber)' }}>retail price — no wholesale set</div>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </Card>

            <Card noPad>
              <div className="px-5 pt-4 pb-1"><CardTitle>Recent receipts</CardTitle></div>
              <div style={{ overflowX: 'auto' }}>
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr>
                      {['Receipt', 'Time', 'List', 'Items', 'Total', 'Paid'].map(h => (
                        <th key={h} className="text-left px-5 py-3 text-[11px] font-semibold tracking-wider uppercase border-b"
                          style={{ color: 'var(--ink-60)', borderColor: 'var(--ink-10)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recent.length === 0 && (
                      <tr><td colSpan={6}><EmptyState>No sales yet.</EmptyState></td></tr>
                    )}
                    {recent.map(r => (
                      <tr key={r.id} style={{ opacity: r.status === 'voided' ? 0.5 : 1 }}>
                        <td className="px-5 py-3 border-b" style={{ borderColor: 'var(--ink-10)' }}>
                          <button onClick={() => openReceipt(r.id)}
                            className="border-0 bg-transparent cursor-pointer font-semibold text-[13px]"
                            style={{ color: 'var(--green-600)', fontFamily: "'DM Mono', monospace" }}>
                            {r.receipt_no}
                          </button>
                          {r.status === 'voided' && (
                            <span className="ml-2 text-[10px] uppercase tracking-wider font-bold" style={{ color: 'var(--red)' }}>void</span>
                          )}
                        </td>
                        <td className="px-5 py-3 border-b text-[12px]" style={{ borderColor: 'var(--ink-10)', color: 'var(--ink-60)', fontFamily: "'DM Mono', monospace" }}>
                          {new Date(r.sold_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-5 py-3 border-b text-[12px] capitalize" style={{ borderColor: 'var(--ink-10)', color: 'var(--ink-60)' }}>{r.price_tier}</td>
                        <td className="px-5 py-3 border-b" style={{ borderColor: 'var(--ink-10)', color: 'var(--ink-60)' }}>{r.lines}</td>
                        <td className="px-5 py-3 border-b font-semibold" style={{ borderColor: 'var(--ink-10)', color: 'var(--ink)' }}>
                          {fmtTsh(r.total)}
                        </td>
                        <td className="px-5 py-3 border-b capitalize text-[12px]" style={{ borderColor: 'var(--ink-10)', color: 'var(--ink-60)' }}>{r.payment_method}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* ── basket ── */}
          <div style={{ minWidth: 0 }}>
            <Card style={{ position: 'sticky', top: 16 }}>
              <CardTitle>
                Basket
                {lines.length > 0 && (
                  <button onClick={() => setCart({})} className="border-0 bg-transparent cursor-pointer text-[11px]"
                    style={{ color: 'var(--ink-30)' }}>clear</button>
                )}
              </CardTitle>

              {lines.length === 0 ? (
                <EmptyState>Tap a product to start a sale.</EmptyState>
              ) : (
                <>
                  <div className="mb-3">
                    {lines.map(l => (
                      <div key={l.product_id} className="flex items-center gap-2 py-2"
                        style={{ borderBottom: '1px solid var(--ink-10)' }}>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] truncate" style={{ color: 'var(--ink)' }}>{l.product} {l.size}</div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px]" style={{ color: l.over ? 'var(--red)' : 'var(--ink-60)' }}>
                              {fmtTsh(l.price)} each{l.over && ` · only ${fmt(l.available)} on the shelf`}
                            </span>
                            <button onClick={() => flipTier(l.product_id, l.tier)}
                              title="Switch this line's price list"
                              className="border-0 cursor-pointer rounded-full px-1.5 py-0 text-[10px] uppercase tracking-wider"
                              style={{
                                background: l.tier === 'wholesale' ? 'rgba(52,120,200,0.12)' : 'var(--ink-10)',
                                color: l.tier === 'wholesale' ? 'var(--blue)' : 'var(--ink-60)',
                              }}>
                              {l.tier === 'wholesale' ? 'whlsl' : 'retail'}
                            </button>
                          </div>
                        </div>
                        <input type="number" min="0" step="1" value={l.units}
                          onChange={e => setQty(l.product_id, Math.max(0, parseInt(e.target.value, 10) || 0))}
                          style={{ width: 62, textAlign: 'right', borderColor: l.over ? 'var(--red)' : undefined }} />
                        <div className="text-[13px] font-semibold text-right" style={{ width: 84, fontFamily: "'DM Mono', monospace" }}>
                          {fmtTsh(l.lineTotal)}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-2.5 mb-3">
                    <div>
                      <label className="block text-[11px] font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--ink-60)' }}>Payment</label>
                      <Segmented options={PAYMENT_METHODS} value={payment} onChange={setPayment} />
                      {payment === 'credit' && (
                        <div className="text-[11px] mt-1" style={{ color: 'var(--amber)' }}>
                          No money now — this will not be expected in the drawer at cash-up.
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--ink-60)' }}>
                        Customer {payment === 'credit' && <span style={{ color: 'var(--amber)' }}>· needed for credit</span>}
                      </label>
                      <input type="text" value={customer} onChange={e => setCustomer(e.target.value)}
                        placeholder="Name" className="w-full" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--ink-60)' }}>Discount (TSh)</label>
                      <input type="number" min="0" step="any" value={discount}
                        onChange={e => setDiscount(e.target.value)} placeholder="0" className="w-full" />
                    </div>
                  </div>

                  <div className="text-[13px] pt-3" style={{ borderTop: '1px solid var(--ink-10)' }}>
                    <div className="flex justify-between" style={{ color: 'var(--ink-60)' }}>
                      <span>Subtotal</span><span>{fmtTsh(subtotal)}</span>
                    </div>
                    {disc > 0 && (
                      <div className="flex justify-between" style={{ color: 'var(--amber)' }}>
                        <span>Discount</span><span>−{fmtTsh(disc)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-semibold mt-1" style={{ fontSize: 18, color: 'var(--ink)' }}>
                      <span>Total</span><span>{fmtTsh(total)}</span>
                    </div>
                  </div>

                  {anyOver && (
                    <div className="text-xs mt-2" style={{ color: 'var(--red)' }}>
                      A line is over what the branch holds. Reduce it, or ask a manager to correct the stock.
                    </div>
                  )}

                  <Btn variant="primary" className="w-full mt-4"
                    disabled={busy || anyOver || total < 0}
                    onClick={complete}>
                    {busy ? 'Recording…' : `Complete sale · ${fmtTsh(total)}`}
                  </Btn>
                </>
              )}
            </Card>
          </div>
        </div>
      )}

      {receipt && (
        <Receipt
          sale={receipt}
          onClose={() => setReceipt(null)}
          onVoid={voidSale}
          canVoid={!isAttendant || receipt.sold_on === today()}
        />
      )}
    </div>
  )
}
