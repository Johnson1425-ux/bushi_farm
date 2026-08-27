import React, { useState, useEffect, useCallback } from 'react'
import { apiFetch, initials, statusClass } from '../lib/api'
import { Badge, Btn, EmptyState, PageHeader } from '../components/ui'
import CowHistory from '../components/CowHistory'
import { useAuth } from '../lib/AuthContext'

const today = () => new Date().toISOString().slice(0, 10)

const REASONS = [
  ['dead',   'Died'],
  ['sold',   'Sold'],
  ['culled', 'Culled'],
]
const REASON_LABEL = Object.fromEntries(REASONS)

/**
 * Take a cow out of the herd.
 *
 * Deliberately not a delete: her milk records, health history and breeding
 * history all stay, so the totals for the months she was alive still add up.
 * The dialog says so, because "archive" on its own does not tell anyone
 * whether their history is about to disappear.
 */
function ArchiveDialog({ cow, onClose, onDone }) {
  const [status, setStatus] = useState('dead')
  const [date,   setDate]   = useState(today())
  const [note,   setNote]   = useState('')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState(null)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      await apiFetch(`/cows/${cow.id}/archive`, {
        method: 'POST',
        body: JSON.stringify({ status, date, note }),
      })
      onDone()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(10,30,20,0.55)', backdropFilter: 'blur(4px)' }}
      role="dialog" aria-modal="true" aria-label={`Archive ${cow.name}`}
    >
      <form
        onSubmit={submit}
        className="rounded-[16px] w-full max-w-md p-6"
        style={{ background: 'var(--surface)' }}
      >
        <div className="font-serif text-[20px] mb-1">Archive {cow.name}</div>
        <p className="text-[13px] mb-5" style={{ color: 'var(--ink-60)' }}>
          She leaves the herd list and stops counting toward current averages and alerts.
          Her {cow.record_count} milk records, health history and breeding history are kept,
          so past totals stay correct.
        </p>

        <label className="block text-[12px] font-medium uppercase tracking-[0.4px] mb-1.5" style={{ color: 'var(--ink-60)' }}>
          Reason
        </label>
        <div className="flex gap-2 mb-4">
          {REASONS.map(([value, label]) => (
            <button
              key={value} type="button" onClick={() => setStatus(value)}
              className="px-3.5 py-1.5 rounded-full text-xs font-medium border cursor-pointer transition-all"
              style={status === value
                ? { borderColor: 'var(--green-600)', background: 'var(--green-600)', color: '#fff' }
                : { borderColor: 'var(--ink-10)', background: 'var(--surface)', color: 'var(--ink-60)' }}
            >{label}</button>
          ))}
        </div>

        <label className="block text-[12px] font-medium uppercase tracking-[0.4px] mb-1.5" style={{ color: 'var(--ink-60)' }}>
          Date
        </label>
        <input type="date" value={date} max={today()} onChange={e => setDate(e.target.value)} className="w-full mb-4" />

        <label className="block text-[12px] font-medium uppercase tracking-[0.4px] mb-1.5" style={{ color: 'var(--ink-60)' }}>
          Note <span className="normal-case tracking-normal" style={{ color: 'var(--ink-30)' }}>(optional)</span>
        </label>
        <input
          type="text" value={note} maxLength={500}
          onChange={e => setNote(e.target.value)}
          placeholder="Cause, buyer, or anything worth remembering"
          className="w-full mb-5"
        />

        {error && (
          <div className="rounded-lg text-xs px-3 py-2 mb-3"
            style={{ background: 'rgba(217,64,64,0.1)', color: 'var(--red)', border: '1px solid rgba(217,64,64,0.2)' }}>
            {error}
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <Btn size="sm" onClick={onClose}>Cancel</Btn>
          <Btn size="sm" variant="primary">
            <button type="submit" disabled={saving} className="border-0 bg-transparent text-white cursor-pointer font-medium text-xs">
              {saving ? 'Archiving…' : 'Archive'}
            </button>
          </Btn>
        </div>
      </form>
    </div>
  )
}

export default function Cows({ cows, onChanged }) {
  const { user } = useAuth()
  const canArchive = user?.role === 'admin' || user?.role === 'manager'

  const [sort,   setSort]   = useState('desc')
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [herd,   setHerd]   = useState('active')   // 'active' | 'archived'
  const [archived, setArchived] = useState([])
  const [archiving, setArchiving] = useState(null)

  /* Archived animals are not in the shared cow list — that list is the
     working herd — so this page fetches them when they are asked for. */
  const loadArchived = useCallback(async () => {
    try { setArchived(await apiFetch('/cows?status=archived')) } catch { setArchived([]) }
  }, [])

  useEffect(() => { if (herd === 'archived') loadArchived() }, [herd, loadArchived])

  const restore = async (cow) => {
    if (!confirm(`Bring ${cow.name} back into the herd?`)) return
    try {
      await apiFetch(`/cows/${cow.id}/restore`, { method: 'POST' })
      loadArchived(); onChanged?.()
    } catch (e) { alert(e.message) }
  }

  const source = herd === 'archived' ? archived : (cows || [])

  const overall = cows?.length
    ? cows.reduce((s, c) => s + (parseFloat(c.avg_litres) || 0), 0) / cows.length
    : 0

  const sorted = [...source]
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
        <label className="text-xs text-ink-60 font-medium">Herd</label>
        <select value={herd} onChange={e => setHerd(e.target.value)}>
          <option value="active">In the herd</option>
          <option value="archived">No longer in the herd</option>
        </select>

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
        ? (
          <EmptyState>
            {herd === 'archived'
              ? 'No cows have left the herd yet.'
              : 'No cows match your filters.'}
          </EmptyState>
        )
        : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3.5">
            {sorted.map((c, i) => {
              const cls = statusClass(parseFloat(c.avg_litres) || 0, overall)
              const gone = c.status && c.status !== 'active'
              return (
                <div
                  key={c.id}
                  className="bg-surface border border-ink-10 rounded-lg p-4 transition-all duration-150 relative cursor-default hover:border-green-400 hover:-translate-y-px"
                  /* Muted rather than hidden: she is still part of the record,
                     just no longer part of the herd. */
                  style={gone ? { opacity: 0.72 } : undefined}
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
                  <div className="text-[11px] text-ink-30 mt-1">
                    {c.record_count} days recorded
                    {gone && ' · lifetime'}
                  </div>

                  {gone ? (
                    <div className="mt-2">
                      <span className="inline-block text-[11px] font-medium px-2.5 py-0.5 rounded-full"
                        style={{ background: 'var(--ink-10)', color: 'var(--ink-60)' }}>
                        {REASON_LABEL[c.status] || c.status}{c.archived_at ? ` · ${c.archived_at}` : ''}
                      </span>
                      {c.archived_note && (
                        <div className="text-[11px] mt-1.5" style={{ color: 'var(--ink-30)' }}>{c.archived_note}</div>
                      )}
                      {canArchive && (
                        <button
                          onClick={() => restore(c)}
                          className="mt-2 border-0 bg-transparent cursor-pointer text-[11px] font-medium p-0"
                          style={{ color: 'var(--green-600)' }}
                        >↩ Return to herd</button>
                      )}
                    </div>
                  ) : (
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <Badge cls={cls} />
                      {canArchive && (
                        <button
                          onClick={() => setArchiving(c)}
                          title="She has died, been sold or been culled"
                          className="border-0 bg-transparent cursor-pointer text-[11px] p-0 hover:underline"
                          style={{ color: 'var(--ink-30)' }}
                        >Archive</button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      }

      {archiving && (
        <ArchiveDialog
          cow={archiving}
          onClose={() => setArchiving(null)}
          onDone={() => { setArchiving(null); onChanged?.(); if (herd === 'archived') loadArchived() }}
        />
      )}
    </div>
  )
}