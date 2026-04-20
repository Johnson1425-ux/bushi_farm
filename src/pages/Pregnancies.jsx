import { useState, useEffect } from 'react'
import { apiFetch } from '../lib/api'
import { Card, Btn, PageHeader, EmptyState, Badge } from '../components/ui'

const today = () => new Date().toISOString().slice(0, 10)

function Modal({ title, onClose, children }) {
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: 'rgba(10,30,20,0.45)' }}>
      <div className="rounded-[16px] w-full max-w-md p-7 mx-4" style={{ background: 'var(--surface)' }}>
        <div className="flex items-center justify-between mb-5">
          <div className="font-serif text-[18px]" style={{ color: 'var(--ink)' }}>{title}</div>
          <button onClick={onClose} className="border-0 bg-transparent text-xl cursor-pointer p-1 hover:opacity-60" style={{ color: 'var(--ink-30)' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, name, type = 'text', defaultValue, required, children, ...props }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label className="block text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--ink-60)', marginBottom: 6 }}>{label}</label>
      {children ?? <input name={name} type={type} defaultValue={defaultValue ?? ''} required={required} className="w-full" {...props} />}
    </div>
  )
}

function DaysChip({ days, status }) {
  if (status === 'delivered') return <span className="inline-block text-[11px] font-medium px-2.5 py-0.5 rounded-full" style={{ background: 'var(--green-100)', color: 'var(--green-800)' }}>Delivered ✓</span>
  if (status === 'lost')      return <span className="inline-block text-[11px] font-medium px-2.5 py-0.5 rounded-full" style={{ background: 'rgba(217,64,64,0.1)', color: 'var(--red)' }}>Lost</span>
  if (days < 0)  return <span className="inline-block text-[11px] font-medium px-2.5 py-0.5 rounded-full" style={{ background: 'rgba(217,64,64,0.1)', color: 'var(--red)' }}>Overdue {Math.abs(days)}d</span>
  if (days === 0) return <span className="inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full" style={{ background: 'rgba(232,160,32,0.2)', color: 'var(--amber)' }}>Due Today!</span>
  if (days <= 7)  return <span className="inline-block text-[11px] font-medium px-2.5 py-0.5 rounded-full" style={{ background: 'rgba(232,160,32,0.15)', color: 'var(--amber)' }}>{days}d remaining</span>
  return <span className="inline-block text-[11px] font-medium px-2.5 py-0.5 rounded-full" style={{ background: 'var(--green-50)', color: 'var(--green-600)' }}>{days}d remaining</span>
}

export default function Pregnancies({ cows: cowsProp = [] }) {
  const [pregnancies, setPregnancies] = useState([])
  const [cows,        setCows]        = useState(cowsProp)
  const [loading,     setLoading]     = useState(true)
  const [showAdd,     setShowAdd]     = useState(false)
  const [updateModal, setUpdateModal] = useState(null)
  const [filterStatus,setFilterStatus]= useState('active')

  const fetchPregnancies = async () => {
    const data = await apiFetch('/pregnancies')
    setPregnancies(data)
  }

  useEffect(() => {
    const init = async () => {
      await fetchPregnancies()
      if (cowsProp.length === 0) {
        const data = await apiFetch('/cows')
        setCows(data)
      }
    }
    init().finally(() => setLoading(false))
  }, [])

  // Keep in sync if parent re-passes cows
  useEffect(() => { if (cowsProp.length > 0) setCows(cowsProp) }, [cowsProp])

  const calcDueDate = (conceptionDate) => {
    const d = new Date(conceptionDate)
    d.setDate(d.getDate() + 283)
    return d.toISOString().slice(0, 10)
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    const fd = new FormData(e.target)
    const conception_date = fd.get('conception_date')
    await apiFetch('/pregnancies', {
      method: 'POST',
      body: JSON.stringify({
        cow_id: fd.get('cow_id'),
        conception_date,
        expected_due_date: calcDueDate(conception_date),
        notes: fd.get('notes'),
      }),
    })
    await fetchPregnancies()
    setShowAdd(false)
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    const fd = new FormData(e.target)
    await apiFetch(`/pregnancies/${updateModal.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: fd.get('status'),
        actual_birth_date: fd.get('actual_birth_date') || null,
        notes: fd.get('notes'),
      }),
    })
    await fetchPregnancies()
    setUpdateModal(null)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this pregnancy record?')) return
    await apiFetch(`/pregnancies/${id}`, { method: 'DELETE' })
    await fetchPregnancies()
  }

  const filtered = pregnancies.filter(p => filterStatus === 'all' || p.status === filterStatus)

  // Summary stats
  const active    = pregnancies.filter(p => p.status === 'active').length
  const dueSoon   = pregnancies.filter(p => p.status === 'active' && p.days_remaining <= 14 && p.days_remaining >= 0).length
  const delivered = pregnancies.filter(p => p.status === 'delivered').length

  if (loading) return <div className="p-8 text-center text-sm" style={{ color: 'var(--ink-30)' }}>Loading…</div>

  return (
    <div style={{ animation: 'fadeUp .2s ease' }}>
      <PageHeader title="Pregnancies" sub="Track pregnant cows and expected birth dates">
        <Btn size="sm" variant="primary" onClick={() => setShowAdd(true)}>+ Add Pregnancy</Btn>
      </PageHeader>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Active',     value: active,    color: 'var(--green-600)' },
          { label: 'Due ≤14d',  value: dueSoon,   color: 'var(--amber)' },
          { label: 'Delivered', value: delivered,  color: 'var(--blue)' },
        ].map(k => (
          <div key={k.label} className="rounded-lg border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--ink-10)' }}>
            <div className="text-[11px] uppercase tracking-wider font-medium mb-1" style={{ color: 'var(--ink-60)' }}>{k.label}</div>
            <div className="text-[26px] font-semibold" style={{ color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {[['active','Active'],['delivered','Delivered'],['lost','Lost'],['all','All']].map(([v, l]) => (
          <button key={v} onClick={() => setFilterStatus(v)}
            className="px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer"
            style={{
              background: filterStatus === v ? 'var(--green-600)' : 'var(--surface)',
              color: filterStatus === v ? '#fff' : 'var(--ink-60)',
              borderColor: filterStatus === v ? 'var(--green-600)' : 'var(--ink-10)',
            }}>{l}</button>
        ))}
      </div>

      <Card noPad>
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              {['Cow', 'Conception', 'Due Date', 'Status', 'Notes', ''].map(h => (
                <th key={h} className="text-left px-5 py-3 text-[11px] font-semibold tracking-wider uppercase border-b"
                  style={{ color: 'var(--ink-60)', borderColor: 'var(--ink-10)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6}><EmptyState>No pregnancies found.</EmptyState></td></tr>
            )}
            {filtered.map(p => (
              <tr key={p.id} style={{ transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--cream)'}
                onMouseLeave={e => e.currentTarget.style.background = ''}>
                <td className="px-5 py-3 border-b font-semibold" style={{ color: 'var(--ink)', borderColor: 'var(--ink-10)' }}>
                  {p.cow_name}
                  {p.cow_tag && <span className="text-xs ml-1" style={{ color: 'var(--ink-30)' }}>#{p.cow_tag}</span>}
                </td>
                <td className="px-5 py-3 border-b font-mono text-xs" style={{ color: 'var(--ink-60)', borderColor: 'var(--ink-10)' }}>{p.conception_date}</td>
                <td className="px-5 py-3 border-b font-mono text-xs" style={{ color: 'var(--ink-60)', borderColor: 'var(--ink-10)' }}>
                  {p.expected_due_date}
                  {p.actual_birth_date && <div className="text-[10px] mt-0.5" style={{ color: 'var(--green-600)' }}>Born: {p.actual_birth_date}</div>}
                </td>
                <td className="px-5 py-3 border-b" style={{ borderColor: 'var(--ink-10)' }}>
                  <DaysChip days={p.days_remaining} status={p.status} />
                </td>
                <td className="px-5 py-3 border-b text-xs" style={{ color: 'var(--ink-30)', borderColor: 'var(--ink-10)' }}>{p.notes || '—'}</td>
                <td className="px-5 py-3 border-b" style={{ borderColor: 'var(--ink-10)' }}>
                  <div className="flex gap-2">
                    {p.status === 'active' && <Btn size="sm" variant="primary" onClick={() => setUpdateModal(p)}>Update</Btn>}
                    <Btn size="sm" variant="danger" onClick={() => handleDelete(p.id)}>Delete</Btn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* ── ADD PREGNANCY MODAL ── */}
      {showAdd && (
        <Modal title="Add Pregnancy" onClose={() => setShowAdd(false)}>
          <form onSubmit={handleAdd}>
            <Field label="Cow" name="cow_id" required>
              <select name="cow_id" className="w-full" required>
                <option value="">Select a cow…</option>
                {cows.map(c => <option key={c.id} value={c.id}>{c.name} {c.tag ? `#${c.tag}` : ''}</option>)}
              </select>
            </Field>
            <Field label="Conception Date" name="conception_date" type="date" defaultValue={today()} required />
            <div className="text-xs mb-4 rounded-lg px-3 py-2" style={{ background: 'var(--green-50)', color: 'var(--green-800)' }}>
              Expected due date will be calculated automatically (283 days from conception).
            </div>
            <Field label="Notes" name="notes" />
            <div className="flex gap-2 justify-end mt-2">
              <Btn onClick={() => setShowAdd(false)}>Cancel</Btn>
              <Btn variant="primary"><button type="submit" className="border-0 bg-transparent text-white cursor-pointer text-sm font-medium">Add</button></Btn>
            </div>
          </form>
        </Modal>
      )}

      {/* ── UPDATE STATUS MODAL ── */}
      {updateModal && (
        <Modal title={`Update — ${updateModal.cow_name}`} onClose={() => setUpdateModal(null)}>
          <form onSubmit={handleUpdate}>
            <Field label="Status" name="status">
              <select name="status" className="w-full" defaultValue={updateModal.status}>
                <option value="active">Active</option>
                <option value="delivered">Delivered</option>
                <option value="lost">Lost</option>
              </select>
            </Field>
            <Field label="Actual Birth Date (if delivered)" name="actual_birth_date" type="date" defaultValue={updateModal.actual_birth_date || ''} />
            <Field label="Notes" name="notes" defaultValue={updateModal.notes} />
            <div className="flex gap-2 justify-end mt-2">
              <Btn onClick={() => setUpdateModal(null)}>Cancel</Btn>
              <Btn variant="primary"><button type="submit" className="border-0 bg-transparent text-white cursor-pointer text-sm font-medium">Save</button></Btn>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}