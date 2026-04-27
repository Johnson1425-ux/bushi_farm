import React, { useState, useEffect } from 'react'
import { apiFetch, toDateStr, statusClass, initials } from '../lib/api'
import { Card, Badge, InlineBar, Btn, PageHeader, EmptyState } from '../components/ui'

const today = () => new Date().toISOString().slice(0, 10)

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

function CowRecordsCard({ cow, overall, onClose }) {
  const [records,     setRecords]     = useState([])
  const [months,      setMonths]      = useState([])
  const [activeMonth, setActiveMonth] = useState('all')
  const [loading,     setLoading]     = useState(true)

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

  const formatMonth = (m) => {
    if (m === 'all') return 'All time'
    const [y, mo] = m.split('-')
    return new Date(+y, +mo - 1).toLocaleString('default', { month: 'long', year: 'numeric' })
  }

  const exportCSV = () => {
    const csv = ['Date,Litres', ...filtered.map(r => `${toDateStr(r.date)},${r.litres}`)].join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
    a.download = `${cow.name.replace(/\s+/g, '_')}_${activeMonth}.csv`
    a.click()
  }

  return (
    <Card className="mb-0 sticky top-8">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-11 h-11 rounded-full bg-green-600 text-white flex items-center justify-center font-bold text-[15px] flex-shrink-0">
          {initials(cow.name)}
        </div>
        <div className="flex-1">
          <div className="font-serif text-[20px]">{cow.name}</div>
          <div className="text-xs text-ink-60 mt-0.5">
            {cow.breed || 'No breed set'}{cow.tag ? ` · #${cow.tag}` : ''}
          </div>
        </div>
        <button onClick={onClose} className="bg-transparent border-0 cursor-pointer text-[18px] text-ink-30 hover:text-ink transition-colors p-1 leading-none">✕</button>
      </div>

      <div className="flex gap-1.5 flex-wrap mb-5">
        <MonthTab label="All" active={activeMonth === 'all'} onClick={() => setActiveMonth('all')} />
        {months.map(m => (
          <MonthTab key={m} label={formatMonth(m)} active={activeMonth === m} onClick={() => setActiveMonth(m)} />
        ))}
      </div>

      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5 mb-5">
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
            <div className="overflow-y-auto max-h-[380px]">
              <table className="w-full border-collapse text-[13px]">
                <thead className="sticky top-0 bg-surface z-[1]">
                  <tr>
                    {['Date', 'Litres', 'vs avg', 'Status'].map(h => (
                      <th key={h} className="text-left px-2.5 py-1.5 text-[11px] font-semibold tracking-wider uppercase text-ink-60 border-b border-ink-10">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => {
                    const cls = statusClass(parseFloat(r.litres), overall)
                    return (
                      <tr key={r.id} className="hover:bg-cream-dark transition-colors">
                        <td className="px-2.5 py-2 border-b border-ink-10 font-mono text-[12px]">{toDateStr(r.date)}</td>
                        <td className="px-2.5 py-2 border-b border-ink-10 font-semibold">{parseFloat(r.litres).toFixed(1)} L</td>
                        <td className="px-2.5 py-2 border-b border-ink-10"><InlineBar litres={parseFloat(r.litres)} overall={overall} /></td>
                        <td className="px-2.5 py-2 border-b border-ink-10"><Badge cls={cls} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
      }

      {!loading && filtered.length > 0 && (
        <div className="mt-4 pt-3.5 border-t border-ink-10">
          <Btn size="sm" onClick={exportCSV}>Export {formatMonth(activeMonth)} CSV</Btn>
        </div>
      )}
    </Card>
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
        {[['browse', '📋 Browse Records'], ['entry', '📝 Manual Entry']].map(([v, l]) => (
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
        <div
          className="grid gap-6 items-start"
          style={{ gridTemplateColumns: selectedCow ? '320px 1fr' : '560px' }}
        >
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