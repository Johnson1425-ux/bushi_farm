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

   Stock and price come from one call, and the basket is checked against
   that stock as it is built — a line that would oversell is marked
   before the sale is attempted, not after the server rejects it.

   What the attendant is trusted with is deliberately narrow: sell, and
   void today's mistakes. Prices, stock corrections and anything from an
   earlier day belong to a manager.
══════════════════════════════════════════════════════════════ */

const fmt    = (n, dec = 0) => Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: dec })
const fmtTsh = (n) => `TSh ${fmt(n, 2)}`
const num    = (v) => Number(v) || 0
const today  = () => new Date().toISOString().slice(0, 10)

const PAYMENT_METHODS = [
  ['cash',   'Cash'],
  ['mobile', 'Mobile'],
  ['card',   'Card'],
  ['credit', 'Credit'],
]

/* Printing goes through a dedicated root rather than the whole page: the
   app's layout has a sidebar and cards that mean nothing on paper. */
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

        <div className="text-center text-[11px] mt-4" style={{ color: 'var(--ink-30)' }}>
          Thank you
        </div>

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

export default function Till() {
  const { user } = useAuth()
  const isAttendant = user?.role === 'attendant'

  const [branchId,   setBranchId]   = useState(user?.branch_id ?? null)
  const [branches,   setBranches]   = useState([])
  const [catalogue,  setCatalogue]  = useState([])
  const [recent,     setRecent]     = useState([])
  const [day,        setDay]        = useState(null)
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

  const add = (p) => setCart(c => ({ ...c, [p.product_id]: (c[p.product_id] || 0) + 1 }))
  const setQty = (id, units) => setCart(c => {
    const next = { ...c }
    if (units <= 0) delete next[id]
    else next[id] = units
    return next
  })

  const lines = useMemo(() => Object.entries(cart).map(([id, units]) => {
    const p = catalogue.find(c => String(c.product_id) === String(id))
    /* `units` is the basket quantity; the catalogue row's own units are the
       branch's stock, kept as `available` so the over-stock warning can say
       what is actually on the shelf. */
    return p ? { ...p, available: p.units, units, lineTotal: units * num(p.unit_price), over: units > p.units } : null
  }).filter(Boolean), [cart, catalogue])

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
          customer_name: customer || null,
          discount: disc,
          items: lines.map(l => ({ product_id: l.product_id, units: l.units })),
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
      <PageHeader title={`Till — ${branchName}`} sub="Sell from branch stock">
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
            { label: 'Voided',          value: fmt(day.voided),     color: num(day.voided) ? 'var(--red)' : 'var(--ink-30)' },
          ].map(k => (
            <div key={k.label} className="rounded-lg border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--ink-10)' }}>
              <div className="text-[11px] uppercase tracking-wider font-medium mb-1" style={{ color: 'var(--ink-60)' }}>{k.label}</div>
              <div className="font-semibold" style={{ fontSize: 19, color: k.color, lineHeight: 1.2 }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-5" style={{ gridTemplateColumns: 'minmax(0, 1.5fr) minmax(280px, 1fr)' }}>
        {/* ── products ── */}
        <div style={{ minWidth: 0 }}>
          <Card>
            <CardTitle>Tap to add</CardTitle>
            {catalogue.length === 0 ? (
              <EmptyState>Nothing in stock at this branch yet.</EmptyState>
            ) : (
              <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
                {catalogue.map(p => {
                  const inCart = cart[p.product_id] || 0
                  const out    = p.units <= 0
                  const noPrice = num(p.unit_price) <= 0
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
                        {noPrice ? 'No price set' : fmtTsh(p.unit_price)}
                      </div>
                      <div className="text-[11px] mt-0.5" style={{ color: out ? 'var(--red)' : 'var(--ink-30)' }}>
                        {out ? 'Out of stock' : `${fmt(p.units)} in stock`}
                        {inCart > 0 && ` · ${inCart} in basket`}
                      </div>
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
                    {['Receipt', 'Time', 'Items', 'Total', 'Paid', ''].map(h => (
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
                      <td className="px-5 py-3 border-b" style={{ borderColor: 'var(--ink-10)', color: 'var(--ink-60)' }}>{r.lines}</td>
                      <td className="px-5 py-3 border-b font-semibold" style={{ borderColor: 'var(--ink-10)', color: 'var(--ink)' }}>
                        {fmtTsh(r.total)}
                      </td>
                      <td className="px-5 py-3 border-b capitalize text-[12px]" style={{ borderColor: 'var(--ink-10)', color: 'var(--ink-60)' }}>{r.payment_method}</td>
                      <td className="px-5 py-3 border-b" style={{ borderColor: 'var(--ink-10)' }} />
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
                        <div className="text-[11px]" style={{ color: l.over ? 'var(--red)' : 'var(--ink-60)' }}>
                          {fmtTsh(l.unit_price)} each{l.over && ` · only ${fmt(l.available)} on the shelf`}
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
                    <div className="flex gap-1.5 flex-wrap">
                      {PAYMENT_METHODS.map(([value, label]) => (
                        <button key={value} onClick={() => setPayment(value)}
                          className="text-xs px-3 py-1.5 rounded-lg border cursor-pointer"
                          style={{
                            background: payment === value ? 'var(--green-600)' : 'transparent',
                            color: payment === value ? '#fff' : 'var(--ink-60)',
                            borderColor: payment === value ? 'var(--green-600)' : 'var(--ink-10)',
                          }}>{label}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--ink-60)' }}>Customer (optional)</label>
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
