import { Fragment, useState, useEffect, useCallback, useRef } from 'react'
import { apiFetch } from '../lib/api'
import { Card, CardTitle, Btn, EmptyState, Spinner, RowMenu } from '../components/ui'
import { useConfirm } from '../lib/ConfirmContext'
import { notify } from '../lib/notify'

/* ══════════════════════════════════════════════════════════════
   LITRES AND UNITS SOLD

   The farm's UNIT SOLD workbook, read in: every day of the year, the
   litres of fresh milk that went to each outlet, and the litres and
   packs of each processed product sold.

     The month   a day per row — litres to each outlet, litres of each
                 product — and what every pack came to over the month.
                 A date opens that day, pack by pack.
     The year    a row per outlet and per pack, a column per month, in
                 litres or in units, the way the MONTHLY sheet is kept.

   The workbook says where fresh milk went, but processed milk only as
   the farm's total for the day; it is nobody's sales in particular, and
   the page never pretends otherwise. Outlets that are also in the sales
   book open there, where their litres sit beside their takings.
══════════════════════════════════════════════════════════════ */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

const num  = (v) => Number(v) || 0
const fmt  = (n, dec = 1) => Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: dec })
const fmtL = (n) => `${fmt(n)} L`

const TH = ({ children, right, sticky, title }) => (
  <th title={title} className={`px-3 py-3 text-[11px] font-semibold tracking-wider uppercase border-b ${right ? 'text-right' : 'text-left'}`}
    style={{
      color: 'var(--ink-60)', borderColor: 'var(--ink-10)', whiteSpace: 'nowrap', background: 'var(--surface)',
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
const GROUP = { background: 'var(--cream-dark)', color: 'var(--ink-60)', fontWeight: 600 }

function SubTab({ label, active, onClick }) {
  return (
    <button onClick={onClick} className="px-3 py-1.5 text-[13px] font-medium rounded-md border-0 cursor-pointer"
      style={{ background: active ? 'var(--green-100)' : 'transparent', color: active ? 'var(--green-800)' : 'var(--ink-60)' }}>
      {label}
    </button>
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

function Modal({ title, sub, onClose, children }) {
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      className="fixed inset-0 z-[100] flex items-start justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(10,30,20,0.45)' }}>
      <div className="rounded-[16px] w-full max-w-3xl p-7 my-6" style={{ background: 'var(--surface)' }}>
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

/** An outlet's name — a link into the sales book when it is one of its units. */
function Outlet({ o, onOpenUnit }) {
  if (!o.unit || !onOpenUnit) return <>{o.item}</>
  return (
    <button onClick={() => onOpenUnit(o.unit)} title={`Open ${o.unit} in the sales book`}
      className="border-0 bg-transparent cursor-pointer p-0 text-left"
      style={{ color: 'var(--green-600)', font: 'inherit' }}>{o.item}</button>
  )
}

/* ── one day ─────────────────────────────────────────────── */

function DayDetail({ date, onClose, onOpenUnit }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    apiFetch(`/units-sold/day?date=${date}`).then(setData).catch(e => { notify.error(e.message); onClose() })
  }, [date, onClose])

  const title = new Date(`${date}T00:00:00`).toLocaleDateString(undefined,
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  if (!data) return <Modal title={title} onClose={onClose}><div className="text-sm" style={{ color: 'var(--ink-30)' }}>Loading…</div></Modal>

  return (
    <Modal title={title} sub="Litres and units sold this day" onClose={onClose}>
      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
        <Tile label="All milk" value={fmtL(data.total)} color="var(--blue)" />
        <Tile label="Fresh" value={fmtL(data.fresh_total)} />
        <Tile label="Processed" value={fmtL(data.processed_total)} />
      </div>

      {data.total === 0 && <EmptyState>Nothing is written down for this day in the UNIT SOLD workbook.</EmptyState>}

      {data.fresh.length > 0 && (
        <div className="mb-5">
          <div className="text-sm font-semibold mb-2" style={{ color: 'var(--ink)' }}>Fresh milk, by outlet</div>
          <table className="w-full border-collapse text-[13px]">
            <thead><tr><TH>Outlet</TH><TH right>Litres</TH></tr></thead>
            <tbody>
              {data.fresh.map(o => (
                <tr key={o.item}>
                  <TD><Outlet o={o} onOpenUnit={onOpenUnit} /></TD>
                  <TD right mono style={{ fontWeight: 600 }}>{fmt(o.litres)}</TD>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.processed.length > 0 && (
        <div>
          <div className="text-sm font-semibold mb-2" style={{ color: 'var(--ink)' }}>Processed milk, by pack</div>
          <table className="w-full border-collapse text-[13px]">
            <thead><tr><TH>Product</TH><TH>Pack</TH><TH right>Units</TH><TH right>Litres</TH></tr></thead>
            <tbody>
              {data.processed.map((p, i) => (
                <tr key={i}>
                  <TD>{p.item}</TD>
                  <TD style={{ color: 'var(--ink-60)' }}>{p.pack}</TD>
                  <TD right mono>{p.units == null ? '—' : fmt(p.units)}</TD>
                  <TD right mono style={{ fontWeight: 600 }}>{fmt(p.litres)}</TD>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}

/* ── the month ───────────────────────────────────────────── */

function MonthView({ year, month, onChange, onOpenDay, onOpenUnit, reload }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    setData(null)
    apiFetch(`/units-sold/month?year=${year}&month=${month}`).then(setData).catch(e => notify.error(e.message))
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
  if (!data.days.length) {
    return <>{picker}<Card><EmptyState>Nothing in the UNIT SOLD workbook for {MONTHS[month - 1]} {year}.</EmptyState></Card></>
  }

  const best = data.days.reduce((a, d) => (d.total > (a?.total || 0) ? d : a), null)

  return (
    <>
      {picker}
      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <Tile label={`${data.label} — all milk`} value={fmtL(data.total)} color="var(--blue)"
          note={`${data.days.length} day${data.days.length === 1 ? '' : 's'} written down`} />
        <Tile label="Fresh milk" value={fmtL(data.fresh)} />
        <Tile label="Processed" value={fmtL(data.processed)} />
        <Tile label="Per day" value={fmtL(data.total / data.days.length)} note="Average over the days written down" />
        {best && <Tile label="Best day" value={fmtL(best.total)} note={best.day} />}
      </div>

      <Card noPad>
        <div className="px-5 pt-5 pb-1 text-sm font-semibold" style={{ color: 'var(--ink)' }}>Litres, day by day</div>
        <p className="px-5 pb-3 text-xs" style={{ color: 'var(--ink-60)' }}>
          Fresh milk by outlet, then processed milk by product. Click a date to see that day pack by pack.
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <TH sticky>Date</TH>
                {data.outlets.map(o => <TH key={o.item} right>{o.item}</TH>)}
                <TH right>Fresh</TH>
                {data.products.map(p => <TH key={p.item} right>{p.item}</TH>)}
                <TH right>Processed</TH>
                <TH right>All milk</TH>
              </tr>
            </thead>
            <tbody>
              {data.days.map(d => (
                <tr key={d.day}>
                  <TD sticky mono>
                    <button onClick={() => onOpenDay(d.day)} className="border-0 bg-transparent cursor-pointer p-0"
                      style={{ color: 'var(--green-600)', font: 'inherit' }}>{d.day}</button>
                  </TD>
                  {data.outlets.map(o => (
                    <TD key={o.item} right mono style={{ color: d.fresh[o.item] ? 'var(--ink)' : 'var(--ink-30)' }}>
                      {d.fresh[o.item] ? fmt(d.fresh[o.item]) : '—'}
                    </TD>
                  ))}
                  <TD right mono style={GROUP}>{fmt(d.fresh_total)}</TD>
                  {data.products.map(p => (
                    <TD key={p.item} right mono style={{ color: d.processed[p.item] ? 'var(--ink)' : 'var(--ink-30)' }}>
                      {d.processed[p.item] ? fmt(d.processed[p.item]) : '—'}
                    </TD>
                  ))}
                  <TD right mono style={GROUP}>{fmt(d.processed_total)}</TD>
                  <TD right mono style={{ fontWeight: 700, color: 'var(--blue)' }}>{fmt(d.total)}</TD>
                </tr>
              ))}
              <tr>
                <TD sticky style={{ fontWeight: 700 }}>Total</TD>
                {data.outlets.map(o => (
                  <TD key={o.item} right mono style={{ fontWeight: 700 }}><Outlet o={{ ...o, item: fmt(o.litres) }} onOpenUnit={onOpenUnit} /></TD>
                ))}
                <TD right mono style={{ ...GROUP, fontWeight: 700 }}>{fmt(data.fresh)}</TD>
                {data.products.map(p => <TD key={p.item} right mono style={{ fontWeight: 700 }}>{fmt(p.litres)}</TD>)}
                <TD right mono style={{ ...GROUP, fontWeight: 700 }}>{fmt(data.processed)}</TD>
                <TD right mono style={{ fontWeight: 700, color: 'var(--blue)' }}>{fmt(data.total)}</TD>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {data.packs.length > 0 && (
        <Card noPad>
          <div className="px-5 pt-5 pb-1 text-sm font-semibold" style={{ color: 'var(--ink)' }}>Processed milk sold this month, by pack</div>
          <p className="px-5 pb-3 text-xs" style={{ color: 'var(--ink-60)' }}>
            The workbook writes every pack in litres; units are those litres divided by the pack size.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table className="w-full border-collapse text-[13px]" style={{ minWidth: 480 }}>
              <thead><tr><TH>Product</TH><TH>Pack</TH><TH right>Units</TH><TH right>Litres</TH><TH right>Days sold</TH></tr></thead>
              <tbody>
                {data.packs.map((p, i) => (
                  <tr key={i}>
                    <TD>{p.item}</TD>
                    <TD style={{ color: 'var(--ink-60)' }}>{p.pack}</TD>
                    <TD right mono style={{ fontWeight: 600 }}>{p.units == null ? '—' : fmt(p.units)}</TD>
                    <TD right mono>{fmt(p.litres)}</TD>
                    <TD right mono style={{ color: 'var(--ink-60)' }}>{p.days}</TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  )
}

/* ── the year ────────────────────────────────────────────── */

function YearView({ year, onOpenMonth, onOpenUnit, reload }) {
  const [data, setData] = useState(null)
  const [measure, setMeasure] = useState('litres')

  useEffect(() => {
    setData(null)
    apiFetch(`/units-sold/year?year=${year}`).then(setData).catch(e => notify.error(e.message))
  }, [year, reload])

  if (!data) return <div className="p-8 text-center text-sm" style={{ color: 'var(--ink-30)' }}>Loading…</div>
  if (!data.fresh.length && !data.processed.length) {
    return <Card><EmptyState>Nothing in the UNIT SOLD workbook for {year} yet. Upload it under <strong>Workbooks</strong>.</EmptyState></Card>
  }

  const last = data.totals.all.reduce((a, v, i) => (v ? i : a), 0)
  const shown = MONTHS.map((_, i) => i).filter(i => i <= last)
  const units = measure === 'units'
  const cell = (row, i) => (units ? row.units[i] : row.litres[i])
  const total = (row) => (units ? row.total_units : row.total_litres)

  /* Processed rows, grouped under their product as the workbook does. */
  const products = [...new Set(data.processed.map(r => r.item))]

  return (
    <>
      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
        <Tile label={`${year} so far — all milk`} value={fmtL(data.total)} color="var(--blue)" />
        <Tile label="Fresh milk" value={fmtL(data.totals.fresh.reduce((a, b) => a + b, 0))} />
        <Tile label="Processed" value={fmtL(data.totals.processed.reduce((a, b) => a + b, 0))} />
        <Tile label={`Latest — ${MONTHS[last]}`} value={fmtL(data.totals.all[last])} />
      </div>

      <Card noPad>
        <div className="px-5 pt-5 pb-3 flex items-center justify-between flex-wrap gap-2">
          <div className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
            Month by month, in {units ? 'units' : 'litres'}
          </div>
          <div className="flex gap-1 rounded-md p-0.5" style={{ background: 'var(--cream-dark)' }}>
            <SubTab label="Litres" active={!units} onClick={() => setMeasure('litres')} />
            <SubTab label="Units"  active={units}  onClick={() => setMeasure('units')} />
          </div>
        </div>
        <p className="px-5 pb-3 text-xs" style={{ color: 'var(--ink-60)' }}>
          {units
            ? 'Packs sold. Fresh milk is sold loose, so its units are its litres.'
            : 'Click a month to see it day by day.'}
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <TH sticky>Fresh milk, by outlet</TH>
                <TH />
                {shown.map(i => (
                  <th key={i} className="px-3 py-3 text-[11px] font-semibold tracking-wider uppercase border-b text-right"
                    style={{ color: 'var(--green-600)', borderColor: 'var(--ink-10)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    onClick={() => onOpenMonth(year, i + 1)}>{MONTHS[i].slice(0, 3)}</th>
                ))}
                <TH right>Total</TH>
              </tr>
            </thead>
            <tbody>
              {data.fresh.map(r => (
                <tr key={r.item}>
                  <TD sticky><Outlet o={r} onOpenUnit={onOpenUnit} /></TD>
                  <TD />
                  {shown.map(i => (
                    <TD key={i} right mono style={{ color: r.litres[i] ? 'var(--ink)' : 'var(--ink-30)' }}>
                      {r.litres[i] ? fmt(r.litres[i]) : '—'}
                    </TD>
                  ))}
                  <TD right mono style={{ fontWeight: 600 }}>{fmt(r.total_litres)}</TD>
                </tr>
              ))}
              <tr>
                <TD sticky style={{ ...GROUP, fontWeight: 700 }}>Total fresh milk</TD>
                <TD style={GROUP} />
                {shown.map(i => <TD key={i} right mono style={{ ...GROUP, fontWeight: 700 }}>{fmt(data.totals.fresh[i])}</TD>)}
                <TD right mono style={{ ...GROUP, fontWeight: 700 }}>{fmt(data.totals.fresh.reduce((a, b) => a + b, 0))}</TD>
              </tr>

              <tr>
                <TD sticky colSpan={1} style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-60)', textTransform: 'uppercase', letterSpacing: '0.05em', paddingTop: 18 }}>
                  Processed, by pack
                </TD>
                <td colSpan={shown.length + 2} className="border-b" style={{ borderColor: 'var(--ink-10)' }} />
              </tr>
              {products.map(p => (
                <Fragment key={p}>
                  {data.processed.filter(r => r.item === p).map((r, j) => (
                    <tr key={`${r.item}|${r.pack}`}>
                      <TD sticky style={{ fontWeight: 600 }}>{j === 0 ? r.item : ''}</TD>
                      <TD style={{ color: 'var(--ink-60)' }}>{r.pack}</TD>
                      {shown.map(i => (
                        <TD key={i} right mono style={{ color: cell(r, i) ? 'var(--ink)' : 'var(--ink-30)' }}>
                          {cell(r, i) ? fmt(cell(r, i)) : '—'}
                        </TD>
                      ))}
                      <TD right mono style={{ fontWeight: 600 }}>{total(r) ? fmt(total(r)) : '—'}</TD>
                    </tr>
                  ))}
                </Fragment>
              ))}
              {!units && (
                <tr>
                  <TD sticky style={{ ...GROUP, fontWeight: 700 }}>Total processed</TD>
                  <TD style={GROUP} />
                  {shown.map(i => <TD key={i} right mono style={{ ...GROUP, fontWeight: 700 }}>{fmt(data.totals.processed[i])}</TD>)}
                  <TD right mono style={{ ...GROUP, fontWeight: 700 }}>{fmt(data.totals.processed.reduce((a, b) => a + b, 0))}</TD>
                </tr>
              )}
              <tr>
                <TD sticky style={{ fontWeight: 700, color: 'var(--blue)' }}>All milk sold (litres)</TD>
                <TD />
                {shown.map(i => <TD key={i} right mono style={{ fontWeight: 700, color: 'var(--blue)' }}>{fmt(data.totals.all[i])}</TD>)}
                <TD right mono style={{ fontWeight: 700, color: 'var(--blue)' }}>{fmt(data.total)}</TD>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}

/* ── the tab ─────────────────────────────────────────────── */

export default function UnitsSold({ onOpenUnit, reload }) {
  const now = new Date()
  const [view,  setView]  = useState('month')
  const [years, setYears] = useState([])
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [openDay, setOpenDay] = useState(null)
  const closeDay = useCallback(() => setOpenDay(null), [])
  const started = useRef(false)

  useEffect(() => {
    apiFetch('/units-sold/years').then(ys => {
      setYears(ys)
      if (!started.current && ys.length) {
        started.current = true
        if (!ys.includes(now.getFullYear())) setYear(ys[0])
        /* Open on the last month with figures rather than an empty one. */
        apiFetch(`/units-sold/year?year=${ys.includes(now.getFullYear()) ? now.getFullYear() : ys[0]}`).then(y => {
          const last = y.totals.all.reduce((a, v, i) => (v ? i : a), -1)
          if (last >= 0) setMonth(last + 1)
        }).catch(() => {})
      }
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload])

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex gap-1">
          <SubTab label="The month" active={view === 'month'} onClick={() => setView('month')} />
          <SubTab label="The year"  active={view === 'year'}  onClick={() => setView('year')} />
        </div>
        {view === 'year' && years.length > 1 && (
          <select value={year} onChange={e => setYear(Number(e.target.value))}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
      </div>

      {view === 'month' && <MonthView year={year} month={month} reload={reload} onOpenDay={setOpenDay} onOpenUnit={onOpenUnit}
        onChange={(y, m) => { setYear(y); setMonth(m) }} />}
      {view === 'year' && <YearView year={year} reload={reload} onOpenUnit={onOpenUnit}
        onOpenMonth={(y, m) => { setYear(y); setMonth(m); setView('month') }} />}
      {openDay && <DayDetail date={openDay} onClose={closeDay} onOpenUnit={u => { setOpenDay(null); onOpenUnit(u) }} />}
    </div>
  )
}

/* ── the upload ──────────────────────────────────────────── */

export function UnitsSoldBooks({ onImported }) {
  const confirm = useConfirm()
  const [imports, setImports] = useState(null)
  const [result, setResult] = useState(null)
  const [issues, setIssues] = useState([])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef()

  const load = useCallback(async () => {
    try { setImports(await apiFetch('/units-sold/imports')) } catch (e) { notify.error(e.message) }
  }, [])
  useEffect(() => { load() }, [load])

  const upload = async (file) => {
    setUploading(true); setIssues([]); setResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const data = await apiFetch('/units-sold/import', { method: 'POST', body: fd })
      setResult(data)
      notify.success(`${fmtL(data.litres)} read in from ${file.name}.`)
      load(); onImported()
    } catch (e) {
      if (e.body?.issues?.length) setIssues(e.body.issues)
      notify.error(e.message)
    } finally { setUploading(false) }
  }

  const remove = async (imp) => {
    const ok = await confirm({
      title: `Remove ${imp.filename}`,
      message: `The ${fmtL(imp.litres)} still held from this upload (${imp.covers}) go with it.`,
      detail: 'The workbook can be uploaded again at any time.',
      confirmLabel: 'Remove',
    })
    if (!ok) return
    try { await apiFetch(`/units-sold/imports/${imp.id}`, { method: 'DELETE' }); load(); onImported() }
    catch (e) { notify.error(e.message) }
  }

  return (
    <>
      <Card>
        <CardTitle>Upload the UNIT SOLD workbook</CardTitle>
        <p className="text-sm mb-3" style={{ color: 'var(--ink-60)' }}>
          Litres and units sold come from here — a sheet per month, the days across the top, fresh milk by
          outlet and processed milk by pack down the side. Every month in the file replaces what was held for
          it, so upload the latest copy whenever it changes.
        </p>
        <p className="text-xs mb-4" style={{ color: 'var(--ink-30)' }}>
          The YEARLY and MONTHLY sheets are sums of the month sheets and are not read. Anything below TOTAL
          PROCESSED MILK SOLD — production, damages, calves — is not a sale and is left out.
        </p>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }} />
        <Btn variant="primary" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? <><Spinner />Reading the workbook…</> : 'Choose a workbook'}
        </Btn>
      </Card>

      {issues.length > 0 && (
        <Card>
          <div className="text-sm font-semibold mb-1" style={{ color: 'var(--red)' }}>The workbook could not be imported</div>
          <ul className="text-[13px] pl-5 list-disc" style={{ color: 'var(--red)' }}>{issues.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </Card>
      )}

      {result && (
        <Card>
          <CardTitle>
            {fmtL(result.litres)} read in — {result.months.length} month{result.months.length === 1 ? '' : 's'}
            <button onClick={() => setResult(null)} className="border-0 bg-transparent cursor-pointer text-[16px] leading-none"
              style={{ color: 'var(--ink-30)' }}>✕</button>
          </CardTitle>
          {result.replaced_months?.length > 0 && (
            <p className="text-xs mb-3" style={{ color: 'var(--ink-60)' }}>
              {result.replaced_months.length} month{result.replaced_months.length === 1 ? ' was' : 's were'} already
              held and {result.replaced_months.length === 1 ? 'has' : 'have'} been replaced, so nothing is counted twice.
            </p>
          )}
          <div style={{ overflowX: 'auto' }}>
            <table className="w-full border-collapse text-[13px] mb-4" style={{ minWidth: 480 }}>
              <thead><tr><TH>Month</TH><TH right>Days</TH><TH right>Fresh</TH><TH right>Processed</TH><TH right>All milk</TH></tr></thead>
              <tbody>
                {result.months.map(m => (
                  <tr key={m.month}>
                    <TD style={{ fontWeight: 600 }}>{m.label}</TD>
                    <TD right mono style={{ color: 'var(--ink-60)' }}>{m.days}</TD>
                    <TD right mono>{fmt(m.fresh)}</TD>
                    <TD right mono>{fmt(m.processed)}</TD>
                    <TD right mono style={{ fontWeight: 600, color: 'var(--blue)' }}>{fmt(m.litres)}</TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.warnings?.length > 0 && (
            <div className="mb-3">
              <div className="text-sm font-semibold mb-1" style={{ color: 'var(--amber)' }}>Worth a look</div>
              <ul className="text-[12px] pl-5 list-disc" style={{ color: 'var(--ink-60)' }}>
                {result.warnings.map((w, i) => <li key={i} className="mb-1">{w}</li>)}
              </ul>
            </div>
          )}
          {result.skipped?.length > 0 && (
            <details>
              <summary className="text-sm font-semibold cursor-pointer" style={{ color: 'var(--ink)' }}>Sheets left out ({result.skipped.length})</summary>
              <ul className="text-[12px] pl-5 list-disc mt-2" style={{ color: 'var(--ink-60)' }}>
                {result.skipped.map((s, i) => <li key={i}><strong>{s.sheet}</strong> — {s.why}</li>)}
              </ul>
            </details>
          )}
        </Card>
      )}

      <Card noPad>
        <div className="px-5 pt-5 pb-3 text-sm font-semibold" style={{ color: 'var(--ink)' }}>UNIT SOLD uploads</div>
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full border-collapse text-[13px]" style={{ minWidth: 640 }}>
            <thead><tr><TH>File</TH><TH>Months held</TH><TH right>Litres</TH><TH>Uploaded</TH><TH /></tr></thead>
            <tbody>
              {imports && imports.length === 0 && (
                <tr><td colSpan={5}><EmptyState>No UNIT SOLD workbook has been uploaded yet.</EmptyState></td></tr>
              )}
              {(imports || []).map(i => (
                <tr key={i.id}>
                  <TD style={{ fontWeight: 600 }}>{i.filename}</TD>
                  <TD style={{ color: 'var(--ink-60)' }}>{i.covers || '—'}</TD>
                  <TD right mono style={{ fontWeight: 600 }}>{fmt(i.litres)}</TD>
                  <TD mono style={{ color: 'var(--ink-60)' }}>
                    {String(i.uploaded_at).slice(0, 10)}
                    {i.uploaded_by && <span style={{ color: 'var(--ink-30)' }}> · {i.uploaded_by}</span>}
                  </TD>
                  <TD right><RowMenu items={[{ label: 'Remove this upload', danger: true, onClick: () => remove(i) }]} /></TD>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}
