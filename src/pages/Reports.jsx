import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../lib/api'
import { Card, CardTitle, Btn, PageHeader, EmptyState } from '../components/ui'

/* ══════════════════════════════════════════════════════════════
   REPORTS

   Laid out to match the farm's own Sales Day Book, because that is the
   shape the people reading these already think in:

     Income by branch   a row per period, a column per branch — the
                        workbook's SALES BY UNITY. The one view that
                        answers which outlet is carrying the month.
     Cash book          a row per day: what was sold, what went out on
                        credit, what was paid from the drawer, and what
                        the drawer should therefore have held.
     Products           what sold, with counter trade and agent trade
                        side by side rather than added together.

   These are reconciliation reports, so they are tables. A chart would
   read faster and answer none of the questions actually being asked of
   them — every one of which is about an exact figure.
══════════════════════════════════════════════════════════════ */

const fmt    = (n, dec = 0) => Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: dec })
const fmtTsh = (n) => `TSh ${fmt(n)}`
const num    = (v) => Number(v) || 0
const today  = () => new Date().toISOString().slice(0, 10)
const monthStart = () => today().slice(0, 8) + '01'

/* A blank cell reads as "nothing happened here", which is what a zero
   means in a matrix this sparse — and it lets the eye find the figures. */
const cell = (v) => (num(v) ? fmt(v) : '')

const TH = ({ children, right, sticky }) => (
  <th className={`px-4 py-3 text-[11px] font-semibold tracking-wider uppercase border-b ${right ? 'text-right' : 'text-left'}`}
    style={{
      color: 'var(--ink-60)', borderColor: 'var(--ink-10)', whiteSpace: 'nowrap',
      ...(sticky ? { position: 'sticky', left: 0, background: 'var(--surface)', zIndex: 1 } : {}),
    }}>{children}</th>
)
const TD = ({ children, right, mono, sticky, style = {} }) => (
  <td className={`px-4 py-2.5 border-b text-[13px] ${right ? 'text-right' : ''}`}
    style={{
      borderColor: 'var(--ink-10)', color: 'var(--ink)', whiteSpace: 'nowrap',
      fontFamily: mono ? "'DM Mono', monospace" : 'inherit', fontSize: mono ? 12 : 13,
      ...(sticky ? { position: 'sticky', left: 0, background: 'var(--surface)' } : {}),
      ...style,
    }}>{children}</td>
)

/* Download what is on screen. These reports exist because the farm reads
   them in a spreadsheet, so handing one back is not an afterthought. */
function downloadCsv(filename, rows) {
  const esc = (v) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = rows.map(r => r.map(esc).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  URL.revokeObjectURL(url)
}

function TabBtn({ label, active, onClick }) {
  return (
    <button onClick={onClick} className="px-4 py-2 text-sm font-medium border-0 bg-transparent cursor-pointer"
      style={{
        color: active ? 'var(--green-600)' : 'var(--ink-60)',
        borderBottom: active ? '2px solid var(--green-600)' : '2px solid transparent',
      }}>{label}</button>
  )
}

/* ── income per branch, per period ── */
function ByBranch({ from, to }) {
  const [group, setGroup] = useState('day')
  const [data,  setData]  = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    setData(null); setError(null)
    apiFetch(`/reports/sales-by-branch?from=${from}&to=${to}&group=${group}`)
      .then(setData).catch(e => setError(e.message))
  }, [from, to, group])

  if (error) return <Card><EmptyState>{error}</EmptyState></Card>
  if (!data) return <div className="p-8 text-center text-sm" style={{ color: 'var(--ink-30)' }}>Loading…</div>
  if (!data.rows.length) return <Card><EmptyState>No sales in this period.</EmptyState></Card>

  const exportCsv = () => downloadCsv(`income-by-branch-${from}_${to}.csv`, [
    ['Period', ...data.branches.map(b => b.name), 'Total'],
    ...data.rows.map(r => [r.period, ...data.branches.map(b => r.cells[b.id]?.revenue ?? 0), r.total]),
    ['TOTAL', ...data.branches.map(b => data.branch_totals[b.id] ?? 0), data.grand_total],
  ])

  return (
    <div>
      <div className="flex flex-wrap gap-3 items-center justify-between rounded-lg mb-4 p-4" style={{ background: 'var(--cream-dark)' }}>
        <div className="flex gap-2 items-center">
          <span className="text-xs uppercase tracking-wider font-medium" style={{ color: 'var(--ink-60)' }}>Group by</span>
          {['day', 'week', 'month'].map(g => (
            <button key={g} onClick={() => setGroup(g)}
              className="text-xs px-3 py-1 rounded-full border cursor-pointer capitalize"
              style={{
                background: group === g ? 'var(--green-600)' : 'transparent',
                color: group === g ? '#fff' : 'var(--ink-60)',
                borderColor: group === g ? 'var(--green-600)' : 'var(--ink-10)',
              }}>{g}</button>
          ))}
        </div>
        <Btn size="sm" onClick={exportCsv}>↓ CSV</Btn>
      </div>

      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        <div className="rounded-lg border" style={{ background: 'var(--surface)', borderColor: 'var(--ink-10)', padding: '16px 20px' }}>
          <div className="text-[11px] uppercase tracking-wider font-medium mb-1" style={{ color: 'var(--ink-60)' }}>Total income</div>
          <div className="text-[20px] font-semibold" style={{ color: 'var(--green-600)' }}>{fmtTsh(data.grand_total)}</div>
        </div>
        {data.branches.map(b => (
          <div key={b.id} className="rounded-lg border" style={{ background: 'var(--surface)', borderColor: 'var(--ink-10)', padding: '16px 20px' }}>
            <div className="text-[11px] uppercase tracking-wider font-medium mb-1 truncate" style={{ color: 'var(--ink-60)' }}>{b.name}</div>
            <div className="text-[20px] font-semibold" style={{ color: 'var(--ink)' }}>{fmtTsh(data.branch_totals[b.id])}</div>
            <div className="text-[11px]" style={{ color: 'var(--ink-30)' }}>
              {data.grand_total > 0
                ? `${((data.branch_totals[b.id] / data.grand_total) * 100).toFixed(1)}% of the period`
                : '—'}
            </div>
          </div>
        ))}
      </div>

      <Card noPad>
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <TH sticky>{group === 'day' ? 'Date' : group === 'week' ? 'Week of' : 'Month'}</TH>
                {data.branches.map(b => <TH key={b.id} right>{b.name}</TH>)}
                <TH right>Total</TH>
              </tr>
            </thead>
            <tbody>
              {data.rows.map(r => (
                <tr key={r.period}>
                  <TD sticky mono>{r.period}</TD>
                  {data.branches.map(b => (
                    <TD key={b.id} right mono style={{ color: 'var(--ink-60)' }}>
                      {cell(r.cells[b.id]?.revenue)}
                    </TD>
                  ))}
                  <TD right style={{ fontWeight: 600, color: 'var(--green-600)' }}>{fmt(r.total)}</TD>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--cream-dark)' }}>
                <TD sticky style={{ fontWeight: 600, background: 'var(--cream-dark)' }}>TOTAL</TD>
                {data.branches.map(b => (
                  <TD key={b.id} right mono style={{ fontWeight: 600 }}>{cell(data.branch_totals[b.id])}</TD>
                ))}
                <TD right style={{ fontWeight: 700, color: 'var(--green-600)' }}>{fmt(data.grand_total)}</TD>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  )
}

/* ── the cash book ── */
function CashBook({ from, to, branches }) {
  const [branchId, setBranchId] = useState('')
  const [data,  setData]  = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    setData(null); setError(null)
    const q = new URLSearchParams({ from, to })
    if (branchId) q.set('branch_id', branchId)
    apiFetch(`/reports/cash-book?${q}`).then(setData).catch(e => setError(e.message))
  }, [from, to, branchId])

  if (error) return <Card><EmptyState>{error}</EmptyState></Card>
  if (!data) return <div className="p-8 text-center text-sm" style={{ color: 'var(--ink-30)' }}>Loading…</div>

  const COLS = [
    ['sales',           'Sales'],
    ['credit_sales',    'Credit'],
    ['expenses',        'Expenses'],
    ['debtor_receipts', 'Debtors'],
    ['prepaids',        'Prepaid'],
    ['expected_cash',   'Expected'],
    ['counted_cash',    'Counted'],
    ['mobile_counted',  'Mobile'],
    ['bank_deposit',    'Banked'],
  ]

  const exportCsv = () => downloadCsv(`cash-book-${from}_${to}.csv`, [
    ['Date', ...COLS.map(c => c[1]), 'Variance'],
    ...data.days.map(d => [d.day, ...COLS.map(c => d[c[0]]), d.variance ?? '']),
    ['TOTAL', ...COLS.map(c => data.totals[c[0]] ?? ''), data.totals.variance],
  ])

  return (
    <div>
      <div className="flex flex-wrap gap-3 items-center justify-between rounded-lg mb-4 p-4" style={{ background: 'var(--cream-dark)' }}>
        <div className="flex gap-2 items-center">
          <span className="text-xs uppercase tracking-wider font-medium" style={{ color: 'var(--ink-60)' }}>Branch</span>
          <select value={branchId} onChange={e => setBranchId(e.target.value)}>
            <option value="">All branches</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <Btn size="sm" onClick={exportCsv}>↓ CSV</Btn>
      </div>

      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        {[
          { label: 'Sales',           value: fmtTsh(data.totals.sales),         color: 'var(--ink)' },
          { label: 'Expected cash',   value: fmtTsh(data.totals.expected_cash), color: 'var(--ink)' },
          { label: 'Counted',         value: fmtTsh(data.totals.counted_cash),  color: 'var(--green-600)' },
          {
            label: 'Variance',
            value: data.totals.variance === 0 ? 'Balanced' : fmtTsh(data.totals.variance),
            color: data.totals.variance === 0 ? 'var(--green-600)' : 'var(--red)',
          },
          {
            label: 'Days not counted',
            value: fmt(data.totals.days_uncounted),
            color: data.totals.days_uncounted ? 'var(--amber)' : 'var(--ink-30)',
          },
        ].map(k => (
          <div key={k.label} className="rounded-lg border" style={{ background: 'var(--surface)', borderColor: 'var(--ink-10)', padding: '16px 20px' }}>
            <div className="text-[11px] uppercase tracking-wider font-medium mb-1" style={{ color: 'var(--ink-60)' }}>{k.label}</div>
            <div className="text-[20px] font-semibold" style={{ color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {data.totals.days_uncounted > 0 && (
        <div className="rounded-lg border mb-4 text-[13px]"
          style={{ padding: '10px 16px', background: 'rgba(232,160,32,0.1)', borderColor: 'var(--amber)', color: 'var(--amber)' }}>
          {data.totals.days_uncounted} trading day{data.totals.days_uncounted > 1 ? 's have' : ' has'} no
          cash-up, so {data.totals.days_uncounted > 1 ? 'they contribute' : 'it contributes'} nothing to the
          variance. The total below is only over the days that were actually counted.
        </div>
      )}

      <Card noPad>
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <TH sticky>Date</TH>
                {COLS.map(([, label]) => <TH key={label} right>{label}</TH>)}
                <TH right>Variance</TH>
              </tr>
            </thead>
            <tbody>
              {data.days.length === 0 && (
                <tr><td colSpan={COLS.length + 2}><EmptyState>Nothing traded in this period.</EmptyState></td></tr>
              )}
              {data.days.map(d => (
                <tr key={d.day}>
                  <TD sticky mono>
                    {d.day}
                    {d.cash_ups > 0 && !d.closed && (
                      <span className="ml-1.5 text-[10px] uppercase" style={{ color: 'var(--amber)' }}>open</span>
                    )}
                  </TD>
                  {COLS.map(([key]) => (
                    <TD key={key} right mono
                      style={{ color: key === 'credit_sales' || key === 'expenses' ? 'var(--amber)' : 'var(--ink-60)' }}>
                      {cell(d[key])}
                    </TD>
                  ))}
                  <TD right mono style={{
                    color: d.variance === null ? 'var(--ink-30)'
                         : d.variance === 0 ? 'var(--green-600)' : 'var(--red)',
                    fontWeight: d.variance ? 600 : 400,
                  }}>
                    {d.variance === null ? 'not counted' : d.variance === 0 ? '✓' : fmt(d.variance)}
                  </TD>
                </tr>
              ))}
            </tbody>
            {data.days.length > 0 && (
              <tfoot>
                <tr style={{ background: 'var(--cream-dark)' }}>
                  <TD sticky style={{ fontWeight: 600, background: 'var(--cream-dark)' }}>TOTAL</TD>
                  {COLS.map(([key]) => (
                    <TD key={key} right mono style={{ fontWeight: 600 }}>{cell(data.totals[key])}</TD>
                  ))}
                  <TD right mono style={{
                    fontWeight: 700,
                    color: data.totals.variance === 0 ? 'var(--green-600)' : 'var(--red)',
                  }}>
                    {data.totals.variance === 0 ? '✓' : fmt(data.totals.variance)}
                  </TD>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>
    </div>
  )
}

/* ── what sold, on which list ── */
function Products({ from, to, branches }) {
  const [branchId, setBranchId] = useState('')
  const [data,  setData]  = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    setData(null); setError(null)
    const q = new URLSearchParams({ from, to })
    if (branchId) q.set('branch_id', branchId)
    apiFetch(`/reports/products?${q}`).then(setData).catch(e => setError(e.message))
  }, [from, to, branchId])

  if (error) return <Card><EmptyState>{error}</EmptyState></Card>
  if (!data) return <div className="p-8 text-center text-sm" style={{ color: 'var(--ink-30)' }}>Loading…</div>

  const exportCsv = () => downloadCsv(`products-${from}_${to}.csv`, [
    ['Product', 'Size', 'Retail units', 'Retail revenue', 'Wholesale units', 'Wholesale revenue', 'Total units', 'Litres', 'Total revenue'],
    ...data.products.map(p => [p.product, p.size, p.retail_units, p.retail_revenue,
      p.wholesale_units, p.wholesale_revenue, p.units, p.litres, p.revenue]),
    ['TOTAL', '', data.totals.retail_units, data.totals.retail_revenue,
      data.totals.wholesale_units, data.totals.wholesale_revenue,
      data.totals.units, data.totals.litres, data.totals.revenue],
  ])

  return (
    <div>
      <div className="flex flex-wrap gap-3 items-center justify-between rounded-lg mb-4 p-4" style={{ background: 'var(--cream-dark)' }}>
        <div className="flex gap-2 items-center">
          <span className="text-xs uppercase tracking-wider font-medium" style={{ color: 'var(--ink-60)' }}>Branch</span>
          <select value={branchId} onChange={e => setBranchId(e.target.value)}>
            <option value="">All branches</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <Btn size="sm" onClick={exportCsv}>↓ CSV</Btn>
      </div>

      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        {[
          { label: 'Total revenue',     value: fmtTsh(data.totals.revenue),           color: 'var(--green-600)' },
          { label: 'Over the counter',  value: fmtTsh(data.totals.retail_revenue),    color: 'var(--ink)' },
          { label: 'To agents',         value: fmtTsh(data.totals.wholesale_revenue), color: 'var(--blue)' },
          { label: 'Units sold',        value: fmt(data.totals.units),                color: 'var(--ink)' },
          { label: 'Litres sold',       value: `${fmt(data.totals.litres, 1)} L`,     color: 'var(--blue)' },
        ].map(k => (
          <div key={k.label} className="rounded-lg border" style={{ background: 'var(--surface)', borderColor: 'var(--ink-10)', padding: '16px 20px' }}>
            <div className="text-[11px] uppercase tracking-wider font-medium mb-1" style={{ color: 'var(--ink-60)' }}>{k.label}</div>
            <div className="text-[20px] font-semibold" style={{ color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      <Card noPad>
        <div className="px-5 pt-4 pb-1">
          <CardTitle>Retail and wholesale, side by side</CardTitle>
          <p className="text-xs mb-2" style={{ color: 'var(--ink-60)' }}>
            The same pack sold at two prices is two different trades. Added together they would
            hide which one the period actually was.
          </p>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <TH sticky>Product</TH><TH>Size</TH>
                <TH right>Retail units</TH><TH right>Retail</TH>
                <TH right>Whlsl units</TH><TH right>Wholesale</TH>
                <TH right>Litres</TH><TH right>Revenue</TH>
              </tr>
            </thead>
            <tbody>
              {data.products.length === 0 && (
                <tr><td colSpan={8}><EmptyState>Nothing sold in this period.</EmptyState></td></tr>
              )}
              {data.products.map(p => (
                <tr key={p.product_id}>
                  <TD sticky>{p.product}</TD>
                  <TD mono>{p.size}</TD>
                  <TD right mono style={{ color: 'var(--ink-60)' }}>{cell(p.retail_units)}</TD>
                  <TD right mono style={{ color: 'var(--ink-60)' }}>{cell(p.retail_revenue)}</TD>
                  <TD right mono style={{ color: 'var(--blue)' }}>{cell(p.wholesale_units)}</TD>
                  <TD right mono style={{ color: 'var(--blue)' }}>{cell(p.wholesale_revenue)}</TD>
                  <TD right mono style={{ color: 'var(--ink-60)' }}>{cell(p.litres)}</TD>
                  <TD right style={{ fontWeight: 600, color: 'var(--green-600)' }}>{fmt(p.revenue)}</TD>
                </tr>
              ))}
            </tbody>
            {data.products.length > 0 && (
              <tfoot>
                <tr style={{ background: 'var(--cream-dark)' }}>
                  <TD sticky style={{ fontWeight: 600, background: 'var(--cream-dark)' }}>TOTAL</TD>
                  <TD />
                  <TD right mono style={{ fontWeight: 600 }}>{cell(data.totals.retail_units)}</TD>
                  <TD right mono style={{ fontWeight: 600 }}>{cell(data.totals.retail_revenue)}</TD>
                  <TD right mono style={{ fontWeight: 600, color: 'var(--blue)' }}>{cell(data.totals.wholesale_units)}</TD>
                  <TD right mono style={{ fontWeight: 600, color: 'var(--blue)' }}>{cell(data.totals.wholesale_revenue)}</TD>
                  <TD right mono style={{ fontWeight: 600 }}>{cell(data.totals.litres)}</TD>
                  <TD right style={{ fontWeight: 700, color: 'var(--green-600)' }}>{fmt(data.totals.revenue)}</TD>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>
    </div>
  )
}

/* ── quick period presets, because these are the periods people ask for ── */
const PRESETS = [
  ['This month',  () => [monthStart(), today()]],
  ['Last 7 days', () => {
    const d = new Date(); d.setUTCDate(d.getUTCDate() - 6)
    return [d.toISOString().slice(0, 10), today()]
  }],
  ['Last month',  () => {
    const now = new Date()
    const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
    const last  = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0))
    return [first.toISOString().slice(0, 10), last.toISOString().slice(0, 10)]
  }],
  ['This year',   () => [`${new Date().getUTCFullYear()}-01-01`, today()]],
]

export default function Reports() {
  const [tab,      setTab]      = useState('branch')
  const [from,     setFrom]     = useState(monthStart())
  const [to,       setTo]       = useState(today())
  const [branches, setBranches] = useState([])

  useEffect(() => { apiFetch('/branches').then(setBranches).catch(() => {}) }, [])

  return (
    <div style={{ animation: 'fadeUp .2s ease' }}>
      <PageHeader title="Reports" sub="Income, cash and product movement by period">
        <div className="flex gap-2 items-center flex-wrap">
          {PRESETS.map(([label, range]) => (
            <button key={label} onClick={() => { const [f, t] = range(); setFrom(f); setTo(t) }}
              className="text-xs px-3 py-1.5 rounded-lg border cursor-pointer"
              style={{ background: 'transparent', color: 'var(--ink-60)', borderColor: 'var(--ink-10)' }}>
              {label}
            </button>
          ))}
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
          <span className="text-xs" style={{ color: 'var(--ink-30)' }}>to</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} />
        </div>
      </PageHeader>

      <div className="flex mb-5 flex-wrap" style={{ borderBottom: '1px solid var(--ink-10)' }}>
        <TabBtn label="Income by branch" active={tab === 'branch'}   onClick={() => setTab('branch')} />
        <TabBtn label="Cash book"        active={tab === 'cash'}     onClick={() => setTab('cash')} />
        <TabBtn label="Products"         active={tab === 'products'} onClick={() => setTab('products')} />
      </div>

      {tab === 'branch'   && <ByBranch from={from} to={to} />}
      {tab === 'cash'     && <CashBook from={from} to={to} branches={branches} />}
      {tab === 'products' && <Products from={from} to={to} branches={branches} />}
    </div>
  )
}
