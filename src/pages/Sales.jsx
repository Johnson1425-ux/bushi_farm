import { useState, useEffect, useCallback, useRef } from 'react'
import { Bar } from 'react-chartjs-2'
import { Chart, BarElement, CategoryScale, LinearScale, Tooltip } from 'chart.js'
import { apiFetch, BASE } from '../lib/api'
import { Card, CardTitle, Btn, PageHeader, EmptyState } from '../components/ui'

Chart.register(BarElement, CategoryScale, LinearScale, Tooltip)

/* ══════════════════════════════════════════════════════════════
   SALES

   Two things are sold and they are not the same trade, so they are kept
   apart rather than added together into a number that means neither:

     Branch sales   packs sold over a counter, from the till. Every figure
                    here is built from receipts, so it reconciles with
                    branch stock by construction.
     Bulk milk      raw milk sold by the litre, straight off the farm.
                    Recorded by hand, as it always was.

   Voided receipts are excluded everywhere: money that was never taken.
══════════════════════════════════════════════════════════════ */

const fmt    = n => Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })
const fmtTsh = n => `TSh ${fmt(n)}`
const num    = v => Number(v) || 0
const today  = () => new Date().toISOString().slice(0, 10)
const thisMonth = () => new Date().toISOString().slice(0, 7)
const monthStart = () => `${thisMonth()}-01`

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

function Field({ label, name, type = 'text', defaultValue, required, ...props }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label className="block text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--ink-60)', marginBottom: 6 }}>{label}</label>
      <input name={name} type={type} defaultValue={defaultValue ?? ''} required={required} className="w-full" {...props} />
    </div>
  )
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 text-sm font-medium border-0 bg-transparent cursor-pointer transition-all"
      style={{
        color: active ? 'var(--green-600)' : 'var(--ink-60)',
        borderBottom: active ? '2px solid var(--green-600)' : '2px solid transparent',
      }}
    >{children}</button>
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
function BranchSales({ from, to, branchId, branches, onBranch, onNotice }) {
  const [sales,   setSales]   = useState([])
  const [summary, setSummary] = useState(null)
  const [receipt, setReceipt] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const q = new URLSearchParams({ from, to })
      if (branchId) q.set('branch_id', branchId)
      const [s, sum] = await Promise.all([
        apiFetch(`/pos/sales?${q}`),
        apiFetch(`/pos/summary?${q}`),
      ])
      setSales(s); setSummary(sum)
    } catch (e) {
      onNotice(e.message)
    } finally { setLoading(false) }
  }, [from, to, branchId, onNotice])

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
      <div className="flex flex-wrap gap-3 items-center rounded-lg mb-4 p-4" style={{ background: 'var(--cream-dark)' }}>
        <span className="text-xs uppercase tracking-wider font-medium" style={{ color: 'var(--ink-60)' }}>Branch</span>
        <select value={branchId || ''} onChange={e => onBranch(e.target.value)}>
          <option value="">All branches</option>
          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

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
                <TH>Paid</TH><TH right>Items</TH><TH right>Total</TH><TH></TH>
              </tr>
            </thead>
            <tbody>
              {sales.length === 0 && (
                <tr><td colSpan={8}><EmptyState>No branch sales in this period.</EmptyState></td></tr>
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

/* ── bulk raw milk, recorded by hand ── */
function BulkMilk({ onNotice }) {
  const [records,      setRecords]      = useState([])
  const [summary,      setSummary]      = useState([])
  const [showModal,    setShowModal]    = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [importLoading,setImportLoading]= useState(false)
  const [filterMonth,  setFilterMonth]  = useState(thisMonth())
  const [filterFrom,   setFilterFrom]   = useState('')
  const [filterTo,     setFilterTo]     = useState('')
  const [useMonth,     setUseMonth]     = useState(true)
  const fileRef = useRef()

  const fetchRecords = useCallback(async () => {
    const params = new URLSearchParams()
    if (useMonth && filterMonth) params.set('month', filterMonth)
    else { if (filterFrom) params.set('from', filterFrom); if (filterTo) params.set('to', filterTo) }
    setRecords(await apiFetch(`/sales?${params}`))
  }, [useMonth, filterMonth, filterFrom, filterTo])

  const fetchSummary = useCallback(async () => setSummary(await apiFetch('/sales/summary')), [])

  useEffect(() => { fetchRecords().catch(e => onNotice(e.message)) }, [fetchRecords, onNotice])
  useEffect(() => { fetchSummary().catch(() => {}) }, [fetchSummary])

  const totalLitres  = records.reduce((s, r) => s + num(r.litres_sold), 0)
  const totalRevenue = records.reduce((s, r) => s + num(r.total), 0)

  const handleSave = async (e) => {
    e.preventDefault()
    const fd = new FormData(e.target)
    try {
      await apiFetch('/sales', {
        method: 'POST',
        body: JSON.stringify({
          date:            fd.get('date'),
          litres_sold:     fd.get('litres_sold'),
          price_per_litre: fd.get('price_per_litre'),
          notes:           fd.get('notes'),
        }),
      })
      await Promise.all([fetchRecords(), fetchSummary()])
      setShowModal(false)
    } catch (err) { onNotice(err.message) }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this bulk milk record?')) return
    try {
      await apiFetch(`/sales/${id}`, { method: 'DELETE' })
      await Promise.all([fetchRecords(), fetchSummary()])
    } catch (err) { onNotice(err.message) }
  }

  const handleImport = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImportLoading(true); setImportResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const token = localStorage.getItem('mt_token')
      const res = await fetch(`${BASE}/sales/import`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Import failed')
      setImportResult(result)
      await Promise.all([fetchRecords(), fetchSummary()])
    } catch (err) {
      setImportResult({ error: err.message })
    } finally {
      setImportLoading(false); e.target.value = ''
    }
  }

  const chartData = {
    labels: [...summary].reverse().map(s => s.month),
    datasets: [{ data: [...summary].reverse().map(s => num(s.total_revenue)), backgroundColor: '#3478c8', borderRadius: 6 }],
  }
  const chartOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: v => fmtTsh(v.raw) } } },
    scales: {
      y: { ticks: { callback: v => `${(v/1000).toFixed(0)}k`, font: { size: 11 } }, grid: { color: 'var(--ink-10)' } },
      x: { grid: { display: false }, ticks: { font: { size: 11 } } },
    },
  }

  return (
    <div>
      <div className="flex justify-between items-center flex-wrap gap-3 mb-4">
        <p className="text-sm" style={{ color: 'var(--ink-60)' }}>
          Raw milk sold by the litre, straight off the farm — not through a branch till.
        </p>
        <div className="flex gap-2">
          <Btn size="sm" onClick={() => setShowModal(true)}>+ Record sale</Btn>
          <Btn size="sm" onClick={() => fileRef.current?.click()}>
            {importLoading ? 'Importing…' : '↑ Import Excel'}
          </Btn>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={handleImport} />
        </div>
      </div>

      {importResult && (
        <div className="rounded-lg text-sm mb-5"
          style={{
            padding: '10px 16px',
            background: importResult.error ? 'rgba(217,64,64,0.1)' : 'var(--green-50)',
            border: `1px solid ${importResult.error ? 'var(--red)' : 'var(--green-100)'}`,
            color: importResult.error ? 'var(--red)' : 'var(--green-800)',
          }}>
          {importResult.error ? `✗ ${importResult.error}` : `✓ Imported ${importResult.imported} record(s).`}
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-center rounded-lg mb-4 p-4" style={{ background: 'var(--cream-dark)' }}>
        <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--ink-60)' }}>
          <input type="radio" checked={useMonth} onChange={() => setUseMonth(true)} /> By month
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--ink-60)' }}>
          <input type="radio" checked={!useMonth} onChange={() => setUseMonth(false)} /> Date range
        </label>
        {useMonth
          ? <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} />
          : <>
              <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
              <input type="date" value={filterTo}   onChange={e => setFilterTo(e.target.value)} />
            </>}
      </div>

      <Card noPad>
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr><TH>Date</TH><TH right>Litres</TH><TH right>Price / L</TH><TH right>Total</TH><TH>Notes</TH><TH></TH></tr>
            </thead>
            <tbody>
              {records.length === 0 && (
                <tr><td colSpan={6}><EmptyState>No bulk milk records for this period.</EmptyState></td></tr>
              )}
              {records.map(r => (
                <tr key={r.id}>
                  <TD mono>{r.date}</TD>
                  <TD right style={{ color: 'var(--blue)', fontWeight: 500 }}>{fmt(r.litres_sold)} L</TD>
                  <TD mono right>{fmtTsh(r.price_per_litre)}</TD>
                  <TD right style={{ color: 'var(--green-600)', fontWeight: 600 }}>{fmtTsh(r.total)}</TD>
                  <TD style={{ color: 'var(--ink-30)', fontSize: 12 }}>{r.notes || '—'}</TD>
                  <td className="px-5 py-3 border-b text-right" style={{ borderColor: 'var(--ink-10)' }}>
                    <Btn size="sm" variant="danger" onClick={() => handleDelete(r.id)}>Delete</Btn>
                  </td>
                </tr>
              ))}
            </tbody>
            {records.length > 0 && (
              <tfoot>
                <tr style={{ background: 'var(--cream-dark)' }}>
                  <td className="px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-60)' }}>Total</td>
                  <td className="px-5 py-3 font-semibold text-right" style={{ color: 'var(--blue)' }}>{fmt(totalLitres)} L</td>
                  <td />
                  <td className="px-5 py-3 font-semibold text-right" style={{ color: 'var(--green-600)' }}>{fmtTsh(totalRevenue)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      {summary.length > 0 && (
        <Card>
          <CardTitle>Bulk milk revenue by month (TSh)</CardTitle>
          <div style={{ height: 220, position: 'relative' }}>
            <Bar data={chartData} options={chartOpts} />
          </div>
        </Card>
      )}

      {showModal && (
        <Modal title="Record bulk milk sale" onClose={() => setShowModal(false)}>
          <form onSubmit={handleSave}>
            <Field label="Date" name="date" type="date" defaultValue={today()} required />
            <Field label="Litres sold" name="litres_sold" type="number" min="0.01" step="any" required />
            <Field label="Price per litre (TSh)" name="price_per_litre" type="number" min="0.01" step="any" required />
            <Field label="Notes" name="notes" />
            <div className="flex gap-2 justify-end mt-2">
              <Btn size="sm" onClick={() => setShowModal(false)}>Cancel</Btn>
              <button type="submit"
                className="inline-flex items-center justify-center font-medium rounded-lg border px-4 py-2 text-sm cursor-pointer bg-green-600 border-green-600 text-white hover:bg-green-800">
                Save
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default function Sales() {
  const [tab,      setTab]      = useState('branch')
  const [branches, setBranches] = useState([])
  const [branchId, setBranchId] = useState('')
  const [from,     setFrom]     = useState(monthStart())
  const [to,       setTo]       = useState(today())
  const [error,    setError]    = useState(null)

  useEffect(() => { apiFetch('/branches').then(setBranches).catch(() => {}) }, [])

  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(null), 6000)
    return () => clearTimeout(t)
  }, [error])

  return (
    <div style={{ animation: 'fadeUp .2s ease' }}>
      <PageHeader title="Sales" sub="Branch takings and bulk milk">
        {tab === 'branch' && (
          <div className="flex gap-2 items-center">
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
            <span className="text-xs" style={{ color: 'var(--ink-30)' }}>to</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} />
          </div>
        )}
      </PageHeader>

      {error && (
        <div className="rounded-lg border mb-4 text-[13px]"
          style={{ padding: '10px 16px', background: 'rgba(217,64,64,0.08)', borderColor: 'var(--red)', color: 'var(--red)' }}>
          {error}
        </div>
      )}

      <div className="flex mb-5" style={{ borderBottom: '1px solid var(--ink-10)' }}>
        <TabBtn active={tab === 'branch'} onClick={() => setTab('branch')}>🏪 Branch Sales</TabBtn>
        <TabBtn active={tab === 'bulk'}   onClick={() => setTab('bulk')}>🥛 Bulk Milk</TabBtn>
      </div>

      {tab === 'branch' && (
        <BranchSales
          from={from} to={to}
          branchId={branchId} branches={branches} onBranch={setBranchId}
          onNotice={setError}
        />
      )}
      {tab === 'bulk' && <BulkMilk onNotice={setError} />}
    </div>
  )
}
