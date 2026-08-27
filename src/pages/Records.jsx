import React, { useState, useEffect } from 'react'
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { apiFetch, toDateStr, statusClass, initials } from '../lib/api'
import { Card, CardTitle, Badge, InlineBar, Btn, PageHeader, EmptyState } from '../components/ui'

const today = () => new Date().toISOString().slice(0, 10)

/** '2026-07' → 'July 2026'. Shared by the per-cow tabs and the monthly view. */
const formatMonth = (m) => {
  if (m === 'all') return 'All time'
  const [y, mo] = String(m).split('-')
  return new Date(+y, +mo - 1).toLocaleString('default', { month: 'long', year: 'numeric' })
}

const fmt = (n, dec = 1) =>
  Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: dec })

/** '2026-08' → '2026-07'. Used to tell a real gap from a missing month. */
const previousMonthOf = (m) => {
  const [y, mo] = String(m).split('-').map(Number)
  const d = new Date(Date.UTC(y, mo - 2, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

const daysInMonth = (m) => {
  const [y, mo] = String(m).split('-').map(Number)
  return new Date(Date.UTC(y, mo, 0)).getUTCDate()
}

/** Trigger a CSV download without a round trip to the server. */
function downloadCSV(filename, rows) {
  const a = document.createElement('a')
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(rows.join('\n'))
  a.download = filename
  a.click()
}

function CowListItem({ cow, selected, onClick, overall }) {
  const cls        = statusClass(parseFloat(cow.avg_litres) || 0, overall)
  const isSelected = selected?.id === cow.id
  return (
    <div
      onClick={onClick}
      className={[
        'flex items-center gap-3.5 px-4 py-3 rounded-[10px] cursor-pointer mb-2 transition-all duration-150',
        isSelected
          ? 'border-[1.5px] border-green-600 bg-green-50'
          : 'border-[1.5px] border-ink-10 bg-surface hover:border-green-200 hover:bg-cream',
      ].join(' ')}
    >
      <div className={[
        'w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-[13px]',
        isSelected ? 'bg-green-600 text-white' : 'bg-green-100 text-green-800',
      ].join(' ')}>
        {initials(cow.name)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm truncate">{cow.name}</div>
        <div className="text-[11px] text-ink-30 mt-0.5">
          {cow.record_count} records · {cow.first_date?.slice(0, 7)} → {cow.last_date?.slice(0, 7)}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="text-[18px] font-semibold text-green-800 leading-none">
          {parseFloat(cow.avg_litres || 0).toFixed(1)}
          <span className="text-[11px] font-light text-ink-60"> L</span>
        </div>
        <div className="mt-1"><Badge cls={cls} /></div>
      </div>
    </div>
  )
}

function MonthTab({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={[
        'px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 whitespace-nowrap cursor-pointer',
        active ? 'border-green-600 bg-green-600 text-white' : 'border-ink-10 bg-surface text-ink-60 hover:border-green-200',
      ].join(' ')}
    >{label}</button>
  )
}

function ManualEntryPanel({ cows, onSaved }) {
  const [cowId,   setCowId]   = useState('')
  const [date,    setDate]    = useState(today())
  const [litres,  setLitres]  = useState('')
  const [saving,  setSaving]  = useState(false)
  const [success, setSuccess] = useState(null)
  const [error,   setError]   = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!cowId || !date || !litres) return
    setSaving(true); setSuccess(null); setError(null)
    try {
      await apiFetch('/records', {
        method: 'POST',
        body: JSON.stringify({ cow_id: cowId, date, litres: parseFloat(litres) }),
      })
      const cow = cows.find(c => String(c.id) === String(cowId))
      setSuccess(`✓ Saved ${litres} L for ${cow?.name || 'cow'} on ${date}`)
      setLitres('')
      onSaved?.()
    } catch (err) {
      setError(`✗ ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>Manual Entry</div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--ink-60)' }}>Record production for one cow at a time</div>
        </div>
        <span style={{ fontSize: 22 }}>📝</span>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Cow selector */}
        <div style={{ marginBottom: 12 }}>
          <label className="block text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--ink-60)', marginBottom: 5 }}>
            Cow
          </label>
          <select
            value={cowId}
            onChange={e => setCowId(e.target.value)}
            className="w-full"
            required
          >
            <option value="">Select a cow…</option>
            {[...cows].sort((a, b) => a.name.localeCompare(b.name)).map(c => (
              <option key={c.id} value={c.id}>{c.name}{c.tag ? ` #${c.tag}` : ''}</option>
            ))}
          </select>
        </div>

        {/* Date */}
        <div style={{ marginBottom: 12 }}>
          <label className="block text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--ink-60)', marginBottom: 5 }}>
            Date
          </label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full"
            required
          />
        </div>

        {/* Litres */}
        <div style={{ marginBottom: 16 }}>
          <label className="block text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--ink-60)', marginBottom: 5 }}>
            Litres
          </label>
          <div className="relative">
            <input
              type="number"
              value={litres}
              onChange={e => setLitres(e.target.value)}
              placeholder="0.0"
              min="0"
              step="0.1"
              className="w-full"
              style={{ paddingRight: 36 }}
              required
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium pointer-events-none" style={{ color: 'var(--ink-30)' }}>L</span>
          </div>
        </div>

        {/* Feedback */}
        {success && (
          <div className="rounded-lg text-xs px-3 py-2 mb-3" style={{ background: 'var(--green-50)', color: 'var(--green-800)', border: '1px solid var(--green-100)' }}>
            {success}
          </div>
        )}
        {error && (
          <div className="rounded-lg text-xs px-3 py-2 mb-3" style={{ background: 'rgba(217,64,64,0.1)', color: 'var(--red)', border: '1px solid rgba(217,64,64,0.2)' }}>
            {error}
          </div>
        )}

        <Btn variant="primary" className="w-full justify-center">
          <button
            type="submit"
            disabled={saving}
            className="border-0 bg-transparent text-white cursor-pointer font-medium text-sm w-full"
          >
            {saving ? 'Saving…' : 'Save Record'}
          </button>
        </Btn>
      </form>
    </Card>
  )
}

/**
 * A cow's full record history, as a modal.
 *
 * This used to sit in a column beside the cow list, which meant selecting a
 * cow squeezed the list from 560px to 320px and left the detail — month
 * tabs, four stat tiles and a four-column table — in whatever space was
 * left. Both halves ended up too narrow to read. A modal gives the detail
 * the full width of the screen and leaves the list alone underneath.
 */
function CowRecordsCard({ cow, overall, onClose }) {
  const [records,     setRecords]     = useState([])
  const [months,      setMonths]      = useState([])
  const [activeMonth, setActiveMonth] = useState('all')
  const [loading,     setLoading]     = useState(true)

  /* Escape closes, and the page behind must not scroll while this is open —
     otherwise dismissing the modal leaves the list somewhere unexpected. */
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [onClose])

  useEffect(() => {
    setLoading(true); setRecords([]); setMonths([])
    apiFetch(`/records?cow_id=${cow.id}&limit=9999`)
      .then(({ records: r }) => {
        setRecords(r)
        const seen = new Set()
        r.forEach(rec => seen.add(toDateStr(rec.date).slice(0, 7)))
        const sorted = [...seen].sort((a, b) => b.localeCompare(a))
        setMonths(sorted)
        setActiveMonth(sorted[0] || 'all')
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [cow.id])

  const filtered = activeMonth === 'all'
    ? records
    : records.filter(r => toDateStr(r.date).startsWith(activeMonth))

  const monthAvg   = filtered.length ? filtered.reduce((s, r) => s + parseFloat(r.litres), 0) / filtered.length : 0
  const monthTotal = filtered.reduce((s, r) => s + parseFloat(r.litres), 0)
  const monthMax   = filtered.length ? Math.max(...filtered.map(r => parseFloat(r.litres))) : 0
  const monthMin   = filtered.length ? Math.min(...filtered.map(r => parseFloat(r.litres))) : 0

  const exportCSV = () => {
    const csv = ['Date,Litres', ...filtered.map(r => `${toDateStr(r.date)},${r.litres}`)].join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
    a.download = `${cow.name.replace(/\s+/g, '_')}_${activeMonth}.csv`
    a.click()
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(10,30,20,0.55)', backdropFilter: 'blur(4px)' }}
      role="dialog"
      aria-modal="true"
      aria-label={`Records for ${cow.name}`}
    >
      <div
        className="rounded-[16px] flex flex-col w-full max-w-3xl max-h-[90vh]"
        style={{ background: 'var(--surface)' }}
      >
        {/* Header — stays put while the records scroll */}
        <div className="flex items-center gap-3 flex-shrink-0 px-6 pt-6 pb-4">
          <div className="w-11 h-11 rounded-full bg-green-600 text-white flex items-center justify-center font-bold text-[15px] flex-shrink-0">
            {initials(cow.name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-serif text-[20px] truncate">{cow.name}</div>
            <div className="text-xs text-ink-60 mt-0.5">
              {cow.breed || 'No breed set'}{cow.tag ? ` · #${cow.tag}` : ''}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="bg-transparent border-0 cursor-pointer text-[18px] text-ink-30 hover:text-ink transition-colors p-1 leading-none"
          >✕</button>
        </div>

        {/* Body — the only scrolling region, so there is never a scrollbar
            inside a scrollbar. */}
        <div className="flex-1 overflow-y-auto px-6">
          <div className="flex gap-1.5 flex-wrap mb-5">
            <MonthTab label="All" active={activeMonth === 'all'} onClick={() => setActiveMonth('all')} />
            {months.map(m => (
              <MonthTab key={m} label={formatMonth(m)} active={activeMonth === m} onClick={() => setActiveMonth(m)} />
            ))}
          </div>

          {!loading && filtered.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
              {[
                ['Avg / day',  monthAvg.toFixed(1)   + ' L'],
                ['Total',      monthTotal.toFixed(0) + ' L'],
                ['Best day',   monthMax.toFixed(1)   + ' L'],
                ['Worst day',  monthMin.toFixed(1)   + ' L'],
              ].map(([label, val]) => (
                <div key={label} className="bg-cream rounded-lg px-3.5 py-2.5">
                  <div className="text-[11px] text-ink-60 uppercase tracking-wider font-medium">{label}</div>
                  <div className="text-xl font-semibold text-ink mt-0.5">{val}</div>
                </div>
              ))}
            </div>
          )}

          {loading
            ? <div className="text-center py-6 text-ink-30 text-[13px]">Loading…</div>
            : filtered.length === 0
              ? <div className="text-center py-6 text-ink-30 text-[13px]">No records for this period.</div>
              : (
                <table className="w-full border-collapse text-[13px] mb-2">
                  <thead className="sticky top-0 z-[1]" style={{ background: 'var(--surface)' }}>
                    <tr>
                      {/* The vs-avg bar is the widest column and the least
                          essential, so it steps aside on a phone rather than
                          pushing Status off the edge. */}
                      {[['Date', ''], ['Litres', ''], ['vs avg', 'hidden sm:table-cell'], ['Status', '']].map(([h, extra]) => (
                        <th key={h} className={`text-left px-2.5 py-1.5 text-[11px] font-semibold tracking-wider uppercase text-ink-60 border-b border-ink-10 ${extra}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(r => {
                      const cls = statusClass(parseFloat(r.litres), overall)
                      return (
                        <tr key={r.id} className="hover:bg-cream-dark transition-colors">
                          <td className="px-2.5 py-2 border-b border-ink-10 font-mono text-[12px] whitespace-nowrap">{toDateStr(r.date)}</td>
                          <td className="px-2.5 py-2 border-b border-ink-10 font-semibold whitespace-nowrap">{parseFloat(r.litres).toFixed(1)} L</td>
                          <td className="px-2.5 py-2 border-b border-ink-10 hidden sm:table-cell"><InlineBar litres={parseFloat(r.litres)} overall={overall} /></td>
                          <td className="px-2.5 py-2 border-b border-ink-10"><Badge cls={cls} /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )
          }
        </div>

        {/* Footer */}
        {!loading && filtered.length > 0 && (
          <div className="flex-shrink-0 px-6 py-4 mt-1 border-t border-ink-10">
            <Btn size="sm" onClick={exportCSV}>Export {formatMonth(activeMonth)} CSV</Btn>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Whole-farm production, one row per calendar month.
 *
 * The per-cow card already breaks a single animal down by month; this is the
 * same view for the herd. Everything is served pre-aggregated rather than
 * summed in the browser, so the figures cannot drift from what the reports
 * and the AI read.
 *
 * Archived cows are included. A cow that has since died still produced the
 * milk credited to the month she produced it in, and leaving her out would
 * make last year's totals move every time an animal leaves the herd.
 */
function MonthlyTotals() {
  const [months,  setMonths]  = useState([])
  const [loading, setLoading] = useState(true)
  const [open,    setOpen]    = useState(null)     // month whose cows are shown
  const [breakdown, setBreakdown] = useState({})   // month -> rows

  useEffect(() => {
    setLoading(true)
    apiFetch('/analytics/monthly')
      .then(setMonths)
      .catch(() => setMonths([]))
      .finally(() => setLoading(false))
  }, [])

  const toggle = async (month) => {
    if (open === month) { setOpen(null); return }
    setOpen(month)
    if (breakdown[month]) return
    try {
      const rows = await apiFetch(`/analytics/monthly/${month}`)
      setBreakdown(prev => ({ ...prev, [month]: rows }))
    } catch {
      setBreakdown(prev => ({ ...prev, [month]: [] }))
    }
  }

  // The API returns newest first, which suits the table; the chart reads
  // left to right in time order.
  const chart = [...months].reverse().map(m => ({
    month: formatMonth(m.month).replace(' 20', " '"),
    Litres: Number(m.total_litres) || 0,
  }))

  const exportCSV = () => downloadCSV('monthly_production.csv', [
    'Month,Total litres,Avg per day,Cows milked,Days recorded,Records',
    ...months.map(m => [
      m.month, m.total_litres, m.avg_per_day, m.cows_milked, m.days_recorded, m.records,
    ].join(',')),
  ])

  if (loading) return <div className="text-center py-16 text-sm" style={{ color: 'var(--ink-30)' }}>Loading…</div>
  if (!months.length) return <EmptyState>No production has been recorded yet.</EmptyState>

  const grandTotal = months.reduce((s, m) => s + Number(m.total_litres), 0)
  const best = months.reduce((a, b) => (Number(b.total_litres) > Number(a.total_litres) ? b : a))

  return (
    <div>
      <div className="grid gap-3.5 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        {[
          ['Months recorded', String(months.length), ''],
          ['Total produced',  fmt(grandTotal, 0),    'litres'],
          ['Best month',      formatMonth(best.month), `${fmt(best.total_litres, 0)} L`],
        ].map(([label, value, note]) => (
          <div key={label} className="rounded-lg border p-4"
            style={{ background: 'var(--surface)', borderColor: 'var(--ink-10)' }}>
            <div className="text-[11px] uppercase tracking-wider font-medium mb-1" style={{ color: 'var(--ink-60)' }}>{label}</div>
            <div className="font-semibold" style={{ fontSize: 20, color: 'var(--ink)', lineHeight: 1.2 }}>{value}</div>
            {note && <div className="text-[11px] mt-0.5" style={{ color: 'var(--ink-30)' }}>{note}</div>}
          </div>
        ))}
      </div>

      <Card>
        <CardTitle>Total litres by month</CardTitle>
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--ink-10)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: 'var(--ink-60)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--ink-60)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v) => [`${fmt(v)} L`, 'Total']}
                contentStyle={{
                  background: 'var(--surface)', border: '1.5px solid var(--ink-10)',
                  borderRadius: 10, fontSize: 12, color: 'var(--ink)',
                }}
                cursor={{ fill: 'var(--cream-dark)' }}
              />
              <Bar dataKey="Litres" fill="var(--green-400)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card noPad>
        <div className="px-5 pt-4 pb-1 flex items-center justify-between">
          <CardTitle>Month by month</CardTitle>
          <Btn size="sm" onClick={exportCSV}>↓ Export CSV</Btn>
        </div>
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              {[['Month', ''], ['Total', ''], ['Avg / day', ''],
                ['vs previous', 'hidden sm:table-cell'],
                ['Cows', 'hidden sm:table-cell'], ['Days', 'hidden sm:table-cell']]
                .map(([h, extra]) => (
                  <th key={h} className={`text-left px-5 py-3 text-[11px] font-semibold tracking-wider uppercase border-b ${extra}`}
                    style={{ color: 'var(--ink-60)', borderColor: 'var(--ink-10)' }}>{h}</th>
                ))}
            </tr>
          </thead>
          <tbody>
            {months.map((m, i) => {
              /* Compare on litres per day, not on the monthly total.

                 A month still being filled in has far fewer days recorded than
                 the one before it, so comparing totals reports a collapse that
                 did not happen — six days of August against all of July reads
                 as -80% when the herd is actually producing slightly more each
                 day. Per-day is also immune to February being short.

                 Only against the month immediately before: the API returns the
                 previous month *with data*, which can be a year earlier, and a
                 percentage across that gap means nothing. */
              const prev = months[i + 1]
              const adjacent = prev && prev.month === previousMonthOf(m.month)
              const change = adjacent && Number(prev.avg_per_day) > 0
                ? ((Number(m.avg_per_day) - Number(prev.avg_per_day)) / Number(prev.avg_per_day)) * 100
                : null
              const partial = m.days_recorded < daysInMonth(m.month)
              const rows = breakdown[m.month]
              return (
                <React.Fragment key={m.month}>
                  <tr
                    onClick={() => toggle(m.month)}
                    className="cursor-pointer transition-colors"
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--cream)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}
                  >
                    <td className="px-5 py-3 border-b font-medium" style={{ borderColor: 'var(--ink-10)' }}>
                      <span className="inline-block w-3 mr-1" style={{ color: 'var(--ink-30)' }}>
                        {open === m.month ? '▾' : '▸'}
                      </span>
                      {formatMonth(m.month)}
                      {partial && (
                        <span className="text-[11px] ml-2" style={{ color: 'var(--ink-30)' }}>
                          {m.days_recorded} of {daysInMonth(m.month)} days
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 border-b font-semibold" style={{ borderColor: 'var(--ink-10)' }}>
                      {fmt(m.total_litres, 0)} L
                    </td>
                    <td className="px-5 py-3 border-b" style={{ borderColor: 'var(--ink-10)', color: 'var(--ink-60)' }}>
                      {fmt(m.avg_per_day)} L
                    </td>
                    <td className="px-5 py-3 border-b hidden sm:table-cell" style={{ borderColor: 'var(--ink-10)' }}>
                      {change === null
                        ? <span style={{ color: 'var(--ink-30)' }} title={prev ? 'No data for the month before this one' : ''}>—</span>
                        : <span style={{ color: change >= 0 ? 'var(--green-600)' : 'var(--red)' }}>
                            {change >= 0 ? '+' : ''}{change.toFixed(1)}%
                          </span>}
                    </td>
                    <td className="px-5 py-3 border-b hidden sm:table-cell" style={{ borderColor: 'var(--ink-10)', color: 'var(--ink-60)' }}>
                      {m.cows_milked}
                    </td>
                    <td className="px-5 py-3 border-b hidden sm:table-cell" style={{ borderColor: 'var(--ink-10)', color: 'var(--ink-60)' }}>
                      {m.days_recorded}
                    </td>
                  </tr>

                  {open === m.month && (
                    <tr>
                      <td colSpan={6} className="px-5 py-4 border-b" style={{ borderColor: 'var(--ink-10)', background: 'var(--cream)' }}>
                        {!rows
                          ? <div className="text-[13px]" style={{ color: 'var(--ink-30)' }}>Loading…</div>
                          : rows.length === 0
                            ? <div className="text-[13px]" style={{ color: 'var(--ink-30)' }}>No cows recorded this month.</div>
                            : (
                              <>
                                <div className="text-[11px] uppercase tracking-wider font-medium mb-2" style={{ color: 'var(--ink-60)' }}>
                                  Who produced it — {rows.length} cows
                                </div>
                                <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}>
                                  {rows.map(c => (
                                    <div key={c.id} className="flex items-baseline justify-between gap-2 rounded-lg px-3 py-2"
                                      style={{ background: 'var(--surface)' }}>
                                      <span className="text-[13px] truncate">
                                        {c.name}
                                        {c.status && c.status !== 'active' && (
                                          <span className="text-[10px] ml-1" style={{ color: 'var(--ink-30)' }}>({c.status})</span>
                                        )}
                                      </span>
                                      <span className="text-[13px] font-semibold whitespace-nowrap">{fmt(c.total_litres, 0)} L</span>
                                    </div>
                                  ))}
                                </div>
                              </>
                            )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

export default function Records({ cows, summary }) {
  const [selectedCow, setSelectedCow] = useState(null)
  const [search,      setSearch]      = useState('')
  const [tab,         setTab]         = useState('browse') // 'browse' | 'entry'
  const [refreshKey,  setRefreshKey]  = useState(0)

  const overall = cows?.length
    ? cows.reduce((s, c) => s + (parseFloat(c.avg_litres) || 0), 0) / cows.length
    : 0

  const filteredCows = (cows || []).filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase())
  )

  const exportAll = async () => {
    try {
      const { records } = await apiFetch('/records?limit=99999')
      const csv = ['Cow,Date,Litres', ...records.map(r => `${r.cow},${toDateStr(r.date)},${r.litres}`)].join('\n')
      const a = document.createElement('a')
      a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
      a.download = 'milk_records_all.csv'
      a.click()
    } catch (e) {}
  }

  return (
    <div style={{ animation: 'fadeUp .2s ease' }}>
      <PageHeader title="Records" sub="Browse history or enter production data manually">
        <Btn size="sm" onClick={exportAll}>↓ Export all CSV</Btn>
      </PageHeader>

      {/* Tabs */}
      <div className="flex mb-5" style={{ borderBottom: '1px solid var(--ink-10)' }}>
        {[['browse', '📋 Browse Records'], ['monthly', '📅 Monthly Totals'], ['entry', '📝 Manual Entry']].map(([v, l]) => (
          <button
            key={v}
            onClick={() => setTab(v)}
            className="px-4 py-2 text-sm font-medium border-0 bg-transparent cursor-pointer transition-all"
            style={{
              color: tab === v ? 'var(--green-600)' : 'var(--ink-60)',
              borderBottom: tab === v ? '2px solid var(--green-600)' : '2px solid transparent',
            }}
          >{l}</button>
        ))}
      </div>

      {/* ── BROWSE TAB ── */}
      {tab === 'browse' && (
        <div className="grid gap-6 items-start" style={{ gridTemplateColumns: 'minmax(0, 560px)' }}>
          {/* The list keeps its width whether or not a cow is open — the
              detail is a modal now, so nothing has to make room for it. */}
          <div>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search cows…"
              className="w-full mb-3.5"
            />
            {filteredCows.length === 0
              ? <EmptyState>No cows found.</EmptyState>
              : filteredCows.map(cow => (
                <CowListItem
                  key={cow.id + '-' + refreshKey}
                  cow={cow}
                  selected={selectedCow}
                  overall={overall}
                  onClick={() => setSelectedCow(cow.id === selectedCow?.id ? null : cow)}
                />
              ))
            }
          </div>
          {selectedCow && (
            <CowRecordsCard cow={selectedCow} overall={overall} onClose={() => setSelectedCow(null)} />
          )}
        </div>
      )}

      {/* ── MONTHLY TOTALS TAB ── */}
      {tab === 'monthly' && <MonthlyTotals />}

      {/* ── MANUAL ENTRY TAB ── */}
      {tab === 'entry' && (
        <div className="max-w-sm">
          <ManualEntryPanel
            cows={cows || []}
            onSaved={() => setRefreshKey(k => k + 1)}
          />
          <div className="text-xs mt-3 px-1" style={{ color: 'var(--ink-30)', lineHeight: 1.7 }}>
            Records saved here will appear in the Browse tab and Dashboard immediately.
            For bulk imports, use the <strong style={{ color: 'var(--ink-60)' }}>Import Data</strong> page.
          </div>
        </div>
      )}
    </div>
  )
}