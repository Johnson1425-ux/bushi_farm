import React, { useEffect, useState } from 'react'
import { Chart, BarElement, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Filler } from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'
import { apiFetch, statusClass, initials } from '../lib/api'
import { MetricCard, Card, CardTitle, Badge, Btn, PageHeader } from '../components/ui'

Chart.register(BarElement, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Filler)

function ExpandedChart({ cows, overall, barSort, setBarSort, onClose }) {
  const sortedCows = [...cows].sort((a, b) => {
    if (barSort === 'asc')  return parseFloat(a.avg_litres) - parseFloat(b.avg_litres)
    if (barSort === 'name') return a.name.localeCompare(b.name)
    return parseFloat(b.avg_litres) - parseFloat(a.avg_litres)
  })

  const barData = {
    labels: sortedCows.map(c => c.name),
    datasets: [{
      data: sortedCows.map(c => parseFloat(c.avg_litres) || 0),
      backgroundColor: sortedCows.map(c => {
        const cls = statusClass(parseFloat(c.avg_litres) || 0, overall)
        return cls === 'high' ? '#4db882' : cls === 'low' ? '#d94040' : '#e8a020'
      }),
      borderRadius: 6, borderSkipped: false,
    }]
  }

  const chartOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: v => `${v.raw.toFixed(1)} L/day` } } },
    scales: {
      y: { ticks: { callback: v => v + 'L' }, grid: { color: 'var(--ink-10)' } },
      x: { grid: { display: false }, ticks: { font: { size: 11 }, maxRotation: 45 } }
    }
  }

  // Dynamic height — ~20px per cow, min 400px
  const chartH = Math.max(400, sortedCows.length * 22)

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(10,30,20,0.55)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="rounded-[16px] flex flex-col w-full max-w-5xl max-h-[90vh]"
        style={{ background: 'var(--surface)', padding: '24px' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <div>
            <div className="font-serif text-[20px]" style={{ color: 'var(--ink)' }}>
              Production by Cow (avg)
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--ink-60)' }}>
              All {sortedCows.length} cows
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={barSort}
              onChange={e => setBarSort(e.target.value)}
              className="text-xs px-2 py-1"
            >
              <option value="desc">Highest first</option>
              <option value="asc">Lowest first</option>
              <option value="name">Name A–Z</option>
            </select>
            <button
              onClick={onClose}
              className="border-0 bg-transparent cursor-pointer text-xl p-1 leading-none hover:opacity-60"
              style={{ color: 'var(--ink-30)' }}
            >✕</button>
          </div>
        </div>

        {/* Scrollable chart area */}
        <div className="overflow-y-auto flex-1">
          <div style={{ height: chartH, minWidth: 0 }}>
            <Bar data={barData} options={chartOpts} />
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 pt-3 flex-shrink-0" style={{ borderTop: '1px solid var(--ink-10)' }}>
          {[
            { color: '#4db882', label: 'High (≥110% avg)' },
            { color: '#e8a020', label: 'Average' },
            { color: '#d94040', label: 'Low (≤85% avg)' },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: l.color }} />
              <span className="text-xs" style={{ color: 'var(--ink-60)' }}>{l.label}</span>
            </div>
          ))}
          <div className="ml-auto text-xs" style={{ color: 'var(--ink-30)' }}>
            Herd avg: {overall.toFixed(1)} L/day
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard({ cows, summary, setPage }) {
  const [trend,    setTrend]    = useState([])
  const [barSort,  setBarSort]  = useState('desc')
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    apiFetch('/analytics/trend?days=30').then(setTrend).catch(() => {})
  }, [])

  const s   = summary || {}
  const top = cows?.[0]

  const overall = cows?.length
    ? cows.reduce((acc, c) => acc + (parseFloat(c.avg_litres) || 0), 0) / cows.length
    : 0

  const sortedCows = [...(cows || [])].sort((a, b) => {
    if (barSort === 'asc')  return parseFloat(a.avg_litres) - parseFloat(b.avg_litres)
    if (barSort === 'name') return a.name.localeCompare(b.name)
    return parseFloat(b.avg_litres) - parseFloat(a.avg_litres)
  })

  // Dashboard shows top 10 only
  const previewCows = sortedCows.slice(0, 10)

  const makeBarData = (list) => ({
    labels: list.map(c => c.name),
    datasets: [{
      data: list.map(c => parseFloat(c.avg_litres) || 0),
      backgroundColor: list.map(c => {
        const cls = statusClass(parseFloat(c.avg_litres) || 0, overall)
        return cls === 'high' ? '#4db882' : cls === 'low' ? '#d94040' : '#e8a020'
      }),
      borderRadius: 6, borderSkipped: false,
    }]
  })

  const trendData = {
    labels: trend.map(t => t.date?.slice(5)),
    datasets: [{
      label: 'Avg L/day',
      data: trend.map(t => parseFloat(t.avg_litres)),
      fill: true,
      borderColor: '#2a8a56',
      backgroundColor: 'rgba(77,184,130,.12)',
      tension: 0.4,
      pointRadius: 2,
    }]
  }

  const chartOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { ticks: { callback: v => v + 'L' }, grid: { color: 'var(--ink-10)' } },
      x: { grid: { display: false }, ticks: { font: { size: 11 } } }
    }
  }

  const top5 = [...(cows || [])].sort((a, b) => parseFloat(b.avg_litres) - parseFloat(a.avg_litres)).slice(0, 5)

  return (
    <div style={{ animation: 'fadeUp .2s ease' }}>
      <PageHeader title="Farm Overview" sub="Summary of your herd's milk production">
        <Btn size="sm" onClick={() => setPage('import')}>+ Import Excel</Btn>
      </PageHeader>

      {/* Metric cards */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3.5 mb-7">
        <MetricCard label="Cows tracked"    value={parseInt(s.total_cows) || '—'} />
        <MetricCard label="Herd avg / day"  value={parseFloat(s.overall_avg)?.toFixed(1) || '—'} unit="litres" />
        <MetricCard label="Total collected" value={
          parseFloat(s.total_litres) >= 1000
            ? (parseFloat(s.total_litres) / 1000).toFixed(1) + 'k'
            : parseFloat(s.total_litres)?.toFixed(0) || '—'
        } unit="litres" />
        <MetricCard label="Days on record"  value={parseInt(s.days_tracked) || '—'} />
        <MetricCard label="Top producer" accent
          value={top ? top.name : '—'}
          note={top ? `${parseFloat(top.avg_litres).toFixed(1)} L avg/day` : ''}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-5 mb-5">
        {/* Production bar chart — clickable to expand */}
        <Card>
          <CardTitle>
            <span>Production by cow (avg)</span>
            <div className="flex items-center gap-2">
              <select value={barSort} onChange={e => setBarSort(e.target.value)} className="text-xs px-2 py-1">
                <option value="desc">Highest first</option>
                <option value="asc">Lowest first</option>
                <option value="name">Name A–Z</option>
              </select>
              {(cows?.length || 0) > 10 && (
                <button
                  onClick={() => setExpanded(true)}
                  title="Expand to see all cows"
                  className="border-0 bg-transparent cursor-pointer text-xs font-medium flex items-center gap-1 px-2 py-1 rounded transition-all"
                  style={{ color: 'var(--green-600)', background: 'var(--green-50)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--green-100)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--green-50)'}
                >
                  ⤢ All {cows.length}
                </button>
              )}
            </div>
          </CardTitle>

          {/* Clickable chart area */}
          <div
            className="h-[280px] relative rounded-lg transition-all"
            onClick={() => setExpanded(true)}
            style={{ cursor: 'pointer' }}
            title="Click to expand"
          >
            {cows?.length ? <Bar data={makeBarData(previewCows)} options={chartOpts} /> : null}
            {/* Overlay hint */}
            {cows?.length > 10 && (
              <div
                className="absolute bottom-2 right-2 text-[11px] font-medium px-2 py-0.5 rounded pointer-events-none"
                style={{ background: 'var(--ink-10)', color: 'var(--ink-60)' }}
              >
                Showing 10 of {cows.length} · click to expand
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardTitle>Herd trend (last 30 days)</CardTitle>
          <div className="h-[280px] relative">
            {trend.length ? <Line data={trendData} options={chartOpts} /> : null}
          </div>
        </Card>
      </div>

      {/* Top 5 table */}
      <Card>
        <CardTitle>
          <span>Top 5 producers</span>
          <Btn size="sm" onClick={() => setPage('cows')}>View all →</Btn>
        </CardTitle>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                {['#', 'Cow', 'Avg L/day', 'Total Litres', 'Days', 'Status'].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[11px] font-semibold tracking-wider uppercase text-ink-60 border-b border-ink-10">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {top5.map((c, i) => {
                const cls = statusClass(parseFloat(c.avg_litres) || 0, overall)
                return (
                  <tr key={c.id} style={{ transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--cream)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <td className="px-3 py-2.5 border-b border-ink-10 font-mono text-[12px] text-ink-30">{i + 1}</td>
                    <td className="px-3 py-2.5 border-b border-ink-10 font-semibold">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-green-100 text-green-800 flex items-center justify-center font-semibold text-[11px]">
                          {initials(c.name)}
                        </div>
                        {c.name}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 border-b border-ink-10 font-medium">{parseFloat(c.avg_litres).toFixed(1)} L</td>
                    <td className="px-3 py-2.5 border-b border-ink-10">{parseFloat(c.total_litres).toFixed(0)} L</td>
                    <td className="px-3 py-2.5 border-b border-ink-10">{c.record_count}</td>
                    <td className="px-3 py-2.5 border-b border-ink-10"><Badge cls={cls} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Expanded chart modal */}
      {expanded && (
        <ExpandedChart
          cows={cows || []}
          overall={overall}
          barSort={barSort}
          setBarSort={setBarSort}
          onClose={() => setExpanded(false)}
        />
      )}
    </div>
  )
}