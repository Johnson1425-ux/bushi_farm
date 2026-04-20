import React, { useState } from 'react'
import { initials, statusClass } from '../lib/api'
import { Badge, EmptyState, PageHeader } from '../components/ui'
import CowHistory from '../components/CowHistory'

export default function Cows({ cows }) {
  const [sort,   setSort]   = useState('desc')
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  const overall = cows?.length
    ? cows.reduce((s, c) => s + (parseFloat(c.avg_litres) || 0), 0) / cows.length
    : 0

  const sorted = [...(cows || [])]
    .sort((a, b) => {
      if (sort === 'asc')  return parseFloat(a.avg_litres) - parseFloat(b.avg_litres)
      if (sort === 'name') return a.name.localeCompare(b.name)
      return parseFloat(b.avg_litres) - parseFloat(a.avg_litres)
    })
    .filter(c => {
      if (filter !== 'all' && statusClass(parseFloat(c.avg_litres) || 0, overall) !== filter) return false
      if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })

  return (
    <div style={{ animation: 'fadeUp .2s ease' }}>
      <PageHeader title="All Cows" sub="Individual production profiles" />

      {/* Filters */}
      <div className="flex gap-2.5 flex-wrap items-center mb-4">
        <label className="text-xs text-ink-60 font-medium">Sort</label>
        <select value={sort} onChange={e => setSort(e.target.value)}>
          <option value="desc">Highest avg</option>
          <option value="asc">Lowest avg</option>
          <option value="name">Name A–Z</option>
        </select>

        <label className="text-xs text-ink-60 font-medium">Status</label>
        <select value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">All</option>
          <option value="high">High</option>
          <option value="mid">Average</option>
          <option value="low">Low</option>
        </select>

        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name…"
          className="w-40"
        />
      </div>

      {sorted.length === 0
        ? <EmptyState>No cows match your filters.</EmptyState>
        : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3.5">
            {sorted.map((c, i) => {
              const cls = statusClass(parseFloat(c.avg_litres) || 0, overall)
              return (
                <div
                  key={c.id}
                  className="bg-surface border border-ink-10 rounded-lg p-4 transition-all duration-150 relative cursor-default hover:border-green-400 hover:-translate-y-px"
                >
                  <CowHistory cow={c} />
                  <span className="absolute top-2.5 right-3 text-[11px] font-mono text-ink-30">
                    #{i + 1}
                  </span>
                  <div className="w-9 h-9 rounded-full bg-green-100 text-green-800 flex items-center justify-center font-semibold text-sm mb-2.5">
                    {initials(c.name)}
                  </div>
                  <div className="text-sm font-semibold mb-0.5">{c.name}</div>
                  {c.tag && <div className="text-[11px] text-ink-30 mb-1.5">#{c.tag}</div>}
                  <div className="text-[22px] font-semibold text-green-800">
                    {parseFloat(c.avg_litres || 0).toFixed(1)}
                    <span className="text-[12px] font-light text-ink-60"> L/day</span>
                  </div>
                  <div className="text-[11px] text-ink-30 mt-1">{c.record_count} days recorded</div>
                  <div className="mt-2"><Badge cls={cls} /></div>
                </div>
              )
            })}
          </div>
        )
      }
    </div>
  )
}