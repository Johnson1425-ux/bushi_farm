import React, { useEffect } from 'react'
import { Chart, BarElement, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Filler } from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'
import { apiFetch, statusClass, initials } from '../lib/api'
import { MetricCard, Card, CardTitle, Badge, Btn, PageHeader } from '../components/ui'

Chart.register(BarElement, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Filler)

export default function Dashboard({ cows, summary, setPage }) {
  const [trend,   setTrend]   = React.useState([])
  const [barSort, setBarSort] = React.useState('desc')

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
        <Card>
          <CardTitle>
            <span>Production by cow (avg)</span>
            <select
              value={barSort}
              onChange={e => setBarSort(e.target.value)}
              className="text-xs px-2 py-1"
            >
              <option value="desc">Highest first</option>
              <option value="asc">Lowest first</option>
              <option value="name">Name A–Z</option>
            </select>
          </CardTitle>
          <div className="h-[280px] relative">
            {cows?.length ? <Bar data={barData} options={chartOpts} /> : null}
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
                  <tr key={c.id} style={{ transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background='var(--cream)'} onMouseLeave={e => e.currentTarget.style.background=''}>
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
    </div>
  )
}