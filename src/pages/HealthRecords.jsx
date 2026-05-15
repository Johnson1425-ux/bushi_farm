import { useState, useEffect, useRef } from 'react'
import { apiFetch, BASE } from '../lib/api'
import { Card, CardTitle, Btn, PageHeader, EmptyState } from '../components/ui'

const today = () => new Date().toISOString().slice(0, 10)

function Modal({ title, onClose, children }) {
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: 'rgba(10,30,20,0.45)' }}>
      <div className="rounded-[16px] w-full max-w-2xl p-7 mx-4 max-h-[90vh] overflow-y-auto"
        style={{ background: 'var(--surface)' }}>
        <div className="flex items-center justify-between mb-5">
          <div className="font-serif text-[18px]" style={{ color: 'var(--ink)' }}>{title}</div>
          <button onClick={onClose}
            className="border-0 bg-transparent text-xl cursor-pointer p-1 hover:opacity-60"
            style={{ color: 'var(--ink-30)' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="mb-5">
      <div className="text-[11px] font-semibold uppercase tracking-wider mb-2 pb-1"
        style={{ color: 'var(--green-600)', borderBottom: '1px solid var(--ink-10)' }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function KV({ label, value }) {
  if (!value) return null
  return (
    <div className="flex gap-2 mb-1.5">
      <span className="text-xs w-40 shrink-0" style={{ color: 'var(--ink-60)' }}>{label}</span>
      <span className="text-xs font-medium" style={{ color: 'var(--ink)' }}>{value}</span>
    </div>
  )
}

function RecordDetailModal({ record, onClose }) {
  const cf = Array.isArray(record.clinical_findings) ? record.clinical_findings : []
  const tx = Array.isArray(record.treatments) ? record.treatments : []

  return (
    <Modal title={`Health Record — ${record.cow_name || record.cow_tag || 'Unknown Cow'}`} onClose={onClose}>
      <Section title="Animal Identification">
        <KV label="Cow Tag / ID"       value={record.cow_tag} />
        <KV label="Linked Cow"         value={record.cow_name} />
        <KV label="Breed"              value={record.breed} />
        <KV label="Age"                value={record.age} />
        <KV label="Parity"             value={record.parity} />
        <KV label="Body Weight"        value={record.body_weight} />
        <KV label="Daily Milk Yield"   value={record.daily_milk_yield} />
        <KV label="Days in Milk"       value={record.days_in_milk} />
        <KV label="Exam Date"          value={record.exam_date} />
      </Section>

      <Section title="Vital Signs">
        <KV label="Body Temperature"   value={record.body_temperature} />
        <KV label="Pulse Rate"         value={record.pulse_rate} />
        <KV label="Respiratory Rate"   value={record.respiratory_rate} />
        <KV label="CRT (seconds)"      value={record.crt_seconds} />
        <KV label="Rumino-motility"    value={record.rumino_motility} />
      </Section>

      {(record.present_illness || record.past_history || record.environment) && (
        <Section title="History">
          <KV label="Present Illness"  value={record.present_illness} />
          <KV label="Past History"     value={record.past_history} />
          <KV label="Environment"      value={record.environment} />
          <KV label="System Review"    value={record.system_review} />
        </Section>
      )}

      {cf.length > 0 && (
        <Section title="Clinical Examination Findings">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                {['System', 'Status', 'Observations'].map(h => (
                  <th key={h} className="text-left px-3 py-1.5 text-[10px] uppercase tracking-wider border-b"
                    style={{ color: 'var(--ink-60)', borderColor: 'var(--ink-10)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cf.map((f, i) => (
                <tr key={i}>
                  <td className="px-3 py-1.5 border-b" style={{ borderColor: 'var(--ink-10)', color: 'var(--ink)' }}>{f.system}</td>
                  <td className="px-3 py-1.5 border-b" style={{ borderColor: 'var(--ink-10)' }}>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                      style={{
                        background: f.status === 'Normal' ? 'var(--green-50)' : '#fff0f0',
                        color: f.status === 'Normal' ? 'var(--green-800)' : '#c0392b',
                      }}>
                      {f.status}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 border-b" style={{ borderColor: 'var(--ink-10)', color: 'var(--ink-60)' }}>
                    {f.observations || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      <Section title="Diagnosis">
        <KV label="Tentative Diagnosis" value={record.tentative_diagnosis} />
        <KV label="Final Diagnosis"     value={record.final_diagnosis} />
      </Section>

      {(record.blood_smear || record.pcv || record.bacteriology) && (
        <Section title="Laboratory Results">
          <KV label="Blood Smear"      value={record.blood_smear} />
          <KV label="Buffy Coat"       value={record.buffy_coat} />
          <KV label="PCV"              value={record.pcv} />
          <KV label="Eosinophils"      value={record.eosinophils} />
          <KV label="Basophils"        value={record.basophils} />
          <KV label="Neutrophils"      value={record.neutrophils} />
          <KV label="Bacteriology"     value={record.bacteriology} />
          <KV label="Skin Scrapings"   value={record.skin_scrapings} />
          <KV label="Fecal Sample"     value={record.fecal_sample} />
          <KV label="Findings"         value={record.lab_findings} />
        </Section>
      )}

      {tx.length > 0 && (
        <Section title="Treatments">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                {['Drug / Vaccine', 'Prescription'].map(h => (
                  <th key={h} className="text-left px-3 py-1.5 text-[10px] uppercase tracking-wider border-b"
                    style={{ color: 'var(--ink-60)', borderColor: 'var(--ink-10)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tx.map((t, i) => (
                <tr key={i}>
                  <td className="px-3 py-1.5 border-b font-medium" style={{ borderColor: 'var(--ink-10)', color: 'var(--ink)' }}>{t.drug}</td>
                  <td className="px-3 py-1.5 border-b" style={{ borderColor: 'var(--ink-10)', color: 'var(--ink-60)' }}>{t.prescription}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      <Section title="Compliance">
        <KV label="Milk Withdraw Date" value={record.milk_withdraw_date} />
        <KV label="Attending Vet"      value={record.attending_vet} />
        <KV label="Licence #"          value={record.license_number} />
      </Section>

      <div className="text-[10px] mt-4" style={{ color: 'var(--ink-30)' }}>
        Source: {record.source_filename} · Uploaded: {new Date(record.uploaded_at).toLocaleDateString()}
      </div>
    </Modal>
  )
}

function UploadModal({ cows, onClose, onSuccess }) {
  const [file, setFile]         = useState(null)
  const [cowId, setCowId]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [result, setResult]     = useState(null)
  const inputRef = useRef()

  const handleUpload = async () => {
    if (!file) return setError('Please select a .docx file first.')
    setLoading(true); setError(null); setResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      if (cowId) fd.append('cow_id', cowId)

      // Use raw fetch for multipart (apiFetch wraps JSON)
      const token = localStorage.getItem('mt_token')
      const res = await fetch(
        `${BASE}/health-records/import`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setResult(data)
      onSuccess?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="Upload Health Record (.docx)" onClose={onClose}>
      {!result ? (
        <>
          {/* Drop zone */}
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); setFile(e.dataTransfer.files[0]) }}
            className="rounded-xl border-2 border-dashed cursor-pointer flex flex-col items-center justify-center py-10 mb-4 transition-colors"
            style={{
              borderColor: file ? 'var(--green-600)' : 'var(--ink-20)',
              background: file ? 'var(--green-50)' : 'var(--cream)',
            }}>
            <div className="text-3xl mb-2">{file ? '📄' : '📁'}</div>
            <div className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
              {file ? file.name : 'Click or drag & drop a .docx file here'}
            </div>
            <div className="text-xs mt-1" style={{ color: 'var(--ink-30)' }}>
              Bushi Dairy Farm Individual Health Record form
            </div>
            <input ref={inputRef} type="file" accept=".docx,.doc" className="hidden"
              onChange={e => setFile(e.target.files[0])} />
          </div>

          {/* Cow selector */}
          <div className="mb-4">
            <label className="block text-xs font-medium uppercase tracking-wider mb-1.5"
              style={{ color: 'var(--ink-60)' }}>
              Link to Cow (optional — auto-matched from tag if left blank)
            </label>
            <select className="w-full" value={cowId} onChange={e => setCowId(e.target.value)}>
              <option value="">— Auto-detect from document —</option>
              {cows.map(c => (
                <option key={c.id} value={c.id}>{c.name}{c.tag ? ` #${c.tag}` : ''}</option>
              ))}
            </select>
          </div>

          {error && (
            <div className="rounded-lg px-4 py-3 mb-4 text-sm" style={{ background: '#fff0f0', color: '#c0392b' }}>
              ⚠ {error}
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Btn onClick={onClose}>Cancel</Btn>
            <Btn variant="primary" onClick={handleUpload} disabled={loading}>
              {loading ? 'Parsing…' : '⬆ Upload & Parse'}
            </Btn>
          </div>
        </>
      ) : (
        /* Success state */
        <div>
          <div className="rounded-xl px-5 py-4 mb-5" style={{ background: 'var(--green-50)' }}>
            <div className="text-sm font-semibold mb-1" style={{ color: 'var(--green-800)' }}>
              ✓ Record saved successfully!
            </div>
            {result.record.cow_name && (
              <div className="text-xs" style={{ color: 'var(--green-800)' }}>
                Linked to: <strong>{result.record.cow_name}</strong>
              </div>
            )}
            {result.record.final_diagnosis && (
              <div className="text-xs mt-1" style={{ color: 'var(--green-800)' }}>
                Diagnosis: {result.record.final_diagnosis}
              </div>
            )}
          </div>

          <div className="text-xs mb-4" style={{ color: 'var(--ink-60)' }}>
            <div className="font-semibold mb-1" style={{ color: 'var(--ink)' }}>Fields extracted:</div>
            {Object.entries(result.parsed_fields)
              .filter(([k]) => !['clinical_findings', 'treatments'].includes(k))
              .map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <span className="w-36 shrink-0 capitalize">{k.replace(/_/g, ' ')}:</span>
                  <span style={{ color: 'var(--ink)' }}>{String(v).slice(0, 80)}</span>
                </div>
              ))
            }
          </div>

          <div className="flex justify-end">
            <Btn variant="primary" onClick={onClose}>Done</Btn>
          </div>
        </div>
      )}
    </Modal>
  )
}

export default function HealthRecords() {
  const [records, setRecords]     = useState([])
  const [cows, setCows]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [viewRecord, setViewRecord] = useState(null)
  const [filterCow, setFilterCow] = useState('')
  const [search, setSearch]       = useState('')

  const fetchRecords = async () => {
    const params = filterCow ? `?cow_id=${filterCow}` : ''
    const data = await apiFetch(`/health-records${params}`)
    setRecords(data)
  }

  useEffect(() => {
    Promise.all([
      fetchRecords(),
      apiFetch('/cows').then(setCows),
    ]).finally(() => setLoading(false))
  }, [filterCow])

  const handleDelete = async (id) => {
    if (!confirm('Delete this health record?')) return
    await apiFetch(`/health-records/${id}`, { method: 'DELETE' })
    await fetchRecords()
  }

  const filtered = records.filter(r => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      r.cow_name?.toLowerCase().includes(q) ||
      r.cow_tag?.toLowerCase().includes(q) ||
      r.final_diagnosis?.toLowerCase().includes(q) ||
      r.attending_vet?.toLowerCase().includes(q)
    )
  })

  if (loading) return (
    <div className="p-8 text-center text-sm" style={{ color: 'var(--ink-30)' }}>Loading…</div>
  )

  return (
    <div style={{ animation: 'fadeUp .2s ease' }}>
      <PageHeader title="Individual Health Records" sub="Upload and view per-cow clinical records">
        <Btn size="sm" variant="primary" onClick={() => setShowUpload(true)}>
          ⬆ Upload .docx Record
        </Btn>
      </PageHeader>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <input
          className="flex-1 min-w-[180px]"
          placeholder="Search cow, diagnosis, vet…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select value={filterCow} onChange={e => setFilterCow(e.target.value)} style={{ minWidth: 160 }}>
          <option value="">All cows</option>
          {cows.map(c => (
            <option key={c.id} value={c.id}>{c.name}{c.tag ? ` #${c.tag}` : ''}</option>
          ))}
        </select>
      </div>

      {/* Summary chips */}
      <div className="flex gap-3 mb-5 flex-wrap">
        {[
          { label: 'Total Records', val: records.length },
          { label: 'Cows Covered', val: new Set(records.map(r => r.cow_id).filter(Boolean)).size },
          { label: 'This Month', val: records.filter(r => r.uploaded_at?.slice(0, 7) === today().slice(0, 7)).length },
        ].map(s => (
          <div key={s.label} className="rounded-lg px-4 py-3 border flex flex-col"
            style={{ background: 'var(--surface)', borderColor: 'var(--ink-10)' }}>
            <span className="text-[22px] font-bold" style={{ color: 'var(--green-600)' }}>{s.val}</span>
            <span className="text-xs" style={{ color: 'var(--ink-60)' }}>{s.label}</span>
          </div>
        ))}
      </div>

      <Card noPad>
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              {['Date', 'Cow', 'Tag', 'Diagnosis', 'Vet', 'Source', 'Actions'].map(h => (
                <th key={h} className="text-left px-5 py-3 text-[11px] font-semibold tracking-wider uppercase border-b"
                  style={{ color: 'var(--ink-60)', borderColor: 'var(--ink-10)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7}>
                <EmptyState>
                  No health records yet. Upload a filled .docx form to get started.
                </EmptyState>
              </td></tr>
            )}
            {filtered.map(r => (
              <tr key={r.id}
                style={{ transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--cream)'}
                onMouseLeave={e => e.currentTarget.style.background = ''}>
                <td className="px-5 py-3 border-b font-mono text-xs"
                  style={{ color: 'var(--ink-60)', borderColor: 'var(--ink-10)' }}>
                  {r.exam_date || new Date(r.uploaded_at).toLocaleDateString()}
                </td>
                <td className="px-5 py-3 border-b font-semibold text-sm"
                  style={{ borderColor: 'var(--ink-10)', color: 'var(--ink)' }}>
                  {r.cow_name || <span style={{ color: 'var(--ink-30)' }}>Unlinked</span>}
                </td>
                <td className="px-5 py-3 border-b text-xs"
                  style={{ borderColor: 'var(--ink-10)', color: 'var(--ink-60)' }}>
                  {r.cow_tag || '—'}
                </td>
                <td className="px-5 py-3 border-b"
                  style={{ borderColor: 'var(--ink-10)', maxWidth: 200 }}>
                  {r.final_diagnosis
                    ? <span className="text-xs font-medium" style={{ color: 'var(--ink)' }}>
                        {r.final_diagnosis.slice(0, 60)}{r.final_diagnosis.length > 60 ? '…' : ''}
                      </span>
                    : <span className="text-xs" style={{ color: 'var(--ink-30)' }}>—</span>
                  }
                </td>
                <td className="px-5 py-3 border-b text-xs"
                  style={{ borderColor: 'var(--ink-10)', color: 'var(--ink-60)' }}>
                  {r.attending_vet || '—'}
                </td>
                <td className="px-5 py-3 border-b text-xs"
                  style={{ borderColor: 'var(--ink-10)', color: 'var(--ink-30)' }}>
                  {r.source_filename?.slice(0, 24) || '—'}
                </td>
                <td className="px-5 py-3 border-b"
                  style={{ borderColor: 'var(--ink-10)' }}>
                  <div className="flex gap-2">
                    <Btn size="sm" variant="primary" onClick={() => setViewRecord(r)}>View</Btn>
                    <Btn size="sm" variant="danger" onClick={() => handleDelete(r.id)}>Delete</Btn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {showUpload && (
        <UploadModal
          cows={cows}
          onClose={() => setShowUpload(false)}
          onSuccess={() => { fetchRecords(); }}
        />
      )}

      {viewRecord && (
        <RecordDetailModal
          record={viewRecord}
          onClose={() => setViewRecord(null)}
        />
      )}
    </div>
  )
}