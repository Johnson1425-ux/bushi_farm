import { Fragment, useState, useEffect, useCallback, useRef } from 'react'
import { apiFetch, BASE } from '../lib/api'
import { authHeaders } from '../lib/session'
import { Card, CardTitle, Btn, PageHeader, EmptyState, Spinner } from '../components/ui'
import { useConfirm } from '../lib/ConfirmContext'

/* ══════════════════════════════════════════════════════════════
   EXPENSES

   Everything the farm pays out, recorded here as it is spent. A line is
   a date, what the money went on, how many at what price, and how much
   — and it is filed under one of the farm's own headings: feed,
   medicine, running the farm, the household, the lorry, the shops,
   wages. The headings are kept here too, and a new one is opened the
   moment the farm starts spending on something it did not before.

   Four ways through the same entries, and nothing else:

     The month     every line spent this month, and what each heading
                   came to
     Year summary  heading down the side, month across the top
     Categories    the headings themselves, and what each has cost
     Workbooks     the old monthly spreadsheets, read in once

   Click any heading, anywhere, and you get that heading month by month
   with the lines that made each month up — because the question a
   category is clicked for is rarely "what was the feed this month" and
   almost always "has the feed been climbing, and on what".

   Every total on the page is worked out from the entries when it is
   asked for, never stored. There is no cell here that can quietly come
   to disagree with the rows underneath it.
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

/** How many days a month has, without a date library. */
const daysInMonth = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate()

const iso = (year, month, day) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

/** "12 September" — the way a day is said out loud. */
function dayLabel(date) {
  if (!date) return ''
  const [y, m, d] = date.split('-').map(Number)
  return `${d} ${MONTHS[m - 1]} ${y}`
}

/**
 * Every day of the month, with what was spent on it.
 *
 * Days with nothing against them are in the strip too, and clickable:
 * the farm spends on most days but not all, and a day that is missing
 * from the row is a day you cannot select to write up.
 */
function daysOf(year, month, entries) {
  const totals = new Map()
  for (const e of entries) {
    const t = totals.get(e.entry_date) || { total: 0, count: 0 }
    t.total += e.amount; t.count++
    totals.set(e.entry_date, t)
  }
  return Array.from({ length: daysInMonth(year, month) }, (_, i) => {
    const date = iso(year, month, i + 1)
    const t = totals.get(date) || { total: 0, count: 0 }
    return { date, day: i + 1, total: Math.round(t.total * 100) / 100, count: t.count }
  })
}



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
      <Btn size="sm" title="The month before" onClick={() => step(-1)}>‹</Btn>
      <select value={month} onChange={e => onChange(year, Number(e.target.value))} style={{ minWidth: 130 }}>
        {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
      </select>
      <select value={year} onChange={e => onChange(Number(e.target.value), month)}>
        {Array.from({ length: 7 }, (_, i) => thisYear + 1 - i).map(y => <option key={y} value={y}>{y}</option>)}
      </select>
      <Btn size="sm" title="The month after" onClick={() => step(1)}>›</Btn>
    </div>
  )
}

/* Defined here rather than inside the form.

   A component declared in a render body is a new component type on every
   render, so React throws the old subtree away and mounts a fresh one —
   which takes the focus out of whatever input you are typing into after
   a single keystroke. */
function Field({ label, children, span }) {
  return (
    <div style={span ? { gridColumn: '1 / -1' } : undefined}>
      <label className="block text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--ink-60)' }}>{label}</label>
      {children}
    </div>
  )
}

/**
 * Record a line.
 *
 * `lockedCategory` is for the form opened from inside a category: the
 * heading is already decided, so it is shown rather than asked for
 * again. Everywhere else the heading is the one field that must be
 * chosen, which is why it sits second, right after the date.
 */
function AddLine({ categories, date, onSaved, onError, onCancel, lockedCategory }) {
  const [form, setForm] = useState({
    entry_date: date,
    category_id: lockedCategory ? String(lockedCategory.id) : '',
    details: '', quantity: '', unit_price: '', amount: '', notes: '',
  })
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(null)

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
      /* The date and the heading stay put. A day's spending is entered a
         line at a time — five fuel receipts, then the fares — and
         clearing them would mean setting both again for every one. */
      setSaved({ details: form.details, amount })
      setForm(f => ({ ...f, details: '', quantity: '', unit_price: '', amount: '', notes: '' }))
      onSaved()
    } catch (e) { onError(e.message) } finally { setBusy(false) }
  }

  return (
    <Card>
      <CardTitle>
        {lockedCategory ? `Record a line under ${lockedCategory.name}` : 'Record an expense'}
        {onCancel && (
          <button onClick={onCancel} className="border-0 bg-transparent cursor-pointer text-[16px] leading-none"
            style={{ color: 'var(--ink-30)' }}>✕</button>
        )}
      </CardTitle>
      <p className="text-sm mb-3" style={{ color: 'var(--ink-60)' }}>
        The date and the heading stay set after each save, so a day's spending can be entered a
        line at a time.
      </p>
      {saved && (
        <div className="text-xs mb-3 rounded-lg" style={{ background: 'var(--green-100)', color: 'var(--green-800)', padding: '8px 12px' }}>
          Saved {saved.details} — {fmtTsh(saved.amount)}.
        </div>
      )}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        <Field label="Date">
          <input type="date" className="w-full" value={form.entry_date}
            onChange={e => setForm(f => ({ ...f, entry_date: e.target.value }))} />
        </Field>
        <Field label="Line">
          {lockedCategory ? (
            <div className="text-[13px] font-medium rounded-lg" style={{
              background: 'var(--cream-dark)', color: 'var(--ink)', padding: '9px 12px',
            }}>{lockedCategory.name}</div>
          ) : (
            <select className="w-full" value={form.category_id}
              onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
              <option value="">Choose…</option>
              {categories.filter(c => c.active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
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
        {onCancel && <Btn size="sm" onClick={onCancel}>Done</Btn>}
        <Btn size="sm" variant="primary" onClick={save}
          disabled={busy || !form.category_id || !form.details.trim() || !amount}>
          {busy ? <Spinner /> : null}Save {amount ? fmtTsh(amount) : ''}
        </Btn>
      </div>
    </Card>
  )
}

/* ── one heading, month by month ─────────────────────────── */

function Modal({ title, onClose, children }) {
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      className="fixed inset-0 z-[100] flex items-start justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(10,30,20,0.45)' }}>
      <div className="rounded-[16px] w-full max-w-4xl p-7 my-6"
        style={{ background: 'var(--surface)' }}>
        <div className="flex items-center justify-between mb-5 gap-3">
          <div className="font-serif text-[20px]" style={{ color: 'var(--ink)' }}>{title}</div>
          <button onClick={onClose} className="border-0 bg-transparent text-[18px] cursor-pointer p-1 leading-none"
            style={{ color: 'var(--ink-30)' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

/**
 * What one heading has cost, month by month, with the lines that made
 * each month up.
 *
 * This is what a category is clicked for. The month view already says
 * what the feed came to in September; the question worth opening a
 * heading for is whether it has been climbing since June, and which
 * purchases did it — so the months are the rows, and a month opens to
 * show its lines rather than sending anyone to another page to find them.
 *
 * Every month of the year is listed, spent on or not. A category that
 * went quiet for two months is a reading, and a table that simply
 * omitted those months would hide it.
 */
function CategoryDetail({ id, year, onYear, categories, onClose, onError, onChanged }) {
  const [data,   setData]   = useState(null)
  const [open,   setOpen]   = useState(null)   // which month is expanded
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    try { setData(await apiFetch(`/expenses/categories/${id}?year=${year}`)) }
    catch (e) { onError(e.message) }
  }, [id, year, onError])

  useEffect(() => { load() }, [load])

  const remove = async (entry) => {
    try { await apiFetch(`/expenses/${entry.id}`, { method: 'DELETE' }); load(); onChanged() }
    catch (e) { onError(e.message) }
  }

  if (!data) return <Modal title="Loading…" onClose={onClose}><div /></Modal>

  const { category } = data
  const busiest = Math.max(...data.months.map(m => m.total), 0)
  const thisYear = new Date().getFullYear()
  /* A new line goes on today when today is in the year being read, and
     on the first of the year otherwise — writing up December in January
     should not silently date itself to January. */
  const defaultDate = today().slice(0, 4) === String(year) ? today() : `${year}-01-01`

  return (
    <Modal title={category.name} onClose={onClose}>
      {category.notes && (
        <p className="text-sm -mt-3 mb-4" style={{ color: 'var(--ink-60)' }}>{category.notes}</p>
      )}

      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
        {[
          { label: `Spent in ${year}`, value: fmtTsh(data.total) },
          { label: 'Lines',            value: fmt(data.entry_count) },
          { label: 'Month average',    value: fmtTsh(data.monthly_average),
            note: 'over the months with spending on them' },
          { label: 'Heaviest month',   value: data.busiest_month ? MONTHS[data.busiest_month - 1] : '—' },
        ].map(k => (
          <div key={k.label} className="rounded-lg" style={{ background: 'var(--cream-dark)', padding: '10px 14px' }}>
            <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--ink-60)' }}>{k.label}</div>
            <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink)' }}>{k.value}</div>
            {k.note && <div className="text-[10px] mt-0.5" style={{ color: 'var(--ink-30)' }}>{k.note}</div>}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="text-xs" style={{ color: 'var(--ink-60)' }}>
          Click a month to see the lines that make it up.
          {data.years.length > 1 && (
            <span> This heading has spending in {data.years.map(y => y.year).join(', ')}.</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select value={year} onChange={e => onYear(Number(e.target.value))}>
            {Array.from({ length: 7 }, (_, i) => thisYear + 1 - i).map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <Btn size="sm" variant="primary" onClick={() => setAdding(v => !v)}>
            {adding ? 'Done' : '+ Record a line'}
          </Btn>
        </div>
      </div>

      {adding && (
        <AddLine
          categories={categories}
          lockedCategory={category}
          date={defaultDate}
          onSaved={() => { load(); onChanged() }}
          onError={onError}
          onCancel={() => setAdding(false)}
        />
      )}

      <div style={{ overflowX: 'auto' }}>
        <table className="w-full border-collapse text-[13px]" style={{ minWidth: 520 }}>
          <thead>
            <tr><TH>Month</TH><TH right>Lines</TH><TH right>Spent</TH><TH>Against the heaviest month</TH></tr>
          </thead>
          <tbody>
            {data.months.map(m => (
              <Fragment key={m.month}>
                <tr style={{ opacity: m.entry_count ? 1 : 0.45 }}>
                  <td className="px-4 py-2.5 border-b" style={{ borderColor: 'var(--ink-10)' }}>
                    {m.entry_count ? (
                      <button onClick={() => setOpen(open === m.month ? null : m.month)}
                        className="border-0 bg-transparent cursor-pointer text-[13px] font-medium text-left p-0"
                        style={{ color: 'var(--green-600)' }}>
                        <span style={{ display: 'inline-block', width: 14 }}>{open === m.month ? '▾' : '▸'}</span>
                        {MONTHS[m.month - 1]}
                      </button>
                    ) : (
                      <span className="text-[13px]" style={{ color: 'var(--ink-60)', paddingLeft: 14 }}>
                        {MONTHS[m.month - 1]}
                      </span>
                    )}
                  </td>
                  <TD right mono style={{ color: 'var(--ink-60)' }}>{m.entry_count || ''}</TD>
                  <TD right mono style={{ fontWeight: m.total ? 600 : 400 }}>
                    {m.total ? fmt(m.total) : '—'}
                  </TD>
                  <TD style={{ minWidth: 150 }}>
                    {m.total ? <ShareBar value={m.total} of={busiest} /> : null}
                  </TD>
                </tr>

                {open === m.month && m.entries.map(e => (
                  <tr key={e.id} style={{ background: 'var(--cream-dark)' }}>
                    <TD mono style={{ color: 'var(--ink-60)', paddingLeft: 34 }}>{e.entry_date}</TD>
                    <TD colSpan={2} style={{ color: 'var(--ink)' }}>
                      {e.details}
                      {(e.quantity || e.unit_price) && (
                        <span className="ml-2 text-[11px]" style={{ color: 'var(--ink-30)' }}>
                          {fmt(e.quantity, 2)} × {fmt(e.unit_price, 2)}
                        </span>
                      )}
                    </TD>
                    <TD right>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>{fmt(e.amount)}</span>
                      {e.source === 'manual' && (
                        <button onClick={() => remove(e)} title="Remove this line"
                          className="border-0 bg-transparent cursor-pointer text-[12px] ml-2"
                          style={{ color: 'var(--ink-30)' }}>✕</button>
                      )}
                    </TD>
                  </tr>
                ))}
              </Fragment>
            ))}
            <tr>
              <TD style={{ fontWeight: 700 }}>{year}</TD>
              <TD right mono style={{ color: 'var(--ink-60)' }}>{fmt(data.entry_count)}</TD>
              <TD right mono style={{ fontWeight: 700 }}>{fmt(data.total)}</TD>
              <TD />
            </tr>
          </tbody>
        </table>
      </div>

      {data.years.length > 1 && (
        <div className="mt-5">
          <div className="text-sm font-semibold mb-2" style={{ color: 'var(--ink)' }}>Year on year</div>
          <div className="flex flex-wrap gap-2">
            {data.years.map(y => (
              <button key={y.year} onClick={() => onYear(y.year)}
                className="rounded-lg border cursor-pointer text-left"
                style={{
                  padding: '8px 14px', background: y.year === year ? 'var(--green-100)' : 'var(--surface)',
                  borderColor: y.year === year ? 'var(--green-600)' : 'var(--ink-10)',
                }}>
                <div className="text-[11px]" style={{ color: 'var(--ink-60)' }}>{y.year}</div>
                <div className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>{fmt(y.total)}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}

function MonthView({ year, month, categories, onError, onOpenCategory, adding, setAdding, onChanged }) {
  const [data, setData] = useState(null)
  const [q,    setQ]    = useState('')
  /* Which day's lines are on screen. A month is two or three hundred
     lines and nobody reads them all at once — the book itself is kept a
     day at a time, a date written once with the day's spending under it. */
  const [day,  setDay]  = useState(null)
  /* The strip is a month wide and a phone is not, so the day being read
     is scrolled to rather than left somewhere off to the right. */
  const dayChip = useRef(null)

  const load = useCallback(async () => {
    const params = new URLSearchParams({ year, month })
    if (q) params.set('q', q)
    try { setData(await apiFetch(`/expenses?${params}`)) }
    catch (e) { onError(e.message) }
  }, [year, month, q, onError])

  useEffect(() => { load() }, [load])

  /* Which day to open on: today when today is in this month — that is
     the day someone is here to write up — and otherwise the last day
     anything was spent, which is where a month being read back ends.
     Only ever set once per month, so it cannot pull the day out from
     under someone who has chosen one. */
  useEffect(() => {
    if (!data || day) return
    const today_ = today()
    if (today_.slice(0, 7) === `${year}-${String(month).padStart(2, '0')}`) return setDay(today_)
    const spent = daysOf(year, month, data.entries).filter(d => d.count)
    setDay(spent.length ? spent[spent.length - 1].date : iso(year, month, 1))
  }, [data, day, year, month])

  useEffect(() => {
    dayChip.current?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [day])

  const remove = async (entry) => {
    try { await apiFetch(`/expenses/${entry.id}`, { method: 'DELETE' }); load(); onChanged() }
    catch (e) { onError(e.message) }
  }

  if (!data) return <div className="p-8 text-center text-sm" style={{ color: 'var(--ink-30)' }}>Loading…</div>

  const spent   = data.categories.filter(c => c.total > 0)
  const idle    = data.categories.filter(c => !c.total)
  const biggest = spent[0] ? spent.reduce((a, c) => (c.total > a.total ? c : a)) : null
  const firstOf = `${year}-${String(month).padStart(2, '0')}-01`
  const inThisMonth = today().slice(0, 7) === firstOf.slice(0, 7)

  const days    = daysOf(year, month, data.entries)
  const busiest = Math.max(...days.map(d => d.total), 0)
  const onDay   = days.find(d => d.date === day) || days[0]

  /* A search is a search of the month. Narrowing it to the open day as
     well would mean a line you know you keyed is "not there" because you
     are standing on the wrong day — which is the one thing a search is
     for. The day comes back the moment the box is cleared. */
  const searching = Boolean(q.trim())
  const rows = searching ? data.entries : data.entries.filter(e => e.entry_date === day)

  const stepDay = (by) => {
    const i = days.findIndex(d => d.date === day)
    const next = days[Math.min(days.length - 1, Math.max(0, (i < 0 ? 0 : i) + by))]
    if (next) setDay(next.date)
  }

  /* Where the nearest spending is, for a day with none on it. */
  const nearest = (() => {
    if (!onDay || onDay.count) return null
    const withSpend = days.filter(d => d.count)
    if (!withSpend.length) return null
    return withSpend.reduce((a, d) =>
      Math.abs(d.day - onDay.day) < Math.abs(a.day - onDay.day) ? d : a)
  })()

  return (
    <>
      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        {[
          { label: 'Spent this month', value: fmtTsh(data.total), color: 'var(--ink)' },
          { label: 'Lines recorded',   value: fmt(data.counts.entries), color: 'var(--ink-60)' },
          { label: 'Heaviest line',    value: biggest ? biggest.name : '—',
            note: biggest ? fmtTsh(biggest.total) : null, color: 'var(--ink)' },
          { label: 'Headings used',    value: `${fmt(spent.length)} of ${fmt(data.categories.length)}`,
            note: data.counts.imported ? `${fmt(data.counts.imported)} lines from a workbook` : null,
            color: 'var(--ink-60)' },
        ].map(k => (
          <div key={k.label} className="rounded-lg border"
            style={{ background: 'var(--surface)', borderColor: 'var(--ink-10)', padding: '16px 20px' }}>
            <div className="text-[11px] uppercase tracking-wider font-medium mb-1" style={{ color: 'var(--ink-60)' }}>{k.label}</div>
            <div className="text-[19px] font-semibold leading-tight" style={{ color: k.color }}>{k.value}</div>
            {k.note && <div className="text-[11px] mt-0.5" style={{ color: 'var(--ink-30)' }}>{k.note}</div>}
          </div>
        ))}
      </div>

      {!data.entries.length && !q && !adding && (
        <Notice kind="warn">
          Nothing is recorded for {MONTHS[month - 1]} {year} yet.{' '}
          <button onClick={() => setAdding(true)} className="border-0 bg-transparent cursor-pointer underline p-0"
            style={{ color: 'inherit', font: 'inherit' }}>Record the first line</button>, or bring the
          month in from its old spreadsheet under <strong>Workbooks</strong>.
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
          /* The day on screen. Someone who has walked back to the 8th to
             read it and then records a line means the 8th; defaulting to
             today would file it three days away from where they are
             looking. */
          date={day || (inThisMonth ? today() : firstOf)}
          onSaved={() => { load(); onChanged() }}
          onError={onError}
          onCancel={() => setAdding(false)}
        />
      )}

      <Card noPad>
        <div className="px-5 pt-5 pb-1 flex items-center justify-between flex-wrap gap-2">
          <div className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
            Where the month went
          </div>
          <div className="text-[11px]" style={{ color: 'var(--ink-30)' }}>
            Click a heading for its month-by-month detail
          </div>
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
                <tr key={c.id}>
                  <td className="px-4 py-2.5 border-b" style={{ borderColor: 'var(--ink-10)' }}>
                    <button onClick={() => onOpenCategory(c.id)}
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
        <div className="px-5 pt-5 pb-3 flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
              {searching ? `Anywhere in ${MONTHS[month - 1]}` : dayLabel(day)}
              <span className="ml-2 font-normal" style={{ color: 'var(--ink-30)' }}>
                {fmt(rows.length)} {rows.length === 1 ? 'line' : 'lines'}
              </span>
            </div>
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--ink-60)' }}>
              {searching
                ? 'Searching the whole month. Clear the box to go back to the day.'
                : onDay?.count
                  ? `${fmtTsh(onDay.total)} spent on this day`
                  : 'Nothing recorded on this day'}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {!searching && (
              <>
                <Btn size="sm" title="The day before" onClick={() => stepDay(-1)} disabled={onDay?.day === 1}>‹</Btn>
                <input type="date" value={day || firstOf} min={firstOf}
                  max={iso(year, month, daysInMonth(year, month))}
                  onChange={e => e.target.value && setDay(e.target.value)} />
                <Btn size="sm" title="The day after" onClick={() => stepDay(1)} disabled={onDay?.day === days.length}>›</Btn>
              </>
            )}
            <input type="search" placeholder="Search the month" value={q}
              onChange={e => setQ(e.target.value)} style={{ minWidth: 170 }} />
          </div>
        </div>

        {/* Every day of the month, with what it cost.

            This is the month's shape at a glance — which days the lorry
            went out, which the feed came in, which nothing happened on —
            and it is how a day is chosen. Days with nothing on them are
            here too, and selectable: a day is picked to write up as often
            as to read back. */}
        {!searching && (
          <div className="px-5 pb-4 flex gap-1.5 overflow-x-auto">
            {days.map(d => {
              const on = d.date === day
              return (
                <button key={d.date} onClick={() => setDay(d.date)}
                  ref={on ? dayChip : null}
                  title={`${dayLabel(d.date)}${d.count ? ` — ${fmtTsh(d.total)} over ${d.count} line(s)` : ''}`}
                  className="rounded-lg border cursor-pointer flex-shrink-0 text-center"
                  style={{
                    padding: '5px 8px', minWidth: 46,
                    background: on ? 'var(--green-600)' : d.count ? 'var(--surface)' : 'transparent',
                    borderColor: on ? 'var(--green-600)' : 'var(--ink-10)',
                    color: on ? '#fff' : d.count ? 'var(--ink)' : 'var(--ink-30)',
                  }}>
                  <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.2 }}>{d.day}</div>
                  <div style={{ fontSize: 9.5, opacity: on ? 0.85 : 0.7 }}>
                    {d.count ? brief(d.total) : '·'}
                  </div>
                  {/* A hair of the day's weight against the heaviest day,
                      so the strip reads as a month and not a row of chips. */}
                  <div style={{ height: 2, marginTop: 3, borderRadius: 2, background: on ? 'rgba(255,255,255,.35)' : 'var(--ink-10)' }}>
                    <div style={{
                      height: 2, borderRadius: 2,
                      width: `${busiest > 0 ? Math.round((d.total / busiest) * 100) : 0}%`,
                      background: on ? '#fff' : 'var(--green-400)',
                    }} />
                  </div>
                </button>
              )
            })}
          </div>
        )}
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full border-collapse text-[13px]" style={{ minWidth: 720 }}>
            <thead>
              <tr>
                {searching && <TH>Date</TH>}
                <TH>Line</TH><TH>What for</TH>
                <TH right>Qty</TH><TH right>Price</TH><TH right>Amount</TH><TH>From</TH><TH />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={8}><EmptyState>
                  {searching ? (
                    <>Nothing in {MONTHS[month - 1]} matches that.</>
                  ) : (
                    <>
                      Nothing recorded on {dayLabel(day)}.{' '}
                      <button onClick={() => setAdding(true)}
                        className="border-0 bg-transparent cursor-pointer underline p-0"
                        style={{ color: 'var(--green-600)', font: 'inherit' }}>
                        Record a line for this day
                      </button>
                      {nearest && (
                        <>
                          {' '}— or jump to{' '}
                          <button onClick={() => setDay(nearest.date)}
                            className="border-0 bg-transparent cursor-pointer underline p-0"
                            style={{ color: 'var(--green-600)', font: 'inherit' }}>
                            {dayLabel(nearest.date)}
                          </button>, the nearest day with spending on it.
                        </>
                      )}
                    </>
                  )}
                </EmptyState></td></tr>
              )}
              {rows.map(e => (
                <tr key={e.id}>
                  {searching && (
                    <TD mono style={{ color: 'var(--ink-60)', whiteSpace: 'nowrap' }}>
                      <button onClick={() => { setQ(''); setDay(e.entry_date) }}
                        className="border-0 bg-transparent cursor-pointer p-0"
                        style={{ color: 'var(--ink-60)', font: 'inherit' }}>{e.entry_date}</button>
                    </TD>
                  )}
                  <TD style={{ whiteSpace: 'nowrap' }}>
                    <button onClick={() => onOpenCategory(e.category_id)}
                      className="border-0 bg-transparent cursor-pointer text-[13px] p-0 text-left"
                      style={{ color: 'var(--ink-60)' }}>{e.category}</button>
                  </TD>
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
              {rows.length > 0 && (
                <tr>
                  <TD colSpan={searching ? 4 : 3} style={{ fontWeight: 600 }}>
                    {searching ? `Matching lines in ${MONTHS[month - 1]}` : dayLabel(day)}
                  </TD>
                  <TD right mono style={{ color: 'var(--ink-60)' }} />
                  <TD right mono style={{ fontWeight: 700 }}>
                    {fmt(rows.reduce((a, e) => a + e.amount, 0))}
                  </TD>
                  <TD /><TD />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

    </>
  )
}

/* ── the headings themselves ─────────────────────────────── */

/**
 * The headings, and what each has cost.
 *
 * A fixed list is the whole reason the summary can be read across a
 * year: two spellings of one heading split a line in half and take
 * money out of a month without anybody noticing. So headings are opened
 * here, deliberately, rather than typed fresh on every entry.
 *
 * Closing one is the usual way to retire it — it comes off the entry
 * form and out of the summary, and every line ever filed under it keeps
 * its name. Deleting is only for a heading opened by mistake, and the
 * API refuses it the moment anything is filed underneath.
 */
function CategoryRow({ c, editing, setEditing, draft, setDraft, patch, destroy, onOpenCategory }) {
  return (
    <tr style={{ opacity: c.active ? 1 : 0.55 }}>
      <td className="px-4 py-2.5 border-b" style={{ borderColor: 'var(--ink-10)' }}>
        {editing === c.id ? (
          <input type="text" className="w-full" value={draft.name} autoFocus
            onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} />
        ) : (
          <button onClick={() => onOpenCategory(c.id)}
            className="border-0 bg-transparent cursor-pointer font-semibold text-[13px] text-left p-0"
            style={{ color: 'var(--green-600)' }}>{c.name}</button>
        )}
      </td>
      <TD style={{ color: 'var(--ink-60)', fontSize: 12 }}>
        {editing === c.id ? (
          <input type="text" className="w-full" value={draft.notes} placeholder="What belongs on this line"
            onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} />
        ) : (c.notes || '—')}
      </TD>
      <TD right mono style={{ color: 'var(--ink-60)' }}>{c.entry_count || '—'}</TD>
      <TD right mono style={{ fontWeight: 600 }}>{c.total ? fmt(c.total) : '—'}</TD>
      <TD right>
        <div className="flex gap-2 justify-end flex-wrap">
          {editing === c.id ? (
            <>
              <Btn size="sm" onClick={() => setEditing(null)}>Cancel</Btn>
              <Btn size="sm" variant="primary" disabled={!draft.name.trim()}
                onClick={() => { patch(c.id, { name: draft.name, notes: draft.notes }); setEditing(null) }}>
                Save
              </Btn>
            </>
          ) : (
            <>
              <Btn size="sm" onClick={() => { setEditing(c.id); setDraft({ name: c.name, notes: c.notes || '' }) }}>
                Rename
              </Btn>
              <Btn size="sm" onClick={() => patch(c.id, { active: !c.active })}>
                {c.active ? 'Close' : 'Reopen'}
              </Btn>
              {c.entry_count === 0 && (
                <Btn size="sm" variant="danger" onClick={() => destroy(c)}>Delete</Btn>
              )}
            </>
          )}
        </div>
      </TD>
    </tr>
  )
}

function CategoriesView({ onError, onChanged, onOpenCategory }) {
  const confirm = useConfirm()
  const [rows,    setRows]    = useState(null)
  const [showNew, setShowNew] = useState(false)
  const [form,    setForm]    = useState({ name: '', notes: '' })
  const [editing, setEditing] = useState(null)   // id being renamed
  const [draft,   setDraft]   = useState({ name: '', notes: '' })

  const load = useCallback(async () => {
    try { setRows(await apiFetch('/expenses/categories')) }
    catch (e) { onError(e.message) }
  }, [onError])

  useEffect(() => { load() }, [load])

  const refresh = () => { load(); onChanged() }

  const create = async () => {
    try {
      await apiFetch('/expenses/categories', {
        method: 'POST',
        body: JSON.stringify({ name: form.name, notes: form.notes || null }),
      })
      setForm({ name: '', notes: '' }); setShowNew(false); refresh()
    } catch (e) { onError(e.message) }
  }

  const patch = async (id, body) => {
    try { await apiFetch(`/expenses/categories/${id}`, { method: 'PATCH', body: JSON.stringify(body) }); refresh() }
    catch (e) { onError(e.message) }
  }

  const destroy = async (c) => {
    const ok = await confirm({
      title: 'Delete category',
      message: `"${c.name}" is removed from the list of categories.`,
      detail: 'Nothing has ever been filed under it, so no entries are affected.',
      confirmLabel: 'Delete',
    })
    if (!ok) return
    try { await apiFetch(`/expenses/categories/${c.id}`, { method: 'DELETE' }); refresh() }
    catch (e) { onError(e.message) }
  }

  if (!rows) return <div className="p-8 text-center text-sm" style={{ color: 'var(--ink-30)' }}>Loading…</div>

  const live = rows.filter(c => c.active)
  const shut = rows.filter(c => !c.active)

  return (
    <>
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
        <p className="text-sm max-w-2xl" style={{ color: 'var(--ink-60)' }}>
          The lines every expense is filed under. Open a new one when the farm starts spending on
          something it did not before — a second lorry, a new shop — and it appears on the entry
          form and in the summary from then on.
        </p>
        <Btn size="sm" variant="primary" onClick={() => setShowNew(v => !v)}>
          {showNew ? 'Cancel' : '+ New heading'}
        </Btn>
      </div>

      {showNew && (
        <Card>
          <CardTitle>New heading</CardTitle>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <div>
              <label className="block text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--ink-60)' }}>Name</label>
              <input type="text" className="w-full" value={form.name} placeholder="e.g. Poultry"
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="block text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--ink-60)' }}>
                What belongs on it
              </label>
              <input type="text" className="w-full" value={form.notes}
                placeholder="Shown under the heading, so two people file the same thing the same way"
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <Btn size="sm" onClick={() => setShowNew(false)}>Cancel</Btn>
            <Btn size="sm" variant="primary" disabled={!form.name.trim()} onClick={create}>Open it</Btn>
          </div>
        </Card>
      )}

      <Card noPad>
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full border-collapse text-[13px]" style={{ minWidth: 760 }}>
            <thead>
              <tr>
                <TH>Heading</TH><TH>What belongs on it</TH>
                <TH right>Lines</TH><TH right>Spent, all time</TH><TH right />
              </tr>
            </thead>
            <tbody>
              {live.map(c => (
                <CategoryRow key={c.id} c={c} editing={editing} setEditing={setEditing}
                  draft={draft} setDraft={setDraft} patch={patch} destroy={destroy}
                  onOpenCategory={onOpenCategory} />
              ))}
              {shut.length > 0 && (
                <tr>
                  <TD colSpan={5} style={{ background: 'var(--cream-dark)', color: 'var(--ink-60)', fontSize: 11 }}>
                    Closed — off the entry form and out of the summary, with their history intact.
                  </TD>
                </tr>
              )}
              {shut.map(c => (
                <CategoryRow key={c.id} c={c} editing={editing} setEditing={setEditing}
                  draft={draft} setDraft={setDraft} patch={patch} destroy={destroy}
                  onOpenCategory={onOpenCategory} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}

/* ── the year ────────────────────────────────────────────── */

function YearView({ year, onYear, onError, onOpenCategory }) {
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
          Click a heading for its month-by-month detail.
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
                  <TD style={{ whiteSpace: 'nowrap' }}>
                    <button onClick={() => onOpenCategory(c.id)}
                      className="border-0 bg-transparent cursor-pointer text-[13px] text-left p-0"
                      style={{ color: c.total ? 'var(--green-600)' : 'var(--ink-60)', fontWeight: c.total ? 500 : 400 }}>
                      {c.name}
                    </button>
                  </TD>
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
  const confirm = useConfirm()
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
      const res = await fetch(`${BASE}/expenses/import`, {
        method: 'POST',
        headers: await authHeaders(),
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
    const ok = await confirm({
      title: `Remove ${imp.label}`,
      message: `The ${fmt(imp.entry_count)} lines this upload brought in go with it.`,
      detail: 'Anything typed in by hand stays. The workbook can be uploaded again.',
      confirmLabel: 'Remove',
    })
    if (!ok) return
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
  const [adding, setAdding] = useState(false)

  /* The heading being read, and the year it is being read for. Kept here
     rather than inside a tab so that clicking a heading works the same
     from the month, from the summary grid and from the list itself. */
  const [openCategory, setOpenCategory] = useState(null)
  const [detailYear,   setDetailYear]   = useState(now.getFullYear())

  useEffect(() => {
    apiFetch('/expenses/categories').then(setCategories).catch(() => {})
  }, [reload])

  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(null), 8000)
    return () => clearTimeout(t)
  }, [error])

  const changed = () => setReload(n => n + 1)

  /* A heading opens on the year being looked at, not on this one: coming
     to it from the 2025 grid and landing in 2026 would look like the
     figures had vanished. */
  const openHeading = (id) => { setDetailYear(year); setOpenCategory(id) }

  const openMonth = (period) => {
    setYear(period.year); setMonth(period.monthNum); setTab('month')
  }

  return (
    <div style={{ animation: 'fadeUp .2s ease' }}>
      <PageHeader title="Expenses" sub="What the farm spends, and on what">
        {tab === 'month' && (
          <>
            <MonthPicker year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m) }} />
            <Btn size="sm" variant="primary" onClick={() => setAdding(v => !v)}>
              {adding ? 'Done' : '+ Record an expense'}
            </Btn>
          </>
        )}
      </PageHeader>

      {error && <Notice kind="error" onClose={() => setError(null)}>{error}</Notice>}

      <div className="flex mb-5 flex-wrap" style={{ borderBottom: '1px solid var(--ink-10)' }}>
        <TabBtn label="The month"    active={tab === 'month'}      onClick={() => setTab('month')} />
        <TabBtn label="Year summary" active={tab === 'year'}       onClick={() => setTab('year')} />
        <TabBtn label="Categories"   active={tab === 'categories'} onClick={() => setTab('categories')} />
        <TabBtn label="Workbooks"    active={tab === 'books'}      onClick={() => setTab('books')} />
      </div>

      {tab === 'month' && (
        /* Keyed on the month alone. Adding `reload` here would remount the
           view — and the entry form inside it — on every save, throwing
           away the date and heading the form promises to keep. The view
           refetches itself; it does not need replacing. */
        <MonthView key={`${year}-${month}`} year={year} month={month}
          categories={categories} onError={setError} onOpenCategory={openHeading}
          adding={adding} setAdding={setAdding} onChanged={changed} />
      )}
      {tab === 'year' && (
        <YearView key={`${year}-${reload}`} year={year} onYear={setYear}
          onError={setError} onOpenCategory={openHeading} />
      )}
      {tab === 'categories' && (
        <CategoriesView onError={setError} onChanged={changed} onOpenCategory={openHeading} />
      )}
      {tab === 'books' && (
        <BooksView onError={setError} onImported={changed} onOpenMonth={openMonth} />
      )}

      {openCategory && (
        <CategoryDetail
          id={openCategory}
          year={detailYear}
          onYear={setDetailYear}
          categories={categories}
          onClose={() => setOpenCategory(null)}
          onChanged={changed}
          onError={setError}
        />
      )}
    </div>
  )
}
