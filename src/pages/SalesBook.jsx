import { Fragment, useState, useEffect, useCallback, useRef } from 'react'
import { apiFetch } from '../lib/api'
import { Card, CardTitle, Btn, EmptyState, Spinner, RowMenu } from '../components/ui'
import { useConfirm } from '../lib/ConfirmContext'
import { notify } from '../lib/notify'

/* ══════════════════════════════════════════════════════════════
   THE SALES BOOK

   The farm's sales day book — "2026 SEPTEMBER SDB.xlsx" — read in from
   the workbook, for as long as the sales people keep it on paper rather
   than in the app.

   Three ways through it, laid out the way the workbook already is:

     The year      a unit per row, a month per column (MONTHLY SALES BY UNITY)
     The month     a day per row, a unit per column ("<MONTH> SALES BY UNITY")
     Units         each shop, sales person and bulk buyer on its own —
                   open one for its sales month by month, and a month
                   for the days behind it
     Workbooks     uploading the file, and what each upload brought in

   Litres come from the day books ("01-SEPTEMBER-2026"), which list what
   each unit took out pack by pack. Only the days that have a day book
   have litres; a day without one is not a day of zero litres, and is
   shown as a dash rather than a nought.

   The till's own takings are shown beside the book wherever there are
   any, and never added to it: the day the sales people start ringing
   sales up is a day that could otherwise be counted twice.
══════════════════════════════════════════════════════════════ */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

const KINDS = [
  ['shop',   'Shops'],
  ['seller', 'Sales people'],
  ['bulk',   'Bulk buyers & outlets'],
]

const fmt    = (n) => Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })
const fmtTsh = (n) => `TSh ${fmt(n)}`
const num    = (v) => Number(v) || 0
const fmt1   = (n) => Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 1 })
const fmtL   = (n) => `${Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} L`

/** Big money, short, for cells the eye scans across. */
function brief(n) {
  const v = num(n)
  if (!v) return '—'
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(Math.abs(v) >= 1e7 ? 1 : 2)}M`
  if (Math.abs(v) >= 1e3) return `${Math.round(v / 1e3)}k`
  return fmt(v)
}

const TH = ({ children, right, onClick, title, sticky }) => (
  <th onClick={onClick} title={title}
    className={`px-3 py-3 text-[11px] font-semibold tracking-wider uppercase border-b ${right ? 'text-right' : 'text-left'}`}
    style={{
      color: 'var(--ink-60)', borderColor: 'var(--ink-10)', whiteSpace: 'nowrap',
      cursor: onClick ? 'pointer' : 'default', background: 'var(--surface)',
      ...(sticky ? { position: 'sticky', left: 0, zIndex: 1 } : {}),
    }}>{children}</th>
)
const TD = ({ children, right, mono, style = {}, colSpan, sticky, title }) => (
  <td colSpan={colSpan} title={title} className={`px-3 py-2 border-b text-[13px] ${right ? 'text-right' : ''}`}
    style={{
      borderColor: 'var(--ink-10)', color: 'var(--ink)', whiteSpace: 'nowrap',
      fontFamily: mono ? "'DM Mono', monospace" : 'inherit', fontSize: mono ? 12 : 13,
      ...(sticky ? { position: 'sticky', left: 0, background: 'var(--surface)', zIndex: 1 } : {}),
      ...style,
    }}>{children}</td>
)

function SubTab({ label, active, onClick }) {
  return (
    <button onClick={onClick} className="px-3 py-1.5 text-[13px] font-medium rounded-md border-0 cursor-pointer"
      style={{
        background: active ? 'var(--green-100)' : 'transparent',
        color: active ? 'var(--green-800)' : 'var(--ink-60)',
      }}>{label}</button>
  )
}

function Tile({ label, value, note, color = 'var(--ink)' }) {
  return (
    <div className="rounded-lg border" style={{ background: 'var(--surface)', borderColor: 'var(--ink-10)', padding: '16px 20px' }}>
      <div className="text-[11px] uppercase tracking-wider font-medium mb-1" style={{ color: 'var(--ink-60)' }}>{label}</div>
      <div className="text-[20px] font-semibold" style={{ color }}>{value}</div>
      {note && <div className="text-[11px] mt-0.5" style={{ color: 'var(--ink-30)' }}>{note}</div>}
    </div>
  )
}

function Notice({ kind = 'error', children, onClose }) {
  const tone = kind === 'error'
    ? { bg: 'rgba(217,64,64,0.08)', border: 'var(--red)',   fg: 'var(--red)' }
    : { bg: 'rgba(232,160,32,0.10)', border: 'var(--amber)', fg: 'var(--amber)' }
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

/** A unit's name that opens it. */
function UnitLink({ unit, onOpen, strong }) {
  return (
    <button onClick={() => onOpen(unit)}
      className="border-0 bg-transparent cursor-pointer text-[13px] text-left p-0"
      style={{ color: 'var(--green-600)', fontWeight: strong ? 600 : 500, font: 'inherit' }}>
      {unit}
    </button>
  )
}

/** The units, grouped under their kind, in the order the server sent them. */
const grouped = (units) =>
  KINDS.map(([kind, label]) => ({ kind, label, units: units.filter(u => u.kind === kind) }))
    .filter(g => g.units.length)

/* ── the year ────────────────────────────────────────────── */

function YearView({ year, onOpenMonth, onOpenUnit, reload }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    setData(null)
    apiFetch(`/sales-book/year?year=${year}`).then(setData).catch(e => notify.error(e.message))
  }, [year, reload])

  if (!data) return <div className="p-8 text-center text-sm" style={{ color: 'var(--ink-30)' }}>Loading…</div>

  if (!data.units.length) {
    return (
      <Card>
        <EmptyState>
          Nothing from the sales book for {year} yet. Upload the workbook under <strong>Workbooks</strong>.
        </EmptyState>
      </Card>
    )
  }

  const covered = data.months.map((m, i) => (m ? i : null)).filter(i => i !== null)
  const lastMonth = covered[covered.length - 1]
  const best = Math.max(...data.months)
  const bestIdx = data.months.indexOf(best)
  const hasTill = data.till.some(Boolean)
  const shown = MONTHS.map((_, i) => i).filter(i => i <= (lastMonth ?? -1) || data.till[i])
  /* The month still being written would drag the average down. */
  const now = new Date()
  const open = year === now.getFullYear() ? now.getMonth() : null
  const closed = covered.filter(i => i !== open)
  const avg = closed.length ? closed.reduce((a, i) => a + data.months[i], 0) / closed.length : null

  return (
    <>
      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
        <Tile label={`${year} so far`} value={fmtTsh(data.total)} color="var(--green-600)"
          note={`${covered.length} month${covered.length === 1 ? '' : 's'} in the book`} />
        <Tile label="Best month" value={fmtTsh(best)} note={MONTHS[bestIdx]} />
        {avg !== null && (
          <Tile label="Monthly average" value={fmtTsh(avg)}
            note={closed.length < covered.length ? `Leaving out ${MONTHS[open]}, still open` : undefined} />
        )}
        <Tile label={`Latest — ${MONTHS[lastMonth]}`} value={fmtTsh(data.months[lastMonth])}
          note={data.detail[lastMonth] === 'day' ? 'Open it for the days' : 'Month total only'} />
      </div>

      <Card noPad>
        <div className="px-5 pt-5 pb-2 text-sm font-semibold" style={{ color: 'var(--ink)' }}>
          Sales by unit, month by month
        </div>
        <p className="px-5 pb-3 text-xs" style={{ color: 'var(--ink-60)' }}>
          Click a month to see it day by day. Months marked <span style={{ color: 'var(--amber)' }}>◦</span> came
          from the workbook's year summary, so there is one figure per unit and no days behind it.
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <TH sticky>Unit</TH>
                {shown.map(i => (
                  <TH key={i} right onClick={data.months[i] ? () => onOpenMonth(year, i + 1) : undefined}
                    title={data.detail[i] === 'month' ? 'Month total from the year summary' : undefined}>
                    {MONTHS[i].slice(0, 3)}
                    {data.detail[i] === 'month' && <span style={{ color: 'var(--amber)' }}> ◦</span>}
                  </TH>
                ))}
                <TH right>Total</TH>
              </tr>
            </thead>
            <tbody>
              {grouped(data.units).map(g => {
                const sub = shown.map(i => g.units.reduce((a, u) => a + u.by_month[i], 0))
                return (
                  <Fragment key={g.kind}>
                    <tr>
                      <TD sticky colSpan={1} style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-60)', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--cream-dark)' }}>
                        {g.label}
                      </TD>
                      {sub.map((v, j) => (
                        <TD key={j} right mono style={{ background: 'var(--cream-dark)', color: 'var(--ink-60)', fontWeight: 600 }}>{brief(v)}</TD>
                      ))}
                      <TD right mono style={{ background: 'var(--cream-dark)', color: 'var(--ink-60)', fontWeight: 600 }}>
                        {brief(g.units.reduce((a, u) => a + u.total, 0))}
                      </TD>
                    </tr>
                    {g.units.map(u => (
                      <tr key={u.unit}>
                        <TD sticky><UnitLink unit={u.unit} onOpen={onOpenUnit} /></TD>
                        {shown.map(i => (
                          <TD key={i} right mono title={u.by_month[i] ? fmtTsh(u.by_month[i]) : undefined}
                            style={{ color: u.by_month[i] ? 'var(--ink)' : 'var(--ink-30)' }}>
                            {brief(u.by_month[i])}
                          </TD>
                        ))}
                        <TD right mono style={{ fontWeight: 600 }}>{brief(u.total)}</TD>
                      </tr>
                    ))}
                  </Fragment>
                )
              })}
              <tr>
                <TD sticky style={{ fontWeight: 700 }}>Total</TD>
                {shown.map(i => (
                  <TD key={i} right mono title={fmtTsh(data.months[i])} style={{
                    fontWeight: 700, color: data.months[i] && i === bestIdx ? 'var(--green-600)' : 'var(--ink)',
                  }}>{brief(data.months[i])}</TD>
                ))}
                <TD right mono style={{ fontWeight: 700 }}>{brief(data.total)}</TD>
              </tr>
              {data.litres?.some(Boolean) && (
                <tr>
                  <TD sticky style={{ color: 'var(--ink-60)' }} title="Only days with a day book have litres">Litres (day books)</TD>
                  {shown.map(i => (
                    <TD key={i} right mono style={{ color: data.litres[i] ? 'var(--ink-60)' : 'var(--ink-30)' }}>
                      {data.litres[i] ? fmt(data.litres[i]) : '—'}
                    </TD>
                  ))}
                  <TD right mono style={{ color: 'var(--ink-60)' }}>{fmt(data.litres.reduce((a, b) => a + b, 0))}</TD>
                </tr>
              )}
              {hasTill && (
                <tr>
                  <TD sticky style={{ color: 'var(--blue)' }}>Till (in the app)</TD>
                  {shown.map(i => (
                    <TD key={i} right mono style={{ color: data.till[i] ? 'var(--blue)' : 'var(--ink-30)' }}>
                      {brief(data.till[i])}
                    </TD>
                  ))}
                  <TD right mono style={{ color: 'var(--blue)' }}>{brief(data.till.reduce((a, b) => a + b, 0))}</TD>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 text-[11px]" style={{ color: 'var(--ink-30)', borderTop: '1px solid var(--ink-10)' }}>
          Figures are shortened; hover a cell for the full amount.
          {hasTill && ' The till row is what was rung up in the app. It is not included in the totals above.'}
        </div>
      </Card>
    </>
  )
}

/* ── the month ───────────────────────────────────────────── */

function MonthView({ year, month, onChange, onOpenUnit, onOpenDay, reload }) {
  const [data, setData] = useState(null)
  const [measure, setMeasure] = useState('tsh')

  useEffect(() => {
    setData(null)
    apiFetch(`/sales-book/month?year=${year}&month=${month}`).then(setData).catch(e => notify.error(e.message))
  }, [year, month, reload])

  const step = (d) => {
    let m = month + d, y = year
    if (m < 1) { m = 12; y-- }
    if (m > 12) { m = 1; y++ }
    onChange(y, m)
  }

  const picker = (
    <div className="flex items-center gap-2 mb-4">
      <Btn size="sm" onClick={() => step(-1)}>‹</Btn>
      <select value={month} onChange={e => onChange(year, Number(e.target.value))}>
        {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
      </select>
      <input type="number" value={year} style={{ width: 90 }}
        onChange={e => { const y = parseInt(e.target.value, 10); if (y > 1999 && y < 2100) onChange(y, month) }} />
      <Btn size="sm" onClick={() => step(1)}>›</Btn>
    </div>
  )

  if (!data) return <>{picker}<div className="p-8 text-center text-sm" style={{ color: 'var(--ink-30)' }}>Loading…</div></>

  const hasTill = data.till_total > 0

  if (!data.units.length) {
    return (
      <>
        {picker}
        <Card><EmptyState>
          The sales book has nothing for {MONTHS[month - 1]} {year}.
          {hasTill && ` The till rang up ${fmtTsh(data.till_total)} this month — see Till receipts.`}
        </EmptyState></Card>
      </>
    )
  }

  const days = data.days
  const best = days.reduce((a, d) => (d.total > (a?.total || 0) ? d : a), null)
  const lit = data.litres || { units: [], days: [], total: 0 }
  const hasLitres = lit.total > 0
  const inLitres = measure === 'litres' && hasLitres

  /* The grid, in whichever measure is chosen. Litres run over the days
     that have a day book; a day with money but no day book shows a dash. */
  const cols = inLitres ? lit.units : data.units
  const litresByDay = Object.fromEntries(lit.days.map(d => [d.day, d]))
  const rowsOf = inLitres
    ? [...new Set([...days.map(d => d.day), ...lit.days.map(d => d.day)])].sort()
        .map(day => litresByDay[day] || { day, by_unit: {}, total: null })
    : days
  const cell = (v) => (inLitres ? fmt1(v) : fmt(v))

  return (
    <>
      {picker}
      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
        <Tile label={data.label} value={fmtTsh(data.total)} color="var(--green-600)"
          note={data.whole_month ? 'Month total only' : `${days.length} day${days.length === 1 ? '' : 's'} recorded`} />
        {!data.whole_month && <Tile label="Per day" value={fmtTsh(days.length ? data.total / days.length : 0)} note="Average over the days recorded" />}
        {best && <Tile label="Best day" value={fmtTsh(best.total)} note={best.day} />}
        {hasLitres && <Tile label="Litres sold" value={fmtL(lit.total)} color="var(--blue)"
          note={`over ${lit.days.length} day${lit.days.length === 1 ? '' : 's'} with a day book`} />}
        {hasTill && <Tile label="Till (in the app)" value={fmtTsh(data.till_total)} color="var(--blue)" note="Not included above" />}
      </div>

      {data.whole_month ? (
        <Card noPad>
          <div className="px-5 pt-5 pb-2 text-sm font-semibold" style={{ color: 'var(--ink)' }}>By unit</div>
          <p className="px-5 pb-3 text-xs" style={{ color: 'var(--ink-60)' }}>
            This month came from the workbook's year summary, which keeps one figure per unit — there
            are no days behind it.
          </p>
          <table className="w-full border-collapse text-[13px]">
            <thead><tr><TH>Unit</TH><TH>Kind</TH><TH right>Sales</TH></tr></thead>
            <tbody>
              {data.units.map(u => (
                <tr key={u.unit}>
                  <TD><UnitLink unit={u.unit} onOpen={onOpenUnit} /></TD>
                  <TD style={{ color: 'var(--ink-60)' }}>{KINDS.find(k => k[0] === u.kind)?.[1]}</TD>
                  <TD right mono style={{ fontWeight: 600 }}>{fmt(u.total)}</TD>
                </tr>
              ))}
              <tr><TD style={{ fontWeight: 700 }}>Total</TD><TD /><TD right mono style={{ fontWeight: 700 }}>{fmt(data.total)}</TD></tr>
            </tbody>
          </table>
        </Card>
      ) : (
        <Card noPad>
          <div className="px-5 pt-5 pb-3 flex items-center justify-between flex-wrap gap-2">
            <div className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
              Day by day{inLitres ? ', in litres' : ''}
            </div>
            {hasLitres && (
              <div className="flex gap-1 rounded-md p-0.5" style={{ background: 'var(--cream-dark)' }}>
                <SubTab label="Shillings" active={!inLitres} onClick={() => setMeasure('tsh')} />
                <SubTab label="Litres"    active={inLitres}  onClick={() => setMeasure('litres')} />
              </div>
            )}
          </div>
          <p className="px-5 pb-3 text-xs" style={{ color: 'var(--ink-60)' }}>
            Click a date to see what each unit sold that day, product by product.
            {inLitres && ' Litres are only known for days with a day book; the others show a dash.'}
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  <TH sticky>Date</TH>
                  {cols.map(u => (
                    <TH key={u.unit} right onClick={() => onOpenUnit(u.unit)} title={`Open ${u.unit}`}>
                      <span style={{ color: 'var(--green-600)' }}>{u.unit}</span>
                    </TH>
                  ))}
                  <TH right>Total</TH>
                  {hasTill && !inLitres && <TH right>Till</TH>}
                </tr>
              </thead>
              <tbody>
                {rowsOf.map(d => (
                  <tr key={d.day}>
                    <TD sticky mono>
                      <button onClick={() => onOpenDay(d.day)} title="What each unit sold this day"
                        className="border-0 bg-transparent cursor-pointer p-0"
                        style={{ color: 'var(--green-600)', font: 'inherit' }}>{d.day}</button>
                    </TD>
                    {cols.map(u => (
                      <TD key={u.unit} right mono style={{ color: d.by_unit[u.unit] ? 'var(--ink)' : 'var(--ink-30)' }}>
                        {d.by_unit[u.unit] ? cell(d.by_unit[u.unit]) : '—'}
                      </TD>
                    ))}
                    <TD right mono style={{ fontWeight: 600 }}>{d.total === null ? '—' : cell(d.total)}</TD>
                    {hasTill && !inLitres && (
                      <TD right mono style={{ color: data.till[d.day] ? 'var(--blue)' : 'var(--ink-30)' }}>
                        {data.till[d.day] ? fmt(data.till[d.day]) : '—'}
                      </TD>
                    )}
                  </tr>
                ))}
                <tr>
                  <TD sticky style={{ fontWeight: 700 }}>Total</TD>
                  {cols.map(u => <TD key={u.unit} right mono style={{ fontWeight: 700 }}>{cell(u.total)}</TD>)}
                  <TD right mono style={{ fontWeight: 700, color: 'var(--green-600)' }}>{cell(inLitres ? lit.total : data.total)}</TD>
                  {hasTill && !inLitres && <TD right mono style={{ color: 'var(--blue)' }}>{fmt(data.till_total)}</TD>}
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  )
}

/* ── the units ───────────────────────────────────────────── */

function Modal({ title, sub, onClose, children }) {
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      className="fixed inset-0 z-[100] flex items-start justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(10,30,20,0.45)' }}>
      <div className="rounded-[16px] w-full max-w-4xl p-7 my-6" style={{ background: 'var(--surface)' }}>
        <div className="flex items-start justify-between mb-5 gap-3">
          <div>
            <div className="font-serif text-[20px]" style={{ color: 'var(--ink)' }}>{title}</div>
            {sub && <div className="text-xs mt-0.5" style={{ color: 'var(--ink-60)' }}>{sub}</div>}
          </div>
          <button onClick={onClose} className="border-0 bg-transparent text-[18px] cursor-pointer p-1 leading-none"
            style={{ color: 'var(--ink-30)' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

/* How big a month is against the unit's best — the question a unit is
   opened for is whether it has been climbing, and a bar reads that
   faster than a column of figures. */
function ShareBar({ value, of }) {
  const pct = of > 0 ? Math.min(100, (num(value) / of) * 100) : 0
  return (
    <div className="h-1.5 rounded-full overflow-hidden min-w-[80px]" style={{ background: 'var(--ink-10)' }}>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--green-400)' }} />
    </div>
  )
}

const kindLabel = (kind) => KINDS.find(k => k[0] === kind)?.[1] || ''

/** A day book's lines for one unit: product, pack, how many, at what, litres. */
function Lines({ lines, showSoldBy }) {
  return (
    <table className="w-full border-collapse text-[12px]">
      <thead>
        <tr>
          <TH>Product</TH><TH>Pack</TH><TH right>Units</TH><TH right>Price</TH><TH right>Amount</TH><TH right>Litres</TH>
          {showSoldBy && <TH>Sold from</TH>}
        </tr>
      </thead>
      <tbody>
        {lines.map((l, i) => (
          <tr key={i}>
            <TD>{l.product}</TD>
            <TD style={{ color: 'var(--ink-60)' }}>{l.pack}</TD>
            <TD right mono>{fmt1(l.units)}</TD>
            <TD right mono style={{ color: 'var(--ink-60)' }}>{l.price == null ? '—' : fmt(l.price)}</TD>
            <TD right mono>{fmt(l.amount)}</TD>
            <TD right mono style={{ fontWeight: 600 }}>{fmt1(l.litres)}</TD>
            {showSoldBy && <TD style={{ color: 'var(--ink-60)' }}>{l.sold_by}</TD>}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/**
 * One day, the way its day book is laid out: under each shop, sales
 * person and buyer, what they took out product by product and the
 * litres it came to.
 */
function DayDetail({ date, onClose, onOpenUnit }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    setData(null)
    apiFetch(`/sales-book/day?date=${date}`).then(setData).catch(e => { notify.error(e.message); onClose() })
  }, [date, onClose])

  if (!data) return <Modal title={date} onClose={onClose}><div className="text-sm" style={{ color: 'var(--ink-30)' }}>Loading…</div></Modal>

  const withLines = data.units.filter(u => u.lines.length)
  const without = data.units.filter(u => !u.lines.length && u.amount)

  return (
    <Modal title={new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      sub="What each unit sold this day" onClose={onClose}>
      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
        <Tile label="Sales" value={fmtTsh(data.amount)} color="var(--green-600)" />
        <Tile label="Litres" value={data.has_day_book ? fmtL(data.litres) : '—'} color="var(--blue)"
          note={data.has_day_book ? null : 'No day book for this day'} />
      </div>

      {!data.has_day_book && (
        <p className="text-sm mb-4" style={{ color: 'var(--ink-60)' }}>
          The workbook has no day book for this day, so only what each unit took in shillings is known — not
          what it sold or how many litres.
        </p>
      )}

      {withLines.map(u => (
        <div key={u.unit} className="mb-5">
          <div className="flex items-baseline justify-between gap-3 flex-wrap mb-1">
            <div className="flex items-baseline gap-2">
              <UnitLink unit={u.unit} onOpen={onOpenUnit} strong />
              <span className="text-[11px]" style={{ color: 'var(--ink-30)' }}>{kindLabel(u.kind)}</span>
            </div>
            <div className="text-[13px]">
              <strong style={{ color: 'var(--blue)' }}>{fmtL(u.litres)}</strong>
              <span style={{ color: 'var(--ink-60)' }}> · {fmtTsh(u.amount || u.booked)}</span>
            </div>
          </div>
          {u.amount > 0 && Math.abs(u.amount - u.booked) > 1 && (
            <div className="text-[11px] mb-1" style={{ color: 'var(--amber)' }}>
              The day book's lines add up to {fmtTsh(u.booked)}; the SALES BY UNITY sheet has {fmtTsh(u.amount)} —
              usually bulk sold from here that the sheet puts under the buyer.
            </div>
          )}
          <div style={{ overflowX: 'auto' }}>
            <Lines lines={u.lines} showSoldBy={u.lines.some(l => l.sold_by !== u.unit)} />
          </div>
        </div>
      ))}

      {data.has_day_book && without.length > 0 && (
        <p className="text-xs" style={{ color: 'var(--ink-60)' }}>
          In shillings only, with no lines in the day book: {without.map(u => `${u.unit} (${fmt(u.amount)})`).join(', ')}.
        </p>
      )}
    </Modal>
  )
}

/**
 * One unit's sales, month by month, with the days that made each month.
 *
 * Every month of the year is listed, sold in or not: a sales person who
 * went quiet is a reading, and a table that left the month out would
 * hide it. A month opens in place to show its days.
 */
function UnitDetail({ unit, year, onYear, onClose }) {
  const [data, setData] = useState(null)
  const [open, setOpen] = useState(null)
  const [openDay, setOpenDay] = useState(null)

  useEffect(() => {
    setData(null); setOpen(null)
    apiFetch(`/sales-book/units/${encodeURIComponent(unit)}?year=${year}`)
      .then(setData).catch(e => { notify.error(e.message); onClose() })
  }, [unit, year, onClose])

  if (!data) return <Modal title={unit} onClose={onClose}><div className="text-sm" style={{ color: 'var(--ink-30)' }}>Loading…</div></Modal>

  const best = Math.max(...data.months.map(m => m.total), 0)
  const lastSold = data.months.reduce((a, m) => (m.total ? m.month : a), 0)
  const rows = data.months.filter(m => m.month <= Math.max(lastSold, 1))

  return (
    <Modal title={data.unit} sub={kindLabel(data.kind)} onClose={onClose}>
      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
        {[
          { label: `Sold in ${year}`, value: fmtTsh(data.total), note: `${data.share}% of all sales in the book` },
          { label: 'Month average', value: fmtTsh(data.monthly_average), note: 'over the finished months it sold in' },
          { label: 'Best month', value: data.best_month ? MONTHS[data.best_month - 1] : '—',
            note: data.best_month ? fmtTsh(data.months[data.best_month - 1].total) : null },
          data.days_recorded > 0 && { label: 'Per day', value: fmtTsh(data.daily_average),
            note: `over ${data.days_recorded} days recorded` },
          data.best_day && { label: 'Best day', value: fmtTsh(data.best_day.amount), note: data.best_day.date },
          data.litre_days > 0 && { label: 'Litres sold', value: fmtL(data.litres),
            note: `over ${data.litre_days} day${data.litre_days === 1 ? '' : 's'} with a day book` },
          data.litre_days > 0 && { label: 'Litres per day', value: fmtL(data.litres_per_day), note: 'on the days with a day book' },
        ].filter(Boolean).map(k => (
          <div key={k.label} className="rounded-lg" style={{ background: 'var(--cream-dark)', padding: '10px 14px' }}>
            <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--ink-60)' }}>{k.label}</div>
            <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink)' }}>{k.value}</div>
            {k.note && <div className="text-[10px] mt-0.5" style={{ color: 'var(--ink-30)' }}>{k.note}</div>}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="text-xs" style={{ color: 'var(--ink-60)' }}>
          Click a month to see its days. Months marked <span style={{ color: 'var(--amber)' }}>◦</span> are
          a single figure from the year summary, with no days behind them.
        </div>
        {data.years.length > 1 && (
          <select value={year} onChange={e => onYear(Number(e.target.value))}>
            {data.years.map(y => <option key={y.year} value={y.year}>{y.year}</option>)}
          </select>
        )}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="w-full border-collapse text-[13px]" style={{ minWidth: 560 }}>
          <thead>
            <tr>
              <TH>Month</TH><TH right>Days</TH><TH right>Sales</TH>
              {data.litre_days > 0 && <TH right>Litres</TH>}
              <TH right>Share</TH><TH>Against the best month</TH>
            </tr>
          </thead>
          <tbody>
            {rows.map(m => {
              const canOpen = m.days.length > 0
              return (
                <Fragment key={m.month}>
                  <tr style={{ opacity: m.total ? 1 : 0.45 }}>
                    <td className="px-3 py-2 border-b" style={{ borderColor: 'var(--ink-10)' }}>
                      {canOpen ? (
                        <button onClick={() => setOpen(open === m.month ? null : m.month)}
                          className="border-0 bg-transparent cursor-pointer text-[13px] font-medium text-left p-0"
                          style={{ color: 'var(--green-600)' }}>
                          <span style={{ display: 'inline-block', width: 14 }}>{open === m.month ? '▾' : '▸'}</span>
                          {MONTHS[m.month - 1]}
                        </button>
                      ) : (
                        <span className="text-[13px]" style={{ color: 'var(--ink-60)', paddingLeft: 14 }}>
                          {MONTHS[m.month - 1]}
                          {m.whole_month && <span style={{ color: 'var(--amber)' }}> ◦</span>}
                        </span>
                      )}
                    </td>
                    <TD right mono style={{ color: 'var(--ink-60)' }}>{m.days.length || ''}</TD>
                    <TD right mono style={{ fontWeight: m.total ? 600 : 400 }}>{m.total ? fmt(m.total) : '—'}</TD>
                    {data.litre_days > 0 && (
                      <TD right mono style={{ color: m.litre_days ? 'var(--blue)' : 'var(--ink-30)' }}
                        title={m.litre_days ? `${m.litre_days} day(s) with a day book` : 'No day books this month'}>
                        {m.litre_days ? fmt1(m.litres) : '—'}
                      </TD>
                    )}
                    <TD right mono style={{ color: 'var(--ink-60)' }}>{m.total ? `${m.share}%` : ''}</TD>
                    <TD style={{ minWidth: 150 }}>{m.total ? <ShareBar value={m.total} of={best} /> : null}</TD>
                  </tr>
                  {open === m.month && m.days.map(d => (
                    <Fragment key={d.date}>
                      <tr style={{ background: 'var(--cream-dark)' }}>
                        <TD mono style={{ color: 'var(--ink-60)', paddingLeft: 30, background: 'var(--cream-dark)' }}>
                          {d.lines?.length ? (
                            <button onClick={() => setOpenDay(openDay === d.date ? null : d.date)}
                              className="border-0 bg-transparent cursor-pointer p-0" title="What was sold this day"
                              style={{ color: 'var(--green-600)', font: 'inherit' }}>
                              {openDay === d.date ? '▾ ' : '▸ '}{d.date}
                            </button>
                          ) : d.date}
                        </TD>
                        <TD />
                        <TD right mono style={{ fontWeight: 600 }}>{d.amount ? fmt(d.amount) : '—'}</TD>
                        {data.litre_days > 0 && (
                          <TD right mono style={{ color: d.litres != null ? 'var(--blue)' : 'var(--ink-30)' }}>
                            {d.litres != null ? fmt1(d.litres) : '—'}
                          </TD>
                        )}
                        <TD />
                        <TD><ShareBar value={d.amount} of={Math.max(...m.days.map(x => x.amount))} /></TD>
                      </tr>
                      {openDay === d.date && (
                        <tr>
                          <td colSpan={data.litre_days > 0 ? 6 : 5} className="px-3 py-2 border-b"
                            style={{ borderColor: 'var(--ink-10)', paddingLeft: 30 }}>
                            <Lines lines={d.lines} showSoldBy={d.lines.some(l => l.sold_by !== data.unit)} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </Fragment>
              )
            })}
            <tr>
              <TD style={{ fontWeight: 700 }}>{year}</TD>
              <TD right mono style={{ color: 'var(--ink-60)' }}>{data.days_recorded || ''}</TD>
              <TD right mono style={{ fontWeight: 700 }}>{fmt(data.total)}</TD>
              {data.litre_days > 0 && <TD right mono style={{ fontWeight: 700, color: 'var(--blue)' }}>{fmt1(data.litres)}</TD>}
              <TD right mono style={{ color: 'var(--ink-60)' }}>{data.share}%</TD>
              <TD />
            </tr>
          </tbody>
        </table>
      </div>

      {data.products?.length > 0 && (
        <div className="mt-5">
          <div className="text-sm font-semibold mb-1" style={{ color: 'var(--ink)' }}>What was sold, {year}</div>
          <p className="text-xs mb-2" style={{ color: 'var(--ink-60)' }}>
            From the {data.litre_days} day book{data.litre_days === 1 ? '' : 's'} in the workbook, most litres first.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table className="w-full border-collapse text-[13px]" style={{ minWidth: 480 }}>
              <thead><tr><TH>Product</TH><TH>Pack</TH><TH right>Units</TH><TH right>Litres</TH><TH right>Amount</TH><TH>Share of litres</TH></tr></thead>
              <tbody>
                {data.products.map(p => (
                  <tr key={`${p.product}|${p.pack}`}>
                    <TD>{p.product}</TD>
                    <TD style={{ color: 'var(--ink-60)' }}>{p.pack}</TD>
                    <TD right mono>{fmt1(p.units)}</TD>
                    <TD right mono style={{ fontWeight: 600, color: 'var(--blue)' }}>{fmt1(p.litres)}</TD>
                    <TD right mono>{fmt(p.amount)}</TD>
                    <TD style={{ minWidth: 120 }}><ShareBar value={p.litres} of={data.litres} /></TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data.years.length > 1 && (
        <div className="mt-5">
          <div className="text-sm font-semibold mb-2" style={{ color: 'var(--ink)' }}>Year on year</div>
          <div className="flex flex-wrap gap-2">
            {data.years.map(y => (
              <button key={y.year} onClick={() => onYear(y.year)} className="rounded-lg border cursor-pointer text-left"
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

/** Every unit, grouped the way the farm thinks of them. */
function UnitsView({ year, onOpenUnit, reload }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    setData(null)
    apiFetch(`/sales-book/units?year=${year}`).then(setData).catch(e => notify.error(e.message))
  }, [year, reload])

  if (!data) return <div className="p-8 text-center text-sm" style={{ color: 'var(--ink-30)' }}>Loading…</div>
  if (!data.units.length) {
    return <Card><EmptyState>No units yet — upload the workbook under <strong>Workbooks</strong>.</EmptyState></Card>
  }

  const top = Math.max(...data.units.map(u => u.year_total), 0)

  return (
    <>
      <p className="text-sm mb-4" style={{ color: 'var(--ink-60)' }}>
        Every shop, sales person and bulk buyer in the sales book. Open one for its sales month by
        month, and a month for the days behind it. Litres come from the day books, so they cover
        only the days that have one{data.year_litres ? ` — ${fmtL(data.year_litres)} in ${year} so far` : ''}.
      </p>
      {grouped(data.units).map(g => {
        const sub = g.units.reduce((a, u) => a + u.year_total, 0)
        return (
          <Card noPad key={g.kind}>
            <div className="px-5 pt-4 pb-2 flex items-baseline justify-between gap-3 flex-wrap">
              <div className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{g.label}</div>
              <div className="text-xs" style={{ color: 'var(--ink-60)' }}>
                {fmtTsh(sub)} in {year}
                {data.year_total ? ` · ${Math.round((sub / data.year_total) * 1000) / 10}% of sales` : ''}
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="w-full border-collapse text-[13px]" style={{ minWidth: 640 }}>
                <thead>
                  <tr>
                    <TH>Unit</TH><TH right>{year}</TH><TH right>Share</TH><TH />
                    <TH right>Litres</TH><TH right>Months</TH><TH right>Days</TH><TH>Last day recorded</TH>
                  </tr>
                </thead>
                <tbody>
                  {g.units.map(u => (
                    <tr key={u.unit} style={{ opacity: u.year_total ? 1 : 0.55 }}>
                      <TD><UnitLink unit={u.unit} onOpen={onOpenUnit} strong /></TD>
                      <TD right mono style={{ fontWeight: 600 }}>{u.year_total ? fmt(u.year_total) : '—'}</TD>
                      <TD right mono style={{ color: 'var(--ink-60)' }}>
                        {data.year_total && u.year_total ? `${Math.round((u.year_total / data.year_total) * 1000) / 10}%` : ''}
                      </TD>
                      <TD style={{ minWidth: 120 }}>{u.year_total ? <ShareBar value={u.year_total} of={top} /> : null}</TD>
                      <TD right mono style={{ color: u.year_litres ? 'var(--blue)' : 'var(--ink-30)' }}
                        title={u.litre_days ? `from ${u.litre_days} day book(s)` : 'No day book lines'}>
                        {u.year_litres ? fmt1(u.year_litres) : '—'}
                      </TD>
                      <TD right mono style={{ color: 'var(--ink-60)' }}>{u.months}</TD>
                      <TD right mono style={{ color: 'var(--ink-60)' }}>{u.days || '—'}</TD>
                      <TD mono style={{ color: 'var(--ink-60)' }}>{u.last_day || '—'}</TD>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      })}
    </>
  )
}

/* ── the workbooks ───────────────────────────────────────── */

function ImportResult({ result, onClose, onOpenYear }) {
  return (
    <Card>
      <CardTitle>
        {fmt(result.entries)} lines read in — {fmtTsh(result.total)}
        <span className="flex items-center gap-2">
          <Btn size="sm" variant="primary" onClick={onOpenYear}>See the year</Btn>
          <button onClick={onClose} className="border-0 bg-transparent cursor-pointer text-[16px] leading-none"
            style={{ color: 'var(--ink-30)' }}>✕</button>
        </span>
      </CardTitle>

      {result.books?.length > 0 ? (
        <p className="text-xs mb-3" style={{ color: 'var(--ink-60)' }}>
          <strong style={{ color: 'var(--blue)' }}>{fmtL(result.litres)}</strong> read from {result.books.length} day
          book{result.books.length === 1 ? '' : 's'} ({result.books[0].date}
          {result.books.length > 1 ? ` to ${result.books[result.books.length - 1].date}` : ''}) — the only days with
          litres, product by product.
        </p>
      ) : (
        <p className="text-xs mb-3" style={{ color: 'var(--ink-60)' }}>
          No day books were in this workbook, so no litres were read — only shillings.
        </p>
      )}

      {result.replaced_months?.length > 0 && (
        <p className="text-xs mb-3" style={{ color: 'var(--ink-60)' }}>
          {result.replaced_months.length} month{result.replaced_months.length === 1 ? ' was' : 's were'} already
          in the book from an earlier upload and {result.replaced_months.length === 1 ? 'has' : 'have'} been
          replaced by this one, so nothing is counted twice.
        </p>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table className="w-full border-collapse text-[13px] mb-4" style={{ minWidth: 480 }}>
          <thead><tr><TH>Month</TH><TH>Detail</TH><TH right>Lines</TH><TH right>Sales</TH></tr></thead>
          <tbody>
            {result.months.map(m => (
              <tr key={m.month}>
                <TD style={{ fontWeight: 600 }}>{m.label}</TD>
                <TD style={{ color: 'var(--ink-60)' }}>
                  {m.kept_earlier_detail ? 'Kept the days already uploaded'
                    : m.detail === 'day' ? 'Day by day' : 'Month total (year summary)'}
                </TD>
                <TD right mono style={{ color: 'var(--ink-60)' }}>{fmt(m.count)}</TD>
                <TD right mono style={{ fontWeight: 600 }}>{fmt(m.total)}</TD>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {result.warnings?.length > 0 && (
        <div className="mb-4">
          <div className="text-sm font-semibold mb-1" style={{ color: 'var(--amber)' }}>Worth a look</div>
          <p className="text-xs mb-2" style={{ color: 'var(--ink-60)' }}>
            Where the workbook disagrees with itself, the day-by-day figures were imported — they are
            the record. These are usually a TOTAL or summary formula pointing at the wrong cell.
          </p>
          <ul className="text-[12px] pl-5 list-disc" style={{ color: 'var(--ink-60)' }}>
            {result.warnings.map((w, i) => <li key={i} className="mb-1">{w}</li>)}
          </ul>
        </div>
      )}

      {result.skipped?.length > 0 && (
        <details>
          <summary className="text-sm font-semibold cursor-pointer" style={{ color: 'var(--ink)' }}>
            Sheets left out ({result.skipped.length})
          </summary>
          <ul className="text-[12px] pl-5 list-disc mt-2" style={{ color: 'var(--ink-60)' }}>
            {result.skipped.map((s, i) => <li key={i} className="mb-1"><strong>{s.sheet}</strong> — {s.why}</li>)}
          </ul>
        </details>
      )}
    </Card>
  )
}

function BooksView({ onImported, onOpenYear }) {
  const confirm = useConfirm()
  const [imports, setImports] = useState(null)
  const [result, setResult] = useState(null)
  const [issues, setIssues] = useState([])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef()

  const load = useCallback(async () => {
    try { setImports(await apiFetch('/sales-book/imports')) }
    catch (e) { notify.error(e.message) }
  }, [])

  useEffect(() => { load() }, [load])

  const upload = async (file) => {
    setUploading(true); setIssues([]); setResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const data = await apiFetch('/sales-book/import', { method: 'POST', body: fd })
      setResult(data)
      notify.success(`${fmt(data.entries)} lines read in from ${file.name}.`)
      load(); onImported()
    } catch (e) {
      /* A 422 carries the reasons the file could not be read, which are
         the only thing that will get it imported on the next try. */
      if (e.body?.issues?.length) setIssues(e.body.issues)
      notify.error(e.message)
    } finally { setUploading(false) }
  }

  const remove = async (imp) => {
    const ok = await confirm({
      title: `Remove ${imp.filename}`,
      message: `The ${fmt(imp.entry_count)} lines still held from this upload (${imp.covers}) go with it.`,
      detail: 'The workbook can be uploaded again at any time.',
      confirmLabel: 'Remove',
    })
    if (!ok) return
    try { await apiFetch(`/sales-book/imports/${imp.id}`, { method: 'DELETE' }); load(); onImported() }
    catch (e) { notify.error(e.message) }
  }

  return (
    <>
      <Card>
        <CardTitle>Upload the sales workbook</CardTitle>
        <p className="text-sm mb-3" style={{ color: 'var(--ink-60)' }}>
          The sales day book as it is kept — no template to fill in. Every <strong>SALES BY UNITY</strong> sheet
          is read day by day, one column per shop, sales person and bulk buyer. Months before the daily sheets
          start are taken from <strong>MONTHLY SALES BY UNITY</strong> as one figure per unit.
        </p>
        <p className="text-xs mb-4" style={{ color: 'var(--ink-30)' }}>
          The workbook grows through the year, so upload the latest copy whenever it changes: each month in it
          replaces what was held for that month before. The day books, cash sheets and MR / MRS BUSH are left out —
          they are the same money counted another way. Every sheet skipped is listed after an upload.
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

      {result && <ImportResult result={result} onClose={() => setResult(null)} onOpenYear={onOpenYear} />}

      <Card noPad>
        <div className="px-5 pt-5 pb-3 text-sm font-semibold" style={{ color: 'var(--ink)' }}>Uploads</div>
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full border-collapse text-[13px]" style={{ minWidth: 640 }}>
            <thead>
              <tr><TH>File</TH><TH>Months held</TH><TH right>Lines</TH><TH right>Sales</TH><TH>Uploaded</TH><TH /></tr>
            </thead>
            <tbody>
              {imports && imports.length === 0 && (
                <tr><td colSpan={6}><EmptyState>No sales workbook has been uploaded yet.</EmptyState></td></tr>
              )}
              {(imports || []).map(i => (
                <tr key={i.id}>
                  <TD style={{ fontWeight: 600 }}>{i.filename}</TD>
                  <TD style={{ color: 'var(--ink-60)' }}>{i.covers || '—'}</TD>
                  <TD right mono style={{ color: 'var(--ink-60)' }}>{fmt(i.entry_count)}</TD>
                  <TD right mono style={{ fontWeight: 600 }}>{fmt(i.total)}</TD>
                  <TD mono style={{ color: 'var(--ink-60)' }}>
                    {String(i.uploaded_at).slice(0, 10)}
                    {i.uploaded_by && <span style={{ color: 'var(--ink-30)' }}> · {i.uploaded_by}</span>}
                  </TD>
                  <TD right>
                    <RowMenu items={[{ label: 'Remove this upload', danger: true, onClick: () => remove(i) }]} />
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

/* ── the tab ─────────────────────────────────────────────── */

export default function SalesBook() {
  const now = new Date()
  const [view,  setView]  = useState('year')
  const [years, setYears] = useState([])
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [reload, setReload] = useState(0)
  /* The unit being read, and the year it is read for. Kept here so a
     unit opens the same way from the year grid, the month and the list. */
  const [openUnit, setOpenUnit] = useState(null)
  const [unitYear, setUnitYear] = useState(year)
  const openUnitFor = (u) => { setUnitYear(year); setOpenUnit(u) }
  const closeUnit = useCallback(() => setOpenUnit(null), [])
  const [openDay, setOpenDay] = useState(null)
  const closeDay = useCallback(() => setOpenDay(null), [])

  useEffect(() => {
    apiFetch('/sales-book/years').then(ys => {
      setYears(ys)
      /* Nothing yet for this year — open on the latest one that has figures. */
      if (ys.length && !ys.includes(now.getFullYear())) setYear(ys[0])
      /* A first visit with an empty book goes straight to the upload. */
      if (!ys.length && reload === 0) setView('books')
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload])

  const openMonth = (y, m) => { setYear(y); setMonth(m); setView('month') }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex gap-1">
          <SubTab label="The year"  active={view === 'year'}  onClick={() => setView('year')} />
          <SubTab label="The month" active={view === 'month'} onClick={() => setView('month')} />
          <SubTab label="Units"     active={view === 'units'} onClick={() => setView('units')} />
          <SubTab label="Workbooks" active={view === 'books'} onClick={() => setView('books')} />
        </div>
        {(view === 'year' || view === 'units') && years.length > 1 && (
          <select value={year} onChange={e => setYear(Number(e.target.value))}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
      </div>

      {view === 'year'  && <YearView year={year} onOpenMonth={openMonth} onOpenUnit={openUnitFor} reload={reload} />}
      {view === 'units' && <UnitsView year={year} onOpenUnit={openUnitFor} reload={reload} />}
      {view === 'month' && <MonthView year={year} month={month} reload={reload} onOpenUnit={openUnitFor} onOpenDay={setOpenDay}
        onChange={(y, m) => { setYear(y); setMonth(m) }} />}
      {openDay && <DayDetail date={openDay} onClose={closeDay} onOpenUnit={u => { setOpenDay(null); openUnitFor(u) }} />}
      {openUnit && <UnitDetail unit={openUnit} year={unitYear} onYear={setUnitYear} onClose={closeUnit} />}
      {view === 'books' && <BooksView onImported={() => setReload(n => n + 1)} onOpenYear={() => setView('year')} />}
    </div>
  )
}
