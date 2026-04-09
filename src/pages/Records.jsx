import React, { useState, useEffect } from 'react'
import { apiFetch, toDateStr, statusClass, initials } from '../lib/api'
import { Card, Badge, InlineBar, Btn, PageHeader, EmptyState } from '../components/ui'

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
        active
          ? 'border-green-600 bg-green-600 text-white'
          : 'border-ink-10 bg-surface text-ink-60 hover:border-green-200',
      ].join(' ')}
    >
      {label}
    </button>
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
      {/* Header */}
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
        <button
          onClick={onClose}
          className="bg-transparent border-0 cursor-pointer text-[18px] text-ink-30 hover:text-ink transition-colors p-1 leading-none"
        >✕</button>
      </div>

      {/* Month tabs */}
      <div className="flex gap-1.5 flex-wrap mb-5">
        <MonthTab label="All" active={activeMonth === 'all'} onClick={() => setActiveMonth('all')} />
        {months.map(m => (
          <MonthTab key={m} label={formatMonth(m)} active={activeMonth === m} onClick={() => setActiveMonth(m)} />
        ))}
      </div>

      {/* Stats */}
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

      {/* Records table */}
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
                      <th key={h} className="text-left px-2.5 py-1.5 text-[11px] font-semibold tracking-wider uppercase text-ink-60 border-b border-ink-10">
                        {h}
                      </th>
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

      {/* Footer */}
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
      <PageHeader title="Records" sub="Select a cow to browse her production history">
        <Btn size="sm" onClick={exportAll}>+ Export all CSV</Btn>
      </PageHeader>

      <div
        className="grid gap-6 items-start"
        style={{ gridTemplateColumns: selectedCow ? '320px 1fr' : '560px' }}
      >
        {/* Cow list */}
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
                key={cow.id}
                cow={cow}
                selected={selectedCow}
                overall={overall}
                onClick={() => setSelectedCow(cow.id === selectedCow?.id ? null : cow)}
              />
            ))
          }
        </div>

        {/* Detail card */}
        {selectedCow && (
          <CowRecordsCard cow={selectedCow} overall={overall} onClose={() => setSelectedCow(null)} />
        )}
      </div>
    </div>
  )
}