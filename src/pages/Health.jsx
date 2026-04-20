import { useState, useEffect } from 'react'
import { apiFetch } from '../lib/api'
import { Card, CardTitle, Btn, PageHeader, EmptyState } from '../components/ui'

const today = () => new Date().toISOString().slice(0, 10)

function Modal({ title, onClose, children }) {
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: 'rgba(10,30,20,0.45)' }}>
      <div className="rounded-[16px] w-full max-w-lg p-7 mx-4 max-h-[90vh] overflow-y-auto" style={{ background: 'var(--surface)' }}>
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

function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} className="px-4 py-2 text-sm font-medium border-0 bg-transparent cursor-pointer transition-all"
      style={{ color: active ? 'var(--green-600)' : 'var(--ink-60)', borderBottom: active ? '2px solid var(--green-600)' : '2px solid transparent' }}>
      {children}
    </button>
  )
}

function TreatmentsPanel({ disease, cows, onClose }) {
  const [treatments, setTreatments] = useState([])
  const [showForm,   setShowForm]   = useState(false)
  const [loading,    setLoading]    = useState(true)

  const fetch_ = async () => {
    const data = await apiFetch(`/diseases/${disease.id}/treatments`)
    setTreatments(data)
    setLoading(false)
  }

  useEffect(() => { fetch_() }, [disease.id])

  const handleAdd = async (e) => {
    e.preventDefault()
    const fd = new FormData(e.target)
    await apiFetch(`/diseases/${disease.id}/treatments`, {
      method: 'POST',
      body: JSON.stringify({
        medicine_name: fd.get('medicine_name'),
        dosage: fd.get('dosage'),
        date: fd.get('date'),
        notes: fd.get('notes'),
      }),
    })
    await fetch_()
    setShowForm(false)
    e.target.reset()
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this treatment?')) return
    await apiFetch(`/treatments/${id}`, { method: 'DELETE' })
    await fetch_()
  }

  return (
    <Modal title={`Treatments — ${disease.name}`} onClose={onClose}>
      {/* Affected cows */}
      {disease.affected_cows?.length > 0 && (
        <div className="rounded-lg px-4 py-3 mb-4 text-sm" style={{ background: 'var(--green-50)', color: 'var(--green-800)' }}>
          🐄 Affected: {disease.affected_cows.map(c => c.name).join(', ')}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Treatment History</div>
        <Btn size="sm" variant="primary" onClick={() => setShowForm(v => !v)}>
          {showForm ? 'Cancel' : '+ Add Treatment'}
        </Btn>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="rounded-lg p-4 mb-4" style={{ background: 'var(--cream-dark)' }}>
          <Field label="Medicine Name" name="medicine_name" required />
          <Field label="Dosage (e.g. 5ml, 2 tablets)" name="dosage" />
          <Field label="Date" name="date" type="date" defaultValue={today()} required />
          <Field label="Notes" name="notes" />
          <div className="flex gap-2 justify-end">
            <Btn size="sm" onClick={() => setShowForm(false)}>Cancel</Btn>
            <Btn size="sm" variant="primary"><button type="submit" className="border-0 bg-transparent text-white cursor-pointer text-xs font-medium">Save</button></Btn>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-4 text-sm" style={{ color: 'var(--ink-30)' }}>Loading…</div>
      ) : treatments.length === 0 ? (
        <EmptyState>No treatments recorded yet.</EmptyState>
      ) : (
        <div className="space-y-2">
          {treatments.map(t => (
            <div key={t.id} className="rounded-lg px-4 py-3 flex items-start justify-between gap-3" style={{ background: 'var(--cream)', border: '1px solid var(--ink-10)' }}>
              <div>
                <div className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{t.medicine_name}</div>
                {t.dosage && <div className="text-xs mt-0.5" style={{ color: 'var(--ink-60)' }}>Dosage: {t.dosage}</div>}
                <div className="text-xs mt-0.5 font-mono" style={{ color: 'var(--ink-30)' }}>{t.date}</div>
                {t.notes && <div className="text-xs mt-1" style={{ color: 'var(--ink-60)' }}>{t.notes}</div>}
              </div>
              <button onClick={() => handleDelete(t.id)} className="border-0 bg-transparent cursor-pointer text-xs hover:opacity-70" style={{ color: 'var(--red)' }}>Delete</button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

export default function Health() {
  const [cows, setCows] = useState([])
  const [diseases,    setDiseases]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [tab,         setTab]         = useState('list')
  const [showModal,   setShowModal]   = useState(false)
  const [editDisease, setEditDisease] = useState(null)
  const [viewTreat,   setViewTreat]   = useState(null)

  const fetchDiseases = async () => {
    const data = await apiFetch('/diseases')
    setDiseases(data)
  }

  useEffect(() => {
    Promise.all([
      fetchDiseases(),
      apiFetch('/cows').then(setCows),
    ]).finally(() => setLoading(false))
  }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    const fd = new FormData(e.target)
    const selected = [...e.target.querySelectorAll('input[name="cow_ids"]:checked')].map(el => parseInt(el.value))
    const body = JSON.stringify({
      name: fd.get('name'),
      description: fd.get('description'),
      date: fd.get('date'),
      cow_ids: selected,
    })
    if (editDisease) {
      await apiFetch(`/diseases/${editDisease.id}`, { method: 'PATCH', body })
    } else {
      await apiFetch('/diseases', { method: 'POST', body })
    }
    await fetchDiseases()
    setShowModal(false); setEditDisease(null)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this disease record?')) return
    await apiFetch(`/diseases/${id}`, { method: 'DELETE' })
    await fetchDiseases()
  }

  if (loading) return <div className="p-8 text-center text-sm" style={{ color: 'var(--ink-30)' }}>Loading…</div>

  return (
    <div style={{ animation: 'fadeUp .2s ease' }}>
      <PageHeader title="Health Records" sub="Track diseases and treatments across your herd">
        <Btn size="sm" variant="primary" onClick={() => { setShowModal(true); setEditDisease(null) }}>+ Record Disease</Btn>
      </PageHeader>

      <div className="flex mb-5" style={{ borderBottom: '1px solid var(--ink-10)' }}>
        <TabBtn active={tab === 'list'}    onClick={() => setTab('list')}>🦠 Disease Records</TabBtn>
        <TabBtn active={tab === 'summary'} onClick={() => setTab('summary')}>📊 Summary</TabBtn>
      </div>

      {/* ── LIST TAB ── */}
      {tab === 'list' && (
        <Card noPad>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                {['Date', 'Disease', 'Affected Cows', 'Treatments', ''].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-[11px] font-semibold tracking-wider uppercase border-b"
                    style={{ color: 'var(--ink-60)', borderColor: 'var(--ink-10)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {diseases.length === 0 && (
                <tr><td colSpan={5}><EmptyState>No disease records yet.</EmptyState></td></tr>
              )}
              {diseases.map(d => (
                <tr key={d.id} style={{ transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--cream)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <td className="px-5 py-3 border-b font-mono text-xs" style={{ color: 'var(--ink-60)', borderColor: 'var(--ink-10)' }}>{d.date}</td>
                  <td className="px-5 py-3 border-b" style={{ borderColor: 'var(--ink-10)' }}>
                    <div className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{d.name}</div>
                    {d.description && <div className="text-xs mt-0.5" style={{ color: 'var(--ink-60)' }}>{d.description}</div>}
                  </td>
                  <td className="px-5 py-3 border-b text-xs" style={{ color: 'var(--ink-60)', borderColor: 'var(--ink-10)' }}>
                    {d.affected_cows?.length > 0 ? d.affected_cows.map(c => c.name).join(', ') : <span style={{ color: 'var(--ink-30)' }}>All herd</span>}
                  </td>
                  <td className="px-5 py-3 border-b" style={{ borderColor: 'var(--ink-10)' }}>
                    <span className="inline-block text-[11px] font-medium px-2.5 py-0.5 rounded-full"
                      style={{ background: 'var(--green-100)', color: 'var(--green-800)' }}>
                      {d.treatment_count} treatment{d.treatment_count !== 1 ? 's' : ''}
                    </span>
                  </td>
                  <td className="px-5 py-3 border-b" style={{ borderColor: 'var(--ink-10)' }}>
                    <div className="flex gap-2">
                      <Btn size="sm" variant="primary" onClick={() => setViewTreat(d)}>Treatments</Btn>
                      <Btn size="sm" onClick={() => { setEditDisease(d); setShowModal(true) }}>Edit</Btn>
                      <Btn size="sm" variant="danger" onClick={() => handleDelete(d.id)}>Delete</Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* ── SUMMARY TAB ── */}
      {tab === 'summary' && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
          {diseases.length === 0
            ? <EmptyState>No disease records yet.</EmptyState>
            : diseases.reduce((acc, d) => {
                const existing = acc.find(a => a.name === d.name)
                if (existing) { existing.count++; existing.treatments += d.treatment_count }
                else acc.push({ name: d.name, count: 1, treatments: d.treatment_count })
                return acc
              }, []).map(s => (
                <div key={s.name} className="rounded-lg p-5 border" style={{ background: 'var(--surface)', borderColor: 'var(--ink-10)' }}>
                  <div className="text-sm font-semibold mb-1" style={{ color: 'var(--ink)' }}>{s.name}</div>
                  <div className="text-[26px] font-bold" style={{ color: 'var(--green-600)' }}>{s.count}</div>
                  <div className="text-xs mt-1" style={{ color: 'var(--ink-60)' }}>{s.count === 1 ? 'outbreak' : 'outbreaks'} · {s.treatments} treatments</div>
                </div>
              ))
          }
        </div>
      )}

      {/* ── ADD/EDIT MODAL ── */}
      {showModal && (
        <Modal title={editDisease ? 'Edit Disease Record' : 'Record Disease'} onClose={() => { setShowModal(false); setEditDisease(null) }}>
          <form onSubmit={handleSave}>
            <Field label="Disease Name" name="name" defaultValue={editDisease?.name} required />
            <Field label="Description / Symptoms" name="description" defaultValue={editDisease?.description} />
            <Field label="Date" name="date" type="date" defaultValue={editDisease?.date || today()} required />
            <Field label="Affected Cows (leave unchecked for whole herd)">
              <div className="rounded-lg p-3 max-h-[180px] overflow-y-auto" style={{ border: '1.5px solid var(--ink-10)', background: 'var(--surface)' }}>
                {cows.map(c => (
                  <label key={c.id} className="flex items-center gap-2 py-1 cursor-pointer text-sm" style={{ color: 'var(--ink)' }}>
                    <input type="checkbox" name="cow_ids" value={c.id}
                      defaultChecked={editDisease?.affected_cows?.some(ac => ac.id === c.id)} />
                    {c.name} {c.tag ? `#${c.tag}` : ''}
                  </label>
                ))}
              </div>
            </Field>
            <div className="flex gap-2 justify-end mt-2">
              <Btn onClick={() => { setShowModal(false); setEditDisease(null) }}>Cancel</Btn>
              <Btn variant="primary"><button type="submit" className="border-0 bg-transparent text-white cursor-pointer text-sm font-medium">{editDisease ? 'Save' : 'Record'}</button></Btn>
            </div>
          </form>
        </Modal>
      )}

      {/* ── TREATMENTS PANEL ── */}
      {viewTreat && <TreatmentsPanel disease={viewTreat} cows={cows} onClose={() => setViewTreat(null)} />}
    </div>
  )
}