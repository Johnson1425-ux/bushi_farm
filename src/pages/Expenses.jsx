import { useState, useEffect, useCallback, useRef } from 'react'
import { apiFetch, BASE } from '../lib/api'
import { Card, CardTitle, Btn, PageHeader, EmptyState, Spinner } from '../components/ui'

/* ══════════════════════════════════════════════════════════════
   EXPENSES

   The farm keeps a workbook a month, and every figure in it lands on one
   of a dozen lines — feed, medicine, running the farm, the household,
   the lorry, the shops, wages. This is that book.

   Three ways of reading the same entries, and nothing else:

     The month     the detail sheets — every line spent, under its heading
     Year summary  the SUMMARY grid — category down, month across
     Workbooks     where a month came from, and what its file said

   The grids are worked out from the entries every time they are asked
   for, never stored. That is the whole difference from the spreadsheet:
   in the September 2026 workbook the summary's formulas had slipped a
   row from BMH downwards, so the lorry's column was showing the shops'
   spending. The month's grand total was still right, which is exactly
   why nobody had caught it.
══════════════════════════════════════════════════════════════ */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

const fmt    = (n, dec = 0) => Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: dec })
const fmtTsh = (n) => `TSh ${fmt(n)}`
const num    = (v) => Number(v) || 0
const today  = () => new Date().toISOString().slice(0, 10)

/** Big money, short. 9,308,400 reads as 9.3M in a cell the eye scans. */
function brief(n) {
  const v = num(n)
  if (!v) return '—'
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1)}M`
  if (Math.abs(v) >= 1e3) return `${Math.round(v / 1e3)}k`
  return fmt(v)
}

const TH = ({ children, right }) => (
  <th className={`px-4 py-3 text-[11px] font-semibold tracking-wider uppercase border-b ${right ? 'text-right' : 'text-left'}`}
    style={{ color: 'var(--ink-60)', borderColor: 'var(--ink-10)', whiteSpace: 'nowrap' }}>{children}</th>
)
const TD = ({ children, right, mono, style = {}, colSpan }) => (
  <td colSpan={colSpan} className={`px-4 py-2.5 border-b text-[13px] ${right ? 'text-right' : ''}`}
    style={{
      borderColor: 'var(--ink-10)', color: 'var(--ink)',
      fontFamily: mono ? "'DM Mono', monospace" : 'inherit', fontSize: mono ? 12 : 13, ...style,
    }}>{children}</td>
)

function TabBtn({ label, active, onClick, badge }) {
  return (
    <button onClick={onClick} className="px-4 py-2 text-sm font-medium border-0 bg-transparent cursor-pointer"
      style={{
        color: active ? 'var(--green-600)' : 'var(--ink-60)',
        borderBottom: active ? '2px solid var(--green-600)' : '2px solid transparent',
      }}>
      {label}
      {badge > 0 && (
        <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
          style={{ background: 'var(--amber)', color: '#fff' }}>{badge}</span>
      )}
    </button>
  )
}

/* A category's share of the month, which is the question the list is
   really being read for — not what the feed cost, but how much of the
   month the feed was. */
function ShareBar({ value, of }) {
  const pct = of > 0 ? Math.min(100, (num(value) / of) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden min-w-[60px]" style={{ background: 'var(--ink-10)' }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--green-400)' }} />
      </div>
      <span className="text-[11px] min-w-[34px] text-right" style={{ color: 'var(--ink-60)' }}>
        {pct >= 0.5 ? `${Math.round(pct)}%` : ''}
      </span>
    </div>
  )
}

function Notice({ kind = 'error', children, onClose }) {
  const tone = kind === 'error'
    ? { bg: 'rgba(217,64,64,0.08)', border: 'var(--red)',   fg: 'var(--red)' }
    : kind === 'warn'
    ? { bg: 'rgba(232,160,32,0.10)', border: 'var(--amber)', fg: 'var(--amber)' }
    : { bg: 'var(--green-100)',      border: 'var(--green-600)', fg: 'var(--green-800)' }
  return (
    <div className="rounded-lg border mb-4 text-[13px] flex items-start justify-between gap-3"
      style={{ padding: '10px 16px', background: tone.bg, borderColor: tone.border, color: tone.fg }}>
      <div className="flex-1">{children}</div>
      {onClose && (
        <button onClick={onClose} className="border-0 bg-transparent cursor-pointer text-[14px] leading-none"
          style={{ color: 'inherit', opacity: 0.6 }}>✕</button>
      )}
    </div>
  )
}

/* ── the month ───────────────────────────────────────────── */

function MonthPicker({ year, month, onChange }) {
  const step = (by) => {
    let m = month + by, y = year
    if (m < 1)  { m = 12; y -= 1 }
    if (m > 12) { m = 1;  y += 1 }
    onChange(y, m)
  }
  const thisYear = new Date().getFullYear()
  return (
    <div className="flex items-center gap-2">
      <Btn size="sm" onClick={() => step(-1)}>‹</Btn>
      <select value={month} onChange={e => onChange(year, Number(e.target.value))} style={{ minWidth: 130 }}>
        {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
      </select>
      <select value={year} onChange={e => onChange(Number(e.target.value), month)}>
        {Array.from({ length: 7 }, (_, i) => thisYear + 1 - i).map(y => <option key={y} value={y}>{y}</option>)}
      </select>
      <Btn size="sm" onClick={() => step(1)}>›</Btn>
    </div>
  )
}

function AddLine({ categories, date, onSaved, onError, onCancel }) {
  const [form, setForm] = useState({
    entry_date: date, category_id: '', details: '', quantity: '', unit_price: '', amount: '', notes: '',
  })
  const [busy, setBusy] = useState(false)

  /* The sheet's own arithmetic, shown before it is saved: a quantity and
     a price are how most lines are written, and the amount column is
     their product. Typing an amount instead overrides it. */
  const derived = num(form.quantity) && num(form.unit_price)
    ? Math.round(num(form.quantity) * num(form.unit_price) * 100) / 100 : 0
  const amount = num(form.amount) || derived

  const save = async () => {
    setBusy(true)
    try {
      await apiFetch('/expenses', {
        method: 'POST',
        body: JSON.stringify({
          entry_date: form.entry_date,
          category_id: Number(form.category_id),
          details: form.details,
          quantity:   form.quantity   === '' ? null : num(form.quantity),
          unit_price: form.unit_price === '' ? null : num(form.unit_price),
          amount: num(form.amount) || null,
          notes: form.notes || null,
        }),
      })
      setForm(f => ({ ...f, details: '', quantity: '', unit_price: '', amount: '', notes: '' }))
      onSaved()
    } catch (e) { onError(e.message) } finally { setBusy(false) }
  }

  const Field = ({ label, children, span }) => (
    <div style={span ? { gridColumn: '1 / -1' } : undefined}>
      <label className="block text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--ink-60)' }}>{label}</label>
      {children}
    </div>
  )

  return (
    <Card>
      <CardTitle>Record a line</CardTitle>
      <p className="text-sm mb-3" style={{ color: 'var(--ink-60)' }}>
        For money paid out before the month's workbook catches up with it. Lines typed here stay
        put when the workbook is uploaded — only what a previous upload brought in is replaced.
      </p>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        <Field label="Date">
          <input type="date" className="w-full" value={form.entry_date}
            onChange={e => setForm(f => ({ ...f, entry_date: e.target.value }))} />
        </Field>
        <Field label="Line">
          <select className="w-full" value={form.category_id}
            onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
            <option value="">Choose…</option>
            {categories.filter(c => c.active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="What for" span>
          <input type="text" className="w-full" value={form.details} placeholder="e.g. Machicha kg 5,640"
            onChange={e => setForm(f => ({ ...f, details: e.target.value }))} />
        </Field>
        <Field label="Quantity">
          <input type="number" step="any" className="w-full" value={form.quantity}
            onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
        </Field>
        <Field label="Price each">
          <input type="number" step="any" className="w-full" value={form.unit_price}
            onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))} />
        </Field>
        <Field label="Amount">
          <input type="number" step="any" className="w-full" value={form.amount}
            placeholder={derived ? fmt(derived, 2) : ''}
            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
          {derived > 0 && !num(form.amount) && (
            <div className="text-[11px] mt-1" style={{ color: 'var(--ink-30)' }}>
              {fmt(form.quantity, 2)} × {fmt(form.unit_price, 2)} = {fmtTsh(derived)}
            </div>
          )}
        </Field>
      </div>
      <div className="flex gap-2 justify-end mt-4">
        <Btn size="sm" onClick={onCancel}>Cancel</Btn>
        <Btn size="sm" variant="primary" onClick={save}
          disabled={busy || !form.category_id || !form.details.trim() || !amount}>
          {busy ? <Spinner /> : null}Save {amount ? fmtTsh(amount) : ''}
        </Btn>
      </div>
    </Card>
  )
}

function MonthView({ year, month, onMonth, categories, onError }) {
  const [data,   setData]   = useState(null)
  const [filter, setFilter] = useState(null)   // category id, or null for all
  const [q,      setQ]      = useState('')
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    const params = new URLSearchParams({ year, month })
    if (q) params.set('q', q)
    try { setData(await apiFetch(`/expenses?${params}`)) }
    catch (e) { onError(e.message) }
  }, [year, month, q, onError])

  useEffect(() => { load() }, [load])
  useEffect(() => { setFilter(null) }, [year, month])

  const remove = async (entry) => {
    try { await apiFetch(`/expenses/${entry.id}`, { method: 'DELETE' }); load() }
    catch (e) { onError(e.message) }
  }

  if (!data) return <div className="p-8 text-center text-sm" style={{ color: 'var(--ink-30)' }}>Loading…</div>

  const spent   = data.categories.filter(c => c.total > 0)
  const idle    = data.categories.filter(c => !c.total)
  const biggest = spent[0] ? spent.reduce((a, c) => (c.total > a.total ? c : a)) : null
  const rows    = filter ? data.entries.filter(e => e.category_id === filter) : data.entries
  const firstOf = `${year}-${String(month).padStart(2, '0')}-01`
  const inThisMonth = today().slice(0, 7) === firstOf.slice(0, 7)

  return (
    <>
      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        {[
          { label: 'Spent this month', value: fmtTsh(data.total), color: 'var(--ink)' },
          { label: 'Lines recorded',   value: fmt(data.counts.entries), color: 'var(--ink-60)' },
          { label: 'Biggest line',     value: biggest ? biggest.name : '—',
            note: biggest ? fmtTsh(biggest.total) : null, color: 'var(--ink)' },
          { label: 'From the workbook', value: fmt(data.counts.imported),
            note: `${fmt(data.counts.manual)} typed in`, color: 'var(--ink-60)' },
        ].map(k => (
          <div key={k.label} className="rounded-lg border"
            style={{ background: 'var(--surface)', borderColor: 'var(--ink-10)', padding: '16px 20px' }}>
            <div className="text-[11px] uppercase tracking-wider font-medium mb-1" style={{ color: 'var(--ink-60)' }}>{k.label}</div>
            <div className="text-[19px] font-semibold leading-tight" style={{ color: k.color }}>{k.value}</div>
            {k.note && <div className="text-[11px] mt-0.5" style={{ color: 'var(--ink-30)' }}>{k.note}</div>}
          </div>
        ))}
      </div>

      {!data.entries.length && !q && (
        <Notice kind="warn">
          Nothing is recorded for {MONTHS[month - 1]} {year} yet. Upload the month's workbook under
          <strong> Workbooks</strong>, or record the lines here one at a time.
        </Notice>
      )}

      {data.import && (
        <div className="text-xs mb-4" style={{ color: 'var(--ink-60)' }}>
          {fmt(data.import.entry_count)} of these lines came from <strong>{data.import.filename}</strong>,
          uploaded by {data.import.uploaded_by || 'someone'} on {String(data.import.uploaded_at).slice(0, 10)}.
        </div>
      )}

      {adding && (
        <AddLine
          categories={categories}
          date={inThisMonth ? today() : firstOf}
          onSaved={() => { load() }}
          onError={onError}
          onCancel={() => setAdding(false)}
        />
      )}

      <Card noPad>
        <div className="px-5 pt-5 pb-1 flex items-center justify-between flex-wrap gap-2">
          <div className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
            Where the month went
          </div>
          {filter && (
            <button onClick={() => setFilter(null)} className="border-0 bg-transparent cursor-pointer text-xs"
              style={{ color: 'var(--green-600)' }}>Show every line</button>
          )}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full border-collapse text-[13px]" style={{ minWidth: 520 }}>
            <thead>
              <tr><TH>Line</TH><TH right>Lines</TH><TH right>Amount</TH><TH>Share of the month</TH></tr>
            </thead>
            <tbody>
              {spent.length === 0 && (
                <tr><td colSpan={4}><EmptyState>Nothing recorded against any line this month.</EmptyState></td></tr>
              )}
              {spent.map(c => (
                <tr key={c.id} style={{ background: filter === c.id ? 'var(--cream-dark)' : undefined }}>
                  <td className="px-4 py-2.5 border-b" style={{ borderColor: 'var(--ink-10)' }}>
                    <button onClick={() => setFilter(filter === c.id ? null : c.id)}
                      className="border-0 bg-transparent cursor-pointer font-semibold text-[13px] text-left p-0"
                      style={{ color: 'var(--green-600)', whiteSpace: 'nowrap' }}>{c.name}</button>
                    {/* The heading is the row; what it means is a help note, and
                        on a phone it would take four lines from the figures. */}
                    {c.notes && <div className="text-[11px] mt-0.5 hidden sm:block" style={{ color: 'var(--ink-30)' }}>{c.notes}</div>}
                  </td>
                  <TD right mono style={{ color: 'var(--ink-60)' }}>{fmt(c.entry_count)}</TD>
                  <TD right mono style={{ fontWeight: 600 }}>{fmt(c.total)}</TD>
                  <TD style={{ minWidth: 160 }}><ShareBar value={c.total} of={data.total} /></TD>
                </tr>
              ))}
              {spent.length > 0 && (
                <tr>
                  <TD style={{ fontWeight: 600 }}>Total</TD>
                  <TD right mono style={{ color: 'var(--ink-60)' }}>{fmt(data.counts.entries)}</TD>
                  <TD right mono style={{ fontWeight: 700 }}>{fmt(data.total)}</TD>
                  <TD />
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {idle.length > 0 && (
          <div className="px-5 py-3 text-[11px]" style={{ color: 'var(--ink-30)', borderTop: '1px solid var(--ink-10)' }}>
            Nothing spent this month on: {idle.map(c => c.name).join(', ')}.
          </div>
        )}
      </Card>

      <Card noPad>
        <div className="px-5 pt-5 pb-3 flex items-center justify-between flex-wrap gap-2">
          <div className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
            {filter ? data.categories.find(c => c.id === filter)?.name : 'Every line'}
            <span className="ml-2 font-normal" style={{ color: 'var(--ink-30)' }}>{fmt(rows.length)}</span>
          </div>
          <input type="search" placeholder="Search what it was for" value={q}
            onChange={e => setQ(e.target.value)} style={{ minWidth: 200 }} />
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full border-collapse text-[13px]" style={{ minWidth: 720 }}>
            <thead>
              <tr>
                <TH>Date</TH><TH>Line</TH><TH>What for</TH>
                <TH right>Qty</TH><TH right>Price</TH><TH right>Amount</TH><TH>From</TH><TH />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={8}><EmptyState>
                  {q ? 'No line this month matches that.' : 'No lines recorded for this month yet.'}
                </EmptyState></td></tr>
              )}
              {rows.map(e => (
                <tr key={e.id}>
                  <TD mono style={{ color: 'var(--ink-60)', whiteSpace: 'nowrap' }}>{e.entry_date}</TD>
                  <TD style={{ color: 'var(--ink-60)', whiteSpace: 'nowrap' }}>{e.category}</TD>
                  <TD>{e.details}</TD>
                  <TD right mono style={{ color: 'var(--ink-60)' }}>{e.quantity ? fmt(e.quantity, 2) : ''}</TD>
                  <TD right mono style={{ color: 'var(--ink-60)' }}>{e.unit_price ? fmt(e.unit_price, 2) : ''}</TD>
                  <TD right mono style={{ fontWeight: 600 }}>{fmt(e.amount)}</TD>
                  <TD style={{ color: 'var(--ink-30)', fontSize: 11, whiteSpace: 'nowrap' }}>
                    {e.source === 'import'
                      ? (e.source_ref || 'workbook')
                      : `${e.created_by || 'typed in'}`}
                  </TD>
                  <TD right>
                    {e.source === 'manual' && (
                      <button onClick={() => remove(e)} title="Remove this line"
                        className="border-0 bg-transparent cursor-pointer text-[12px] p-1"
                        style={{ color: 'var(--ink-30)' }}>✕</button>
                    )}
                  </TD>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {!adding && (
        <div className="flex justify-end">
          <Btn size="sm" variant="primary" onClick={() => setAdding(true)}>+ Record a line</Btn>
        </div>
      )}
    </>
  )
}

/* ── the year ────────────────────────────────────────────── */

function YearView({ year, onYear, onError }) {
  const [grid,  setGrid]  = useState(null)
  const [years, setYears] = useState(null)

  useEffect(() => {
    apiFetch(`/expenses/summary?year=${year}`).then(setGrid).catch(e => onError(e.message))
  }, [year, onError])
  useEffect(() => {
    apiFetch('/expenses/years').then(setYears).catch(() => {})
  }, [year])

  if (!grid) return <div className="p-8 text-center text-sm" style={{ color: 'var(--ink-30)' }}>Loading…</div>

  const thisYear = new Date().getFullYear()
  const busiest  = Math.max(...grid.months, 0)
  const known    = years?.years?.length > 1

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="text-sm" style={{ color: 'var(--ink-60)' }}>
          Every cell is the sum of the lines under it, worked out when you asked for it.
        </div>
        <select value={year} onChange={e => onYear(Number(e.target.value))}>
          {Array.from({ length: 7 }, (_, i) => thisYear + 1 - i).map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <Card noPad>
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full border-collapse text-[13px]" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <TH>Line</TH>
                {MONTHS.map(m => <TH key={m} right>{m.slice(0, 3)}</TH>)}
                <TH right>Year</TH>
              </tr>
            </thead>
            <tbody>
              {grid.categories.map(c => (
                <tr key={c.id} style={{ opacity: c.total ? 1 : 0.45 }}>
                  <TD style={{ whiteSpace: 'nowrap', fontWeight: c.total ? 500 : 400 }}>{c.name}</TD>
                  {c.months.map((m, i) => (
                    <TD key={i} right mono style={{ color: m ? 'var(--ink)' : 'var(--ink-30)' }}>{brief(m)}</TD>
                  ))}
                  <TD right mono style={{ fontWeight: 600 }}>{brief(c.total)}</TD>
                </tr>
              ))}
              <tr>
                <TD style={{ fontWeight: 700 }}>Total</TD>
                {grid.months.map((m, i) => (
                  <TD key={i} right mono style={{
                    fontWeight: 600,
                    color: m && m === busiest ? 'var(--red)' : m ? 'var(--ink)' : 'var(--ink-30)',
                  }}>{brief(m)}</TD>
                ))}
                <TD right mono style={{ fontWeight: 700 }}>{brief(grid.total)}</TD>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 text-[11px]" style={{ color: 'var(--ink-30)', borderTop: '1px solid var(--ink-10)' }}>
          Figures are shortened — {fmtTsh(grid.total)} for {grid.year} in full. A month at zero usually
          means its workbook has not been uploaded yet rather than a month with nothing spent.
        </div>
      </Card>

      {known && (
        <Card noPad>
          <div className="px-5 pt-5 pb-3 text-sm font-semibold" style={{ color: 'var(--ink)' }}>
            Year on year
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  <TH>Line</TH>
                  {years.years.map(y => <TH key={y} right>{y}</TH>)}
                </tr>
              </thead>
              <tbody>
                {years.categories.map(c => (
                  <tr key={c.id}>
                    <TD style={{ whiteSpace: 'nowrap' }}>{c.name}</TD>
                    {years.years.map(y => (
                      <TD key={y} right mono style={{ color: c.by_year[y] ? 'var(--ink)' : 'var(--ink-30)' }}>
                        {brief(c.by_year[y])}
                      </TD>
                    ))}
                  </tr>
                ))}
                <tr>
                  <TD style={{ fontWeight: 700 }}>Total</TD>
                  {years.years.map(y => (
                    <TD key={y} right mono style={{ fontWeight: 700 }}>{brief(years.totals[y])}</TD>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  )
}

/* ── the workbooks ───────────────────────────────────────── */

function ImportResult({ result, onClose, onOpenMonth }) {
  const disagreements = (result.check || []).filter(r => Math.abs(r.diff) > 1)

  return (
    <Card>
      <CardTitle>
        {result.period.label} — {fmt(result.entries)} lines, {fmtTsh(result.total)}
        <span className="flex items-center gap-2">
          <Btn size="sm" variant="primary" onClick={onOpenMonth}>Open the month</Btn>
          <button onClick={onClose} className="border-0 bg-transparent cursor-pointer text-[16px] leading-none"
            style={{ color: 'var(--ink-30)' }}>✕</button>
        </span>
      </CardTitle>

      {result.replaced && (
        <p className="text-xs mb-3" style={{ color: 'var(--ink-60)' }}>
          This month had already been uploaded. It was replaced — lines typed into the app by hand
          were left alone.
        </p>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table className="w-full border-collapse text-[13px] mb-4" style={{ minWidth: 560 }}>
          <thead>
            <tr><TH>Sheet</TH><TH>Line</TH><TH right>Rows</TH><TH right>Read</TH><TH right>Sheet total</TH></tr>
          </thead>
          <tbody>
            {result.sheets.filter(s => s.count > 0).map((s, i) => (
              <tr key={i}>
                <TD mono style={{ color: 'var(--ink-60)' }}>{s.sheet}</TD>
                <TD>{s.category}</TD>
                <TD right mono style={{ color: 'var(--ink-60)' }}>{fmt(s.count)}</TD>
                <TD right mono style={{ fontWeight: 600 }}>{fmt(s.total)}</TD>
                <TD right mono style={{ color: s.sheet_total == null ? 'var(--ink-30)' : 'var(--ink-60)' }}>
                  {s.sheet_total == null ? '—' : fmt(s.sheet_total)}
                </TD>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {disagreements.length > 0 && (
        <>
          <div className="text-sm font-semibold mb-2" style={{ color: 'var(--amber)' }}>
            The workbook's own summary does not agree with its detail sheets
          </div>
          <p className="text-xs mb-3" style={{ color: 'var(--ink-60)' }}>
            The detail rows were imported — they are the record. These are the lines where the
            SUMMARY sheet says something else, usually a formula pointing at the wrong cell.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table className="w-full border-collapse text-[13px] mb-4" style={{ minWidth: 520 }}>
              <thead>
                <tr><TH>Line</TH><TH right>Summary sheet</TH><TH right>Detail sheets</TH><TH right>Difference</TH></tr>
              </thead>
              <tbody>
                {disagreements.map(r => (
                  <tr key={r.category}>
                    <TD>{r.category}</TD>
                    <TD right mono style={{ color: 'var(--ink-60)' }}>{r.workbook == null ? 'no line' : fmt(r.workbook)}</TD>
                    <TD right mono style={{ fontWeight: 600 }}>{fmt(r.parsed)}</TD>
                    <TD right mono style={{ color: 'var(--red)' }}>{r.diff > 0 ? '+' : ''}{fmt(r.diff)}</TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {result.warnings?.length > 0 && (
        <div className="mb-4">
          <div className="text-sm font-semibold mb-2" style={{ color: 'var(--ink)' }}>Worth a look</div>
          <ul className="text-[12px] pl-5 list-disc" style={{ color: 'var(--ink-60)' }}>
            {result.warnings.map((w, i) => <li key={i} className="mb-1">{w}</li>)}
          </ul>
        </div>
      )}

      {result.skipped?.length > 0 && (
        <div>
          <div className="text-sm font-semibold mb-2" style={{ color: 'var(--ink)' }}>Sheets left out</div>
          <ul className="text-[12px] pl-5 list-disc" style={{ color: 'var(--ink-60)' }}>
            {result.skipped.map((s, i) => (
              <li key={i} className="mb-1"><strong>{s.sheet}</strong> — {s.why}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}

function BooksView({ onError, onImported, onOpenMonth }) {
  const [imports,  setImports]  = useState(null)
  const [result,   setResult]   = useState(null)
  const [issues,   setIssues]   = useState([])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef()

  const load = useCallback(async () => {
    try { setImports(await apiFetch('/expenses/imports')) }
    catch (e) { onError(e.message) }
  }, [onError])

  useEffect(() => { load() }, [load])

  const upload = async (file) => {
    setUploading(true); setIssues([]); setResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const token = localStorage.getItem('mt_token')
      const res = await fetch(`${BASE}/expenses/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) {
        /* A 422 carries the reasons the file could not be read, which are
           the only thing that will get it imported on the next try. */
        if (data.issues?.length) setIssues(data.issues)
        throw new Error(data.error || 'The workbook could not be uploaded')
      }
      setResult(data)
      load(); onImported(data)
    } catch (e) { onError(e.message) } finally { setUploading(false) }
  }

  const remove = async (imp) => {
    if (!window.confirm(`Remove ${imp.label}? The ${fmt(imp.entry_count)} lines it brought in go with it. Anything typed in by hand stays.`)) return
    try { await apiFetch(`/expenses/imports/${imp.id}`, { method: 'DELETE' }); load(); onImported({}) }
    catch (e) { onError(e.message) }
  }

  return (
    <>
      <Card>
        <CardTitle>Upload a month's workbook</CardTitle>
        <p className="text-sm mb-4" style={{ color: 'var(--ink-60)' }}>
          The farm's own file, as it is kept — no template to fill in. Each detail sheet is read
          under its own heading, and the month is taken from the dates inside rather than from the
          file name. Uploading a month again replaces it, so a corrected workbook can simply be
          sent up a second time.
        </p>
        <p className="text-xs mb-4" style={{ color: 'var(--ink-30)' }}>
          The payment and consumption sheets are deliberately left out: they are the same spending
          cut a different way, and reading them too would count it twice. Every sheet skipped is
          named after an upload, with the reason.
        </p>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }} />
        <Btn variant="primary" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? <><Spinner />Reading the workbook…</> : 'Choose a workbook'}
        </Btn>
      </Card>

      {issues.length > 0 && (
        <Notice kind="error" onClose={() => setIssues([])}>
          <div className="font-semibold mb-1">The workbook could not be imported</div>
          <ul className="pl-5 list-disc">{issues.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </Notice>
      )}

      {result && (
        <ImportResult result={result} onClose={() => setResult(null)}
          onOpenMonth={() => onOpenMonth(result.period)} />
      )}

      <Card noPad>
        <div className="px-5 pt-5 pb-3 text-sm font-semibold" style={{ color: 'var(--ink)' }}>
          Months read in
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full border-collapse text-[13px]" style={{ minWidth: 700 }}>
            <thead>
              <tr><TH>Month</TH><TH>File</TH><TH>Sheets</TH><TH right>Lines</TH><TH right>Total</TH><TH>Uploaded</TH><TH /></tr>
            </thead>
            <tbody>
              {imports && imports.length === 0 && (
                <tr><td colSpan={7}><EmptyState>
                  No workbook has been uploaded yet. Anything recorded so far was typed in by hand.
                </EmptyState></td></tr>
              )}
              {(imports || []).map(i => (
                <tr key={i.id}>
                  <TD style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{i.label}</TD>
                  <TD style={{ color: 'var(--ink-60)' }}>{i.filename}</TD>
                  <TD style={{ color: 'var(--ink-30)', fontSize: 11 }}>{i.sheets}</TD>
                  <TD right mono style={{ color: 'var(--ink-60)' }}>{fmt(i.entry_count)}</TD>
                  <TD right mono style={{ fontWeight: 600 }}>{fmt(i.total)}</TD>
                  <TD mono style={{ color: 'var(--ink-60)', whiteSpace: 'nowrap' }}>
                    {String(i.uploaded_at).slice(0, 10)}
                    {i.uploaded_by && <span style={{ color: 'var(--ink-30)' }}> · {i.uploaded_by}</span>}
                  </TD>
                  <TD right>
                    <Btn size="sm" variant="danger" onClick={() => remove(i)}>Remove</Btn>
                  </TD>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}

/* ── the page ────────────────────────────────────────────── */

export default function Expenses() {
  const now = new Date()
  const [tab,   setTab]   = useState('month')
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [categories, setCategories] = useState([])
  const [error, setError] = useState(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    apiFetch('/expenses/categories').then(setCategories).catch(() => {})
  }, [reload])

  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(null), 8000)
    return () => clearTimeout(t)
  }, [error])

  /* An upload refreshes what the page knows but stays where it is.

     Jumping straight to the month would be convenient and would throw
     away the one screen worth reading: which sheets were skipped, which
     of the workbook's own totals disagree with its detail sheets, and
     whether the payroll on it belongs to this month at all. The result
     carries its own way through to the month instead. */
  const afterImport = () => setReload(n => n + 1)

  const openMonth = (period) => {
    setYear(period.year); setMonth(period.monthNum); setTab('month')
  }

  return (
    <div style={{ animation: 'fadeUp .2s ease' }}>
      <PageHeader title="Expenses" sub="What the farm spends, and on what">
        {tab === 'month' && <MonthPicker year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m) }} />}
      </PageHeader>

      {error && <Notice kind="error" onClose={() => setError(null)}>{error}</Notice>}

      <div className="flex mb-5" style={{ borderBottom: '1px solid var(--ink-10)' }}>
        <TabBtn label="The month"    active={tab === 'month'} onClick={() => setTab('month')} />
        <TabBtn label="Year summary" active={tab === 'year'}  onClick={() => setTab('year')} />
        <TabBtn label="Workbooks"    active={tab === 'books'} onClick={() => setTab('books')} />
      </div>

      {tab === 'month' && (
        <MonthView key={`${year}-${month}-${reload}`} year={year} month={month}
          categories={categories} onError={setError} />
      )}
      {tab === 'year' && <YearView key={`${year}-${reload}`} year={year} onYear={setYear} onError={setError} />}
      {tab === 'books' && (
        <BooksView onError={setError} onImported={afterImport} onOpenMonth={openMonth} />
      )}
    </div>
  )
}
