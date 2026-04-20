import { useState, useEffect } from 'react'
import { apiFetch } from '../lib/api'
import { Btn } from '../components/ui'

const today = () => new Date().toISOString().slice(0, 10)

const EVENT_TYPES = [
  { value: 'purchased',  label: '🛒 Purchased' },
  { value: 'born',       label: '🐄 Born on farm' },
  { value: 'transferred',label: '🔄 Transferred in' },
  { value: 'other',      label: '📝 Other' },
]

export default function CowHistory({ cow }) {
  const [history,  setHistory]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)

  const fetchHistory = async () => {
    const data = await apiFetch(`/cows/${cow.id}/history`)
    setHistory(data)
  }

  useEffect(() => {
    fetchHistory().finally(() => setLoading(false))
  }, [cow.id])

  const handleAdd = async (e) => {
    e.preventDefault()
    const fd = new FormData(e.target)
    await apiFetch(`/cows/${cow.id}/history`, {
      method: 'POST',
      body: JSON.stringify({
        event_type: fd.get('event_type'),
        date:       fd.get('date'),
        source:     fd.get('source'),
        notes:      fd.get('notes'),
      }),
    })
    await fetchHistory()
    setShowForm(false)
    e.target.reset()
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this history entry?')) return
    await apiFetch(`/cow-history/${id}`, { method: 'DELETE' })
    await fetchHistory()
  }

  const eventLabel = (type) => EVENT_TYPES.find(e => e.value === type)?.label || type

  if (loading) return <div className="text-xs py-2" style={{ color: 'var(--ink-30)' }}>Loading history…</div>

  return (
    <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--ink-10)' }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-60)' }}>Farm History</span>
        <Btn size="sm" onClick={() => setShowForm(v => !v)}>{showForm ? 'Cancel' : '+ Add Event'}</Btn>
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleAdd} className="rounded-lg p-3 mb-3" style={{ background: 'var(--cream)', border: '1px solid var(--ink-10)' }}>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--ink-60)' }}>Event</label>
              <select name="event_type" className="w-full" required>
                {EVENT_TYPES.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--ink-60)' }}>Date</label>
              <input type="date" name="date" defaultValue={today()} required className="w-full" />
            </div>
          </div>
          <div className="mb-2">
            <label className="block text-[11px] font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--ink-60)' }}>Source / From</label>
            <input type="text" name="source" placeholder="e.g. Mwanzo Farm, Arusha" className="w-full" />
          </div>
          <div className="mb-3">
            <label className="block text-[11px] font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--ink-60)' }}>Notes</label>
            <input type="text" name="notes" placeholder="Any additional notes" className="w-full" />
          </div>
          <Btn size="sm" variant="primary">
            <button type="submit" className="border-0 bg-transparent text-white cursor-pointer font-medium text-xs">Save Event</button>
          </Btn>
        </form>
      )}

      {/* Timeline */}
      {history.length === 0
        ? <p className="text-xs" style={{ color: 'var(--ink-30)' }}>No history recorded yet.</p>
        : (
          <div className="relative">
            <div className="absolute left-3 top-0 bottom-0 w-px" style={{ background: 'var(--ink-10)' }} />
            {history.map(h => (
              <div key={h.id} className="flex gap-3 mb-3 relative pl-7">
                <div className="absolute left-1.5 top-1.5 w-3 h-3 rounded-full border-2 flex-shrink-0"
                  style={{ background: 'var(--green-400)', borderColor: 'var(--surface)' }} />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>{eventLabel(h.event_type)}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono" style={{ color: 'var(--ink-30)' }}>{h.date}</span>
                      <button onClick={() => handleDelete(h.id)}
                        className="border-0 bg-transparent cursor-pointer text-[11px]" style={{ color: 'var(--ink-30)' }}>✕</button>
                    </div>
                  </div>
                  {h.source && <div className="text-xs mt-0.5" style={{ color: 'var(--ink-60)' }}>From: {h.source}</div>}
                  {h.notes  && <div className="text-xs mt-0.5" style={{ color: 'var(--ink-60)' }}>{h.notes}</div>}
                </div>
              </div>
            ))}
          </div>
        )
      }
    </div>
  )
}