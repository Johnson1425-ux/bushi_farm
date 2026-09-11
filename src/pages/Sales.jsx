import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../lib/api'
import { Card, CardTitle, Btn, PageHeader, EmptyState } from '../components/ui'

/* ══════════════════════════════════════════════════════════════
   SALES

   Everything the farm sells goes over a branch counter, so every figure
   here is built from receipts and reconciles with branch stock by
   construction.

   There was a second tab, for raw milk sold by the litre and kept by
   hand. Milk sold loose is now an ordinary product measured in litres,
   so it rings up at the same till with a customer and a payment method
   against it — and a second place to record a sale would only have split
   the farm's revenue across two figures that never met. The old rows are
   still in the database and still reach the AI reports; nothing writes
   to them any more.

   Voided receipts are excluded everywhere: money that was never taken.
══════════════════════════════════════════════════════════════ */

const fmt    = n => Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })
const fmtTsh = n => `TSh ${fmt(n)}`
const num    = v => Number(v) || 0
const today  = () => new Date().toISOString().slice(0, 10)
const monthStart = () => `${today().slice(0, 7)}-01`

function Modal({ title, onClose, children }) {
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(10,30,20,0.45)' }}
    >
      <div className="rounded-[16px] w-full max-w-md p-7 max-h-[90vh] overflow-y-auto" style={{ background: 'var(--surface)' }}>
        <div className="flex items-center justify-between mb-5">
          <div className="font-serif text-[18px]" style={{ color: 'var(--ink)' }}>{title}</div>
          <button onClick={onClose} className="border-0 bg-transparent text-[18px] cursor-pointer p-1 leading-none hover:opacity-60" style={{ color: 'var(--ink-30)' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

const TH = ({ children, right }) => (
  <th className={`px-5 py-3 text-[11px] font-semibold tracking-wider uppercase border-b ${right ? 'text-right' : 'text-left'}`}
    style={{ color: 'var(--ink-60)', borderColor: 'var(--ink-10)' }}>{children}</th>
)
const TD = ({ children, mono, right, style = {} }) => (
  <td className={`px-5 py-3 border-b text-[13px] ${right ? 'text-right' : ''}`}
    style={{
      borderColor: 'var(--ink-10)', color: mono ? 'var(--ink-60)' : 'var(--ink)',
      fontFamily: mono ? "'DM Mono', monospace" : 'inherit', fontSize: mono ? 12 : 13, ...style,
    }}>{children}</td>
)

/* ── branch sales, from the till ── */
function BranchSales({ from, to, branchId, branches, onBranch, products, onNotice }) {
  const [sales,   setSales]   = useState([])
  const [summary, setSummary] = useState(null)
  const [receipt, setReceipt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [payment, setPayment] = useState('')
  const [tier,    setTier]    = useState('')
  const [product, setProduct] = useState('')

  /* Every filter goes to the server rather than being applied to the rows
     already fetched: the summary has to narrow with the list, and a total
     computed over a page of results would not be the period's total. */
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const q = new URLSearchParams({ from, to })
      if (branchId) q.set('branch_id', branchId)
      if (payment)  q.set('payment_method', payment)
      if (tier)     q.set('price_tier', tier)
      if (product)  q.set('product_id', product)
      const [s, sum] = await Promise.all([
        apiFetch(`/pos/sales?${q}`),
        apiFetch(`/pos/summary?${q}`),
      ])
      setSales(s); setSummary(sum)
    } catch (e) {
      onNotice(e.message)
    } finally { setLoading(false) }
  }, [from, to, branchId, payment, tier, product, onNotice])

  useEffect(() => { load() }, [load])

  const voidSale = async (s) => {
    const reason = prompt(`Void ${s.receipt_no}? Give a reason — it goes on the record.`)
    if (!reason || !reason.trim()) return
    try {
      await apiFetch(`/pos/sales/${s.id}/void`, { method: 'POST', body: JSON.stringify({ reason: reason.trim() }) })
      setReceipt(null)
      await load()
    } catch (e) { onNotice(e.message) }
  }

  if (loading) return <div className="p-8 text-center text-sm" style={{ color: 'var(--ink-30)' }}>Loading…</div>

  const t = summary?.totals

  return (
    <div>
      <div className="flex flex-wrap gap-3 items-end rounded-lg mb-4 p-4" style={{ background: 'var(--cream-dark)' }}>
        {[
          ['Branch', branchId || '', onBranch,
            [['', 'All branches'], ...branches.map(b => [String(b.id), b.name])]],
          ['Payment', payment, setPayment,
            [['', 'Any payment'], ['cash', 'Cash'], ['mobile', 'Mobile'], ['card', 'Card'], ['credit', 'Credit']]],
          ['Price list', tier, setTier,
            [['', 'Both lists'], ['retail', 'Retail'], ['wholesale', 'Wholesale']]],
          ['Product', product, setProduct,
            [['', 'All products'], ...products.map(p => [String(p.id), `${p.product} ${p.size}`])]],
        ].map(([label, value, onChange, options]) => (
          <div key={label}>
            <label className="block text-[11px] uppercase tracking-wider font-medium mb-1" style={{ color: 'var(--ink-60)' }}>{label}</label>
            <select value={value} onChange={e => onChange(e.target.value)}>
              {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        ))}
        {(branchId || payment || tier || product) && (
          <Btn size="sm" onClick={() => { onBranch(''); setPayment(''); setTier(''); setProduct('') }}>Clear</Btn>
        )}
      </div>

      {product && (
        <div className="text-xs mb-3" style={{ color: 'var(--ink-60)' }}>
          Filtering by product keeps whole receipts, so a receipt's total may include other items.
          The <strong>By product</strong> table below is the figure for that product alone.
        </div>
      )}

      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        {[
          { label: 'Revenue',      value: fmtTsh(t?.revenue),     color: 'var(--green-600)' },
          { label: 'Receipts',     value: fmt(t?.receipts),       color: 'var(--ink)' },
          { label: 'Avg Receipt',  value: fmtTsh(t?.avg_receipt), color: 'var(--blue)' },
          { label: 'Litres Sold',  value: `${fmt(t?.litres)} L`,  color: 'var(--blue)' },
          { label: 'Discounts',    value: fmtTsh(t?.discount),    color: num(t?.discount) ? 'var(--amber)' : 'var(--ink-30)' },
        ].map(k => (
          <div key={k.label} className="rounded-lg border" style={{ background: 'var(--surface)', borderColor: 'var(--ink-10)', padding: '16px 20px' }}>
            <div className="text-[11px] uppercase tracking-wider font-medium mb-1" style={{ color: 'var(--ink-60)' }}>{k.label}</div>
            <div className="text-[20px] font-semibold" style={{ color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {summary?.by_branch?.length > 1 && (
        <Card noPad>
          <div className="px-5 pt-4 pb-1"><CardTitle>By branch</CardTitle></div>
          <table className="w-full border-collapse text-[13px]">
            <thead><tr><TH>Branch</TH><TH right>Receipts</TH><TH right>Revenue</TH></tr></thead>
            <tbody>
              {summary.by_branch.map(b => (
                <tr key={b.branch_id}>
                  <TD>{b.branch_name}</TD>
                  <TD mono right>{fmt(b.receipts)}</TD>
                  <TD right style={{ color: 'var(--green-600)', fontWeight: 600 }}>{fmtTsh(b.revenue)}</TD>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {summary?.by_payment?.length > 0 && (
        <Card noPad>
          <div className="px-5 pt-4 pb-1"><CardTitle>How it was paid, and on which list</CardTitle></div>
          <table className="w-full border-collapse text-[13px]">
            <thead><tr><TH>Payment</TH><TH>Price list</TH><TH right>Receipts</TH><TH right>Revenue</TH></tr></thead>
            <tbody>
              {summary.by_payment.map((p, i) => (
                <tr key={i}>
                  <TD style={{ textTransform: 'capitalize' }}>{p.payment_method}</TD>
                  <TD style={{ textTransform: 'capitalize', color: p.price_tier === 'wholesale' ? 'var(--blue)' : 'var(--ink-60)' }}>
                    {p.price_tier}
                  </TD>
                  <TD mono right>{fmt(p.receipts)}</TD>
                  <TD right style={{ color: 'var(--green-600)', fontWeight: 600 }}>{fmtTsh(p.revenue)}</TD>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {summary?.by_product?.length > 0 && (
        <Card noPad>
          <div className="px-5 pt-4 pb-1">
            <CardTitle>By product</CardTitle>
            <p className="text-xs mb-2" style={{ color: 'var(--ink-60)' }}>
              Line totals, before any receipt-level discount — which is why these add up to
              slightly more than the revenue above when discounts were given.
            </p>
          </div>
          <table className="w-full border-collapse text-[13px]">
            <thead><tr><TH>Product</TH><TH>Size</TH><TH right>Units</TH><TH right>Litres</TH><TH right>Revenue</TH></tr></thead>
            <tbody>
              {summary.by_product.map((p, i) => (
                <tr key={i}>
                  <TD>{p.product}</TD>
                  <TD mono>{p.size}</TD>
                  <TD mono right>{fmt(p.units)}</TD>
                  <TD mono right>{fmt(p.litres)}</TD>
                  <TD right style={{ color: 'var(--green-600)', fontWeight: 600 }}>{fmtTsh(p.revenue)}</TD>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Card noPad>
        <div className="px-5 pt-4 pb-1"><CardTitle>Receipts</CardTitle></div>
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <TH>Receipt</TH><TH>Date</TH><TH>Branch</TH><TH>Cashier</TH>
                <TH>Paid</TH><TH>List</TH><TH right>Items</TH><TH right>Total</TH><TH></TH>
              </tr>
            </thead>
            <tbody>
              {sales.length === 0 && (
                <tr><td colSpan={9}><EmptyState>No branch sales in this period.</EmptyState></td></tr>
              )}
              {sales.map(s => (
                <tr key={s.id} style={{ opacity: s.status === 'voided' ? 0.5 : 1 }}>
                  <td className="px-5 py-3 border-b" style={{ borderColor: 'var(--ink-10)' }}>
                    <button onClick={() => apiFetch(`/pos/sales/${s.id}`).then(setReceipt).catch(e => onNotice(e.message))}
                      className="border-0 bg-transparent cursor-pointer font-semibold text-[13px]"
                      style={{ color: 'var(--green-600)', fontFamily: "'DM Mono', monospace" }}>
                      {s.receipt_no}
                    </button>
                    {s.status === 'voided' && (
                      <span className="ml-2 text-[10px] uppercase tracking-wider font-bold" style={{ color: 'var(--red)' }}>void</span>
                    )}
                  </td>
                  <TD mono>{s.sold_on}</TD>
                  <TD>{s.branch_name}</TD>
                  <TD>{s.cashier || '—'}</TD>
                  <TD style={{ textTransform: 'capitalize' }}>{s.payment_method}</TD>
                  <TD style={{ textTransform: 'capitalize', color: s.price_tier === 'wholesale' ? 'var(--blue)' : 'var(--ink-60)' }}>
                    {s.price_tier}
                  </TD>
                  <TD mono right>{s.lines}</TD>
                  <TD right style={{ fontWeight: 600 }}>{fmtTsh(s.total)}</TD>
                  <td className="px-5 py-3 border-b text-right" style={{ borderColor: 'var(--ink-10)' }}>
                    {s.status !== 'voided' && (
                      <Btn size="sm" variant="danger" onClick={() => voidSale(s)}>Void</Btn>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {receipt && (
        <Modal title={receipt.receipt_no} onClose={() => setReceipt(null)}>
          <div className="text-xs mb-3" style={{ color: 'var(--ink-60)' }}>
            {receipt.branch_name} · {receipt.sold_on} · {receipt.cashier || '—'}
            {receipt.customer_name && ` · ${receipt.customer_name}`}
          </div>
          <table className="w-full text-[13px] mb-3">
            <tbody>
              {receipt.items.map(i => (
                <tr key={i.id}>
                  <td className="py-1">{i.product} {i.size}
                    <div className="text-[11px]" style={{ color: 'var(--ink-60)' }}>
                      {fmt(i.units)} × {fmtTsh(i.unit_price)}
                      {i.price_tier === 'wholesale' && ' · wholesale'}
                    </div>
                  </td>
                  <td className="py-1 text-right align-top" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtTsh(i.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-[13px] pt-3" style={{ borderTop: '1px solid var(--ink-10)' }}>
            <div className="flex justify-between" style={{ color: 'var(--ink-60)' }}><span>Subtotal</span><span>{fmtTsh(receipt.subtotal)}</span></div>
            {num(receipt.discount) > 0 && (
              <div className="flex justify-between" style={{ color: 'var(--amber)' }}><span>Discount</span><span>−{fmtTsh(receipt.discount)}</span></div>
            )}
            <div className="flex justify-between font-semibold mt-1" style={{ fontSize: 16 }}><span>Total</span><span>{fmtTsh(receipt.total)}</span></div>
          </div>
          {receipt.status === 'voided' && (
            <div className="mt-3 text-center text-[13px] font-semibold py-2 rounded"
              style={{ background: 'rgba(217,64,64,0.1)', color: 'var(--red)' }}>
              VOIDED — {receipt.void_reason}
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}

export default function Sales() {
  const [branches, setBranches] = useState([])
  const [products, setProducts] = useState([])
  const [branchId, setBranchId] = useState('')
  const [from,     setFrom]     = useState(monthStart())
  const [to,       setTo]       = useState(today())
  const [error,    setError]    = useState(null)

  useEffect(() => { apiFetch('/branches').then(setBranches).catch(() => {}) }, [])
  useEffect(() => { apiFetch('/products').then(setProducts).catch(() => {}) }, [])

  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(null), 6000)
    return () => clearTimeout(t)
  }, [error])

  return (
    <div style={{ animation: 'fadeUp .2s ease' }}>
      <PageHeader title="Sales" sub="What the branch tills rang up">
        <div className="flex gap-2 items-center">
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
          <span className="text-xs" style={{ color: 'var(--ink-30)' }}>to</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} />
        </div>
      </PageHeader>

      {error && (
        <div className="rounded-lg border mb-4 text-[13px]"
          style={{ padding: '10px 16px', background: 'rgba(217,64,64,0.08)', borderColor: 'var(--red)', color: 'var(--red)' }}>
          {error}
        </div>
      )}

      <BranchSales
        from={from} to={to}
        branchId={branchId} branches={branches} onBranch={setBranchId}
        products={products}
        onNotice={setError}
      />
    </div>
  )
}
