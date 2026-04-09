import React, { useState, useEffect } from 'react'
import { Line, Bar } from 'react-chartjs-2'
import { Chart, BarElement, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js'
import { apiFetch, initials, CMP_COLORS } from '../lib/api'
import { Card, CardTitle, Btn, PageHeader, EmptyState } from '../components/ui'

Chart.register(BarElement, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend)

function CowPickerModal({ cows, onSelect, onClose }) {
  const [q, setQ] = useState('')
  const list = q ? cows.filter(c => c.name.toLowerCase().includes(q.toLowerCase())) : cows

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      className="fixed inset-0 bg-[rgba(10,30,20,0.45)] z-[100] flex items-center justify-center"
    >
      <div className="bg-surface rounded-lg p-6 w-[380px] max-w-[92vw] max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-3.5">
          <h3 className="font-serif text-[20px]">Select a Cow</h3>
          <span onClick={onClose} className="text-xl cursor-pointer text-ink-30 hover:text-ink">✕</span>
        </div>
        <input
          type="text"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search…"
          className="w-full mb-3"
          autoFocus
        />
        <div className="flex flex-col gap-1.5">
          {list.map(c => (
            <div
              key={c.id}
              onClick={() => onSelect(c)}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer text-[13px] hover:bg-cream-dark transition-colors"
            >
              <div className="w-[30px] h-[30px] rounded-full bg-green-100 text-green-800 flex items-center justify-center font-semibold text-[11px] flex-shrink-0">
                {initials(c.name)}
              </div>
              <div className="flex-1">{c.name}</div>
              <div className="font-semibold text-green-600 text-[13px]">
                {parseFloat(c.avg_litres || 0).toFixed(1)} L/day
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Compare({ cows }) {
  const [selected, setSelected] = useState([null, null, null, null])
  const [modalIdx, setModalIdx] = useState(null)
  const [result,   setResult]   = useState(null)

  useEffect(() => {
    const ids = selected.filter(Boolean)
    if (ids.length < 2) { setResult(null); return }
    apiFetch(`/analytics/compare?ids=${ids.join(',')}`).then(setResult).catch(() => {})
  }, [selected])

  const pickCow = (cow) => {
    const next = [...selected]; next[modalIdx] = cow.id
    setSelected(next); setModalIdx(null)
  }

  const removeCow = (i) => {
    const next = [...selected]; next[i] = null; setSelected(next)
  }

  const cowMap = Object.fromEntries((cows || []).map(c => [c.id, c]))

  const lineData = result ? (() => {
    const dates = [...new Set(result.daily.map(r => r.date))].sort()
    const byName = {}
    result.daily.forEach(r => { if (!byName[r.cow]) byName[r.cow] = {}; byName[r.cow][r.date] = r.litres })
    return {
      labels: dates.map(d => d.slice(5)),
      datasets: result.stats.map((s, i) => ({
        label: s.name,
        data: dates.map(d => byName[s.name]?.[d] || null),
        borderColor: CMP_COLORS[i],
        backgroundColor: CMP_COLORS[i] + '22',
        tension: 0.3, pointRadius: 2, spanGaps: true,
      }))
    }
  })() : null

  const barData = result ? {
    labels: result.stats.map(s => s.name),
    datasets: [{
      data: result.stats.map(s => parseFloat(s.avg_litres)),
      backgroundColor: result.stats.map((_, i) => CMP_COLORS[i]),
      borderRadius: 6,
    }]
  } : null

  const chartOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } },
    scales: {
      y: { ticks: { callback: v => v + 'L' }, grid: { color: '#f0ece0' } },
      x: { grid: { display: false }, ticks: { font: { size: 11 } } }
    }
  }

  return (
    <div style={{ animation: 'fadeUp .2s ease' }}>
      <PageHeader title="Compare Cows" sub="Side-by-side analysis — select up to 4 cows">
        <Btn size="sm" onClick={() => setSelected([null, null, null, null])}>Clear all</Btn>
      </PageHeader>

      {/* Picker slots */}
      <div className="flex gap-3 flex-wrap mb-6">
        {[0, 1, 2, 3].map(i => {
          const cow = selected[i] ? cowMap[selected[i]] : null
          return cow ? (
            <div
              key={i}
              className="flex-1 min-w-[180px] max-w-[260px] bg-surface rounded-lg p-3.5 flex items-center gap-2.5 text-[13px]"
              style={{ border: `1.5px solid ${CMP_COLORS[i]}` }}
            >
              <div
                className="w-[30px] h-[30px] rounded-full flex items-center justify-center font-bold text-[11px] flex-shrink-0"
                style={{ background: CMP_COLORS[i] + '22', color: CMP_COLORS[i] }}
              >
                {initials(cow.name)}
              </div>
              <div>
                <div className="font-semibold text-sm">{cow.name}</div>
                <div className="text-xs text-ink-60">{parseFloat(cow.avg_litres || 0).toFixed(1)} L/day</div>
              </div>
              <span
                onClick={() => removeCow(i)}
                className="ml-auto text-base cursor-pointer text-ink-30 hover:text-red transition-colors"
              >✕</span>
            </div>
          ) : (
            <div
              key={i}
              onClick={() => setModalIdx(i)}
              className="flex-1 min-w-[180px] max-w-[260px] bg-surface border-2 border-dashed border-ink-10 rounded-lg p-3.5 flex items-center gap-2.5 cursor-pointer text-[13px] text-ink-60 transition-all hover:text-ink-60"
              style={{ '--hover-color': CMP_COLORS[i] }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = CMP_COLORS[i]; e.currentTarget.style.color = CMP_COLORS[i] }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.color = '' }}
            >
              <span className="text-xl">+</span> Select cow {i + 1}
            </div>
          )
        })}
      </div>

      {!result
        ? <EmptyState>Select at least 2 cows above to compare.</EmptyState>
        : <>
          {/* Avg bars */}
          <Card>
            <CardTitle>Average daily production (L)</CardTitle>
            {result.stats.map((s, i) => {
              const max = Math.max(...result.stats.map(x => parseFloat(x.avg_litres)))
              const pct = max ? Math.round((parseFloat(s.avg_litres) / max) * 100) : 0
              return (
                <div key={s.id} className="flex items-center gap-2.5 mb-2.5">
                  <div className="text-xs font-medium w-[90px] truncate">{s.name}</div>
                  <div className="flex-1 h-5 bg-ink-10 rounded-md overflow-hidden">
                    <div
                      className="h-full rounded-md flex items-center pl-2 text-[11px] font-semibold text-white transition-all duration-500"
                      style={{ width: `${pct}%`, background: CMP_COLORS[i] }}
                    />
                  </div>
                  <div className="text-xs font-semibold min-w-[52px] text-right">
                    {parseFloat(s.avg_litres).toFixed(1)} L
                  </div>
                </div>
              )
            })}
          </Card>

          <div className="grid grid-cols-2 gap-5">
            <Card>
              <CardTitle>Daily production trend</CardTitle>
              <div className="h-[280px] relative">
                {lineData && <Line data={lineData} options={chartOpts} />}
              </div>
            </Card>
            <Card>
              <CardTitle>Production comparison</CardTitle>
              <div className="h-[280px] relative">
                {barData && <Bar data={barData} options={{ ...chartOpts, plugins: { legend: { display: false } } }} />}
              </div>
            </Card>
          </div>

          {/* Stats table */}
          <Card>
            <CardTitle>Head-to-head stats</CardTitle>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr>
                    <th className="text-left px-3 py-2 text-[11px] font-semibold tracking-wider uppercase text-ink-60 border-b border-ink-10">
                      Metric
                    </th>
                    {result.stats.map((s, i) => (
                      <th
                        key={s.id}
                        className="text-left px-3 py-2 text-[11px] font-semibold tracking-wider uppercase border-b border-ink-10"
                        style={{ color: CMP_COLORS[i] }}
                      >
                        {s.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Avg L/day',    s => parseFloat(s.avg_litres).toFixed(2)],
                    ['Total litres', s => parseFloat(s.total_litres).toFixed(1)],
                    ['Max day',      s => parseFloat(s.max_litres).toFixed(1)],
                    ['Min day',      s => parseFloat(s.min_litres).toFixed(1)],
                    ['Std dev',      s => parseFloat(s.stddev_litres || 0).toFixed(2)],
                    ['Records',      s => s.record_count],
                  ].map(([label, fn]) => (
                    <tr key={label} className="hover:bg-cream transition-colors">
                      <td className="px-3 py-2.5 border-b border-ink-10 text-ink-60 font-medium">{label}</td>
                      {result.stats.map(s => (
                        <td key={s.id} className="px-3 py-2.5 border-b border-ink-10 font-medium">{fn(s)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      }

      {modalIdx !== null && (
        <CowPickerModal cows={cows || []} onSelect={pickCow} onClose={() => setModalIdx(null)} />
      )}
    </div>
  )
}