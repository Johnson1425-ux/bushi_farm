import { useState, useEffect, useRef } from 'react'
import { apiFetch, BASE } from '../lib/api'
import { authHeaders } from '../lib/session'
import { Card, CardTitle, Btn, PageHeader, EmptyState } from '../components/ui'
import HealthRecordForm from '../components/HealthRecordForm'
import { useConfirm } from '../lib/ConfirmContext'
import { notify } from '../lib/notify'

const today = () => new Date().toISOString().slice(0, 10)

/**
 * Fetch a .docx from the API and hand it to the browser.
 *
 * The endpoint is behind the same token as the rest of the API, so the
 * file is fetched rather than linked to: a plain <a href> carries no
 * Authorization header and would come back a 401.
 *
 * The server names the file in Content-Disposition — for a saved record
 * that is the cow and the examination date, which is what makes a folder
 * of these searchable — so that name is used when it is there, and
 * `fallback` covers the blank form and any response that omits it.
 */
async function downloadDocx(path, fallback) {
  const res = await fetch(`${BASE}${path}`, { headers: await authHeaders() })
  if (!res.ok) throw new Error('Could not download the document. Try again.')

  const disposition = res.headers.get('content-disposition') || ''
  const named = /filename="?([^"]+)"?/.exec(disposition)?.[1]

  const url = URL.createObjectURL(await res.blob())
  const a = document.createElement('a')
  a.href = url
  a.download = named || fallback
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

const downloadTemplate = () =>
  downloadDocx('/health-records/template', 'Bushi Dairy Farm Individual Health Record.docx')

const downloadRecord = (record) =>
  downloadDocx(`/health-records/${record.id}/document`,
    `Health Record - ${record.cow_name || record.cow_tag || 'Unlinked'}.docx`)

/**
 * The actions on a row, behind a three-dots button.
 *
 * Four buttons abreast crowded the row and made every record shout its
 * options at once; here the row stays readable and the actions are one
 * click away.
 *
 * It closes on a click anywhere else, on Escape, and on choosing
 * something — a menu left open while the page moves under it is worse
 * than no menu. The listener is only attached while it is open, so a
 * table of thirty rows is not thirty listeners.
 */
function RowMenu({ items, busy }) {
  const [open, setOpen] = useState(false)
  const box = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDown = e => { if (!box.current?.contains(e.target)) setOpen(false) }
    const onKey  = e => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={box} className="relative inline-block">
      <button type="button" title="Actions" aria-label="Actions"
        aria-haspopup="menu" aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        disabled={busy}
        className="rounded-lg border cursor-pointer px-2.5 py-1.5 text-sm leading-none transition-colors"
        style={{
          borderColor: 'var(--ink-10)',
          background: open ? 'var(--cream-dark)' : 'var(--surface)',
          color: 'var(--ink-60)',
          opacity: busy ? 0.5 : 1,
        }}>
        {busy ? '…' : '⋯'}
      </button>

      {open && (
        <div role="menu"
          className="absolute right-0 z-50 mt-1 rounded-lg border overflow-hidden"
          style={{
            background: 'var(--surface)', borderColor: 'var(--ink-10)',
            minWidth: 168, boxShadow: '0 8px 24px rgba(10,30,20,0.14)',
          }}>
          {items.map(item => (
            <button key={item.label} type="button" role="menuitem"
              onClick={() => { setOpen(false); item.onClick() }}
              className="w-full text-left px-3.5 py-2 text-[13px] border-0 cursor-pointer flex items-center gap-2.5 transition-colors"
              style={{ background: 'transparent', color: item.danger ? 'var(--red)' : 'var(--ink)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--cream)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <span aria-hidden="true" style={{ width: 14, textAlign: 'center', opacity: 0.75 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * `fill` is for a dialog whose content brings its own footer.
 *
 * Normally the whole dialog scrolls as one. A form long enough to scroll
 * needs its Cancel and Save always reachable, and a bar that sticks to the
 * bottom of a scrolling box reads as floating over the middle of the form
 * — there is always more form below it. So `fill` stops the dialog itself
 * from scrolling and hands its height to the content, which scrolls its
 * own body and pins its own footer beneath it.
 */
function Modal({ title, onClose, wide, fill, children }) {
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(10,30,20,0.45)' }}>
      <div className={`rounded-[16px] w-full ${wide ? 'max-w-4xl' : 'max-w-2xl'} max-h-[90vh] flex flex-col ${fill ? 'overflow-hidden' : 'overflow-y-auto p-7'}`}
        style={{ background: 'var(--surface)' }}>
        <div className={`flex items-center justify-between shrink-0 ${fill ? 'px-7 pt-6 pb-4' : 'mb-5'}`}
          style={fill ? { borderBottom: '1px solid var(--ink-10)' } : undefined}>
          <div className="font-serif text-[18px]" style={{ color: 'var(--ink)' }}>{title}</div>
          <button type="button" onClick={onClose}
            className="border-0 bg-transparent text-xl cursor-pointer p-1 hover:opacity-60"
            style={{ color: 'var(--ink-30)' }}>✕</button>
        </div>
        {fill ? <div className="flex-1 min-h-0 flex flex-col">{children}</div> : children}
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

function RecordDetailModal({ record, onClose, onDownload }) {
  const cf = Array.isArray(record.clinical_findings) ? record.clinical_findings : []
  const tx = Array.isArray(record.treatments) ? record.treatments : []

  return (
    <Modal title={`Health Record — ${record.cow_name || record.cow_tag || 'Unknown Cow'}`} onClose={onClose}>
      <Section title="Animal Identification">
        <KV label="Cow Tag / ID"       value={record.cow_tag} />
        <KV label="Linked Cow"         value={record.cow_name} />
        <KV label="Breed"              value={record.breed} />
        <KV label="Dam"                value={record.dam} />
        <KV label="Sire"               value={record.sire} />
        <KV label="Age"                value={record.age} />
        <KV label="Sex"                value={record.sex} />
        <KV label="Status"             value={record.repro_status} />
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
          <KV label="Major Complaint"  value={record.present_illness} />
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
        <KV label="Significant Findings" value={record.significant_findings} />
        <KV label="Tentative Diagnosis"  value={record.tentative_diagnosis} />
        <KV label="Final Diagnosis"      value={record.final_diagnosis} />
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
        <KV label="Recommendation"     value={record.recommendation} />
        <KV label="Milk Withdraw Date" value={record.milk_withdraw_date} />
        <KV label="Attending Vet"      value={record.attending_vet} />
        <KV label="Licence #"          value={record.license_number} />
      </Section>

      <div className="flex items-center justify-between gap-3 flex-wrap mt-5 pt-4"
        style={{ borderTop: '1px solid var(--ink-10)' }}>
        <div className="text-[10px]" style={{ color: 'var(--ink-30)' }}>
          {record.source_filename
            ? `From ${record.source_filename}`
            : 'Filled in the app'} · Saved {new Date(record.uploaded_at).toLocaleDateString()}
        </div>
        <Btn size="sm" onClick={onDownload}>⬇ Download .docx</Btn>
      </div>
    </Modal>
  )
}

/**
 * The form, in a dialog.
 *
 * Saving is handled here rather than inside the form so the form stays a
 * form — it renders the sheet and hands back what was filled, and where
 * that goes is the page's business.
 */
function RecordFormModal({ record, prefill, cows, onClose, onSaved }) {
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState(null)
  const editing = Boolean(record?.id)

  /* Starting a record from inside one animal's history already says which
     animal it is for, so the form opens with her filled in rather than
     asking again. It is a blank record with her identity on it, not an
     edit: there is no id, so this still saves as new. */
  const opening = record || (prefill
    ? { cow_id: prefill.cow_id ?? '', cow_tag: prefill.cow_tag ?? '' }
    : null)

  const handleSubmit = async (values) => {
    setSaving(true); setError(null)
    try {
      await apiFetch(editing ? `/health-records/${record.id}` : '/health-records', {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify(values),
      })
      await onSaved()
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal wide fill onClose={onClose}
      title={editing ? 'Edit Individual Health Record' : 'New Individual Health Record'}>
      <HealthRecordForm
        record={opening}
        cows={cows}
        onSubmit={handleSubmit}
        onCancel={onClose}
        saving={saving}
        error={error}
      />
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

  const handleTemplate = async () => {
    try { await downloadTemplate() } catch (e) { setError(e.message) }
  }

  const handleUpload = async () => {
    if (!file) return setError('Please select a .docx file first.')
    setLoading(true); setError(null); setResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      if (cowId) fd.append('cow_id', cowId)

      // Use raw fetch for multipart (apiFetch wraps JSON)
      const res = await fetch(
        `${BASE}/health-records/import`,
        { method: 'POST', headers: await authHeaders(), body: fd }
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

          {/* The blank form is generated from the same field list the parser
              reads, so a vet who fills this one gets every field back. */}
          <div className="rounded-lg px-4 py-3 mb-4 text-xs flex items-center justify-between gap-3 flex-wrap"
            style={{ background: 'var(--cream)', color: 'var(--ink-60)' }}>
            <span>Don't have the form? Download the blank one to fill in.</span>
            <Btn size="sm" onClick={handleTemplate}>⬇ Blank form (.docx)</Btn>
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

/** A cow list row and a record row both need this. */
const cowLabel = (c) => c.cow_name || (c.cow_tag ? `Tag ${c.cow_tag}` : 'Unlinked')

/** The key that opens one animal's records, linked or not. */
const cowQuery = (c) =>
  c.cow_id ? `cow_id=${c.cow_id}` : `cow_tag=${encodeURIComponent(c.cow_tag || '')}`

const shortDate = (v) => (v ? String(v).slice(0, 10) : '—')

/* Whether the date on the row is the one the vet wrote. The sheet's date
   is free text, so "last Tuesday" is filed under the day it was saved —
   and the row says so rather than presenting that day as the examination. */
const wroteADate = (r) => /^\d{4}-\d{2}-\d{2}$/.test(String(r.exam_date || '').trim())

const Th = ({ children, className = '' }) => (
  <th className={`text-left px-5 py-3 text-[11px] font-semibold tracking-wider uppercase border-b ${className}`}
    style={{ color: 'var(--ink-60)', borderColor: 'var(--ink-10)' }}>{children}</th>
)

const Td = ({ children, className = '', style = {} }) => (
  <td className={`px-5 py-3 border-b ${className}`}
    style={{ borderColor: 'var(--ink-10)', ...style }}>{children}</td>
)

const HoverRow = ({ children, onClick }) => (
  <tr
    onClick={onClick}
    style={{ transition: 'background 0.15s', cursor: onClick ? 'pointer' : 'default' }}
    onMouseEnter={e => e.currentTarget.style.background = 'var(--cream)'}
    onMouseLeave={e => e.currentTarget.style.background = ''}>
    {children}
  </tr>
)

export default function HealthRecords() {
  const confirm = useConfirm()

  /* The page opens on the animals and steps into one of them. `openCow` is
     which animal is being read, and null means the list. */
  const [herd, setHerd]           = useState([])
  const [openCow, setOpenCow]     = useState(null)
  const [records, setRecords]     = useState([])
  const [cows, setCows]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [loadingRecords, setLoadingRecords] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [viewRecord, setViewRecord] = useState(null)
  const [editRecord, setEditRecord] = useState(null)
  const [busyRecord, setBusyRecord] = useState(null)
  const [search, setSearch]       = useState('')
  const [from, setFrom]           = useState('')
  const [to, setTo]               = useState('')

  const fetchHerd = async () => {
    setHerd(await apiFetch('/health-records/by-cow'))
  }

  useEffect(() => {
    Promise.all([
      fetchHerd(),
      apiFetch('/cows').then(setCows),
    ]).finally(() => setLoading(false))
  }, [])

  /* One animal's records, narrowed to the chosen period. Re-runs when the
     dates change, so the filter is the query rather than a sieve over rows
     already fetched — a cow with years of history should not have to send
     all of it to show one month. */
  useEffect(() => {
    if (!openCow) return
    let cancelled = false
    setLoadingRecords(true)
    const period = [from && `from=${from}`, to && `to=${to}`].filter(Boolean).join('&')
    apiFetch(`/health-records?${cowQuery(openCow)}${period ? `&${period}` : ''}`)
      .then(rows => { if (!cancelled) setRecords(rows) })
      .catch(e => { if (!cancelled) notify.error(e.message) })
      .finally(() => { if (!cancelled) setLoadingRecords(false) })
    return () => { cancelled = true }
  }, [openCow, from, to])

  const enterCow = (c) => { setOpenCow(c); setFrom(''); setTo(''); setRecords([]) }
  const leaveCow = () => { setOpenCow(null); setRecords([]); fetchHerd() }

  /* After a change, both the animal's records and the herd summary behind
     it are stale — the count, the latest diagnosis and the last visit all
     come off the records that just moved. */
  const refresh = async () => {
    await fetchHerd()
    if (!openCow) return
    const period = [from && `from=${from}`, to && `to=${to}`].filter(Boolean).join('&')
    setRecords(await apiFetch(`/health-records?${cowQuery(openCow)}${period ? `&${period}` : ''}`))
  }

  /**
   * Open one record, read or edit.
   *
   * The list carries a summary of each record — enough for the table, and
   * none of the examination. Both the reading view and the form need the
   * whole sheet, so it is fetched here rather than taken from the row.
   */
  const openRecord = async (id, mode) => {
    setBusyRecord(id)
    try {
      const full = await apiFetch(`/health-records/${id}`)
      if (mode === 'edit') setEditRecord(full); else setViewRecord(full)
    } catch (e) {
      notify.error(e.message)
    } finally {
      setBusyRecord(null)
    }
  }

  /**
   * Hand this record to the vet as a Word document.
   *
   * The row carries enough to name the file if the server's own name does
   * not arrive, so this works straight off the list without first fetching
   * the whole record.
   */
  const handleDownload = async (record) => {
    setBusyRecord(record.id)
    try {
      await downloadRecord(record)
    } catch (e) {
      notify.error(e.message)
    } finally {
      setBusyRecord(null)
    }
  }

  const handleDelete = async (id) => {
    const ok = await confirm({
      title: 'Delete health record',
      message: 'The record leaves the cow’s health history.',
      detail: 'This cannot be undone.',
      confirmLabel: 'Delete',
    })
    if (!ok) return
    await apiFetch(`/health-records/${id}`, { method: 'DELETE' })
    await refresh()
    notify.success('Health record deleted.')
  }

  const recordActions = (r) => [
    { label: 'View',     icon: '👁', onClick: () => openRecord(r.id, 'view') },
    { label: 'Edit',     icon: '✎',     onClick: () => openRecord(r.id, 'edit') },
    { label: 'Download', icon: '⬇',     onClick: () => handleDownload(r) },
    { label: 'Delete',   icon: '✕',     onClick: () => handleDelete(r.id), danger: true },
  ]

  const visibleHerd = herd.filter(c => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      c.cow_name?.toLowerCase().includes(q) ||
      c.cow_tag?.toLowerCase().includes(q) ||
      c.latest_diagnosis?.toLowerCase().includes(q) ||
      c.latest_vet?.toLowerCase().includes(q)
    )
  })

  if (loading) return (
    <div className="p-8 text-center text-sm" style={{ color: 'var(--ink-30)' }}>Loading…</div>
  )

  return (
    <div style={{ animation: 'fadeUp .2s ease' }}>
      <PageHeader
        title={openCow ? cowLabel(openCow) : 'Individual Health Records'}
        sub={openCow
          ? `${openCow.record_count} record${openCow.record_count === 1 ? '' : 's'}${openCow.cow_tag ? ` · tag ${openCow.cow_tag}` : ''}`
          : 'The cows with an examination sheet on file'}>
        {openCow
          ? <Btn size="sm" onClick={leaveCow}>← All cows</Btn>
          : <Btn size="sm" onClick={() => setShowUpload(true)}>⬆ Upload .docx</Btn>}
        <Btn size="sm" variant="primary"
          onClick={() => setEditRecord(openCow ? { prefill: openCow } : {})}>
          + New Record
        </Btn>
      </PageHeader>

      {openCow ? (
        /* ── one animal's records ── */
        <>
          <div className="flex gap-3 mb-5 flex-wrap items-end">
            <div>
              <label htmlFor="hr-from" className="block text-[11px] font-medium uppercase tracking-wider mb-1.5"
                style={{ color: 'var(--ink-60)' }}>From</label>
              <input id="hr-from" type="date" value={from} max={to || undefined}
                onChange={e => setFrom(e.target.value)} />
            </div>
            <div>
              <label htmlFor="hr-to" className="block text-[11px] font-medium uppercase tracking-wider mb-1.5"
                style={{ color: 'var(--ink-60)' }}>To</label>
              <input id="hr-to" type="date" value={to} min={from || undefined}
                onChange={e => setTo(e.target.value)} />
            </div>
            {(from || to) && (
              <Btn size="sm" onClick={() => { setFrom(''); setTo('') }}>Clear dates</Btn>
            )}
            <span className="text-[11px] ml-auto" style={{ color: 'var(--ink-30)' }}>
              {loadingRecords
                ? 'Loading…'
                : `${records.length} record${records.length === 1 ? '' : 's'}${from || to ? ' in this period' : ''}`}
            </span>
          </div>

          <Card noPad>
            <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]" style={{ minWidth: 640 }}>
              <thead>
                <tr>
                  {['Date', 'Diagnosis', 'Vet', 'Treatments', 'Source', ''].map((h, i) => (
                    <Th key={i}>{h}</Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!loadingRecords && records.length === 0 && (
                  <tr><td colSpan={6}>
                    <EmptyState>
                      {from || to
                        ? 'No records for this animal in that period.'
                        : 'No records for this animal yet.'}
                    </EmptyState>
                  </td></tr>
                )}
                {records.map(r => (
                  <HoverRow key={r.id}>
                    <Td className="font-mono text-xs" style={{ color: 'var(--ink-60)' }}>
                      {shortDate(r.effective_date)}
                      {!wroteADate(r) && (
                        <span className="ml-1.5 text-[10px]" title={r.exam_date ? `Sheet says "${r.exam_date}"` : 'No date on the sheet'}
                          style={{ color: 'var(--ink-30)' }}>saved</span>
                      )}
                    </Td>
                    <Td style={{ maxWidth: 280 }}>
                      {r.final_diagnosis || r.tentative_diagnosis
                        ? <span className="text-xs font-medium" style={{ color: 'var(--ink)' }}>
                            {(r.final_diagnosis || r.tentative_diagnosis).slice(0, 70)}
                            {(r.final_diagnosis || r.tentative_diagnosis).length > 70 ? '…' : ''}
                          </span>
                        : <span className="text-xs" style={{ color: 'var(--ink-30)' }}>—</span>}
                    </Td>
                    <Td className="text-xs" style={{ color: 'var(--ink-60)' }}>{r.attending_vet || '—'}</Td>
                    <Td className="text-xs" style={{ color: 'var(--ink-60)' }}>{r.treatment_count || 0}</Td>
                    <Td className="text-xs" style={{ color: 'var(--ink-30)' }}>
                      {r.source_filename ? r.source_filename.slice(0, 22) : 'Filled in the app'}
                    </Td>
                    <Td className="text-right">
                      <RowMenu items={recordActions(r)} busy={busyRecord === r.id} />
                    </Td>
                  </HoverRow>
                ))}
              </tbody>
            </table>
            </div>
          </Card>
        </>
      ) : (
        /* ── the animals ── */
        <>
          <div className="flex gap-3 mb-5 flex-wrap">
            <input type="search" className="flex-1 min-w-[180px]"
              placeholder="Search cow, tag, diagnosis, vet…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          <div className="flex gap-3 mb-5 flex-wrap">
            {[
              { label: 'Cows with records', val: herd.length },
              { label: 'Total Records', val: herd.reduce((n, c) => n + c.record_count, 0) },
              { label: 'Seen this month', val: herd.filter(c => shortDate(c.last_exam).slice(0, 7) === today().slice(0, 7)).length },
            ].map(s => (
              <div key={s.label} className="rounded-lg px-4 py-3 border flex flex-col"
                style={{ background: 'var(--surface)', borderColor: 'var(--ink-10)' }}>
                <span className="text-[22px] font-bold" style={{ color: 'var(--green-600)' }}>{s.val}</span>
                <span className="text-xs" style={{ color: 'var(--ink-60)' }}>{s.label}</span>
              </div>
            ))}
          </div>

          <Card noPad>
            <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]" style={{ minWidth: 720 }}>
              <thead>
                <tr>
                  {['Cow', 'Tag', 'Records', 'Last examination', 'Latest diagnosis', 'Vet', ''].map((h, i) => (
                    <Th key={i}>{h}</Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleHerd.length === 0 && (
                  <tr><td colSpan={7}>
                    <EmptyState>
                      {herd.length === 0
                        ? <>No health records yet. Fill one in with <strong>New Record</strong>, or upload a filled .docx form.</>
                        : 'No cow matches that search.'}
                    </EmptyState>
                  </td></tr>
                )}
                {visibleHerd.map(c => (
                  <HoverRow key={c.group_key} onClick={() => enterCow(c)}>
                    <Td className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>
                      {c.cow_name || <span style={{ color: 'var(--ink-30)' }}>Unlinked</span>}
                    </Td>
                    <Td className="text-xs" style={{ color: 'var(--ink-60)' }}>{c.cow_tag || '—'}</Td>
                    <Td>
                      <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium"
                        style={{ background: 'var(--green-50)', color: 'var(--green-800)' }}>
                        {c.record_count}
                      </span>
                    </Td>
                    <Td className="font-mono text-xs" style={{ color: 'var(--ink-60)' }}>{shortDate(c.last_exam)}</Td>
                    <Td style={{ maxWidth: 240 }}>
                      {c.latest_diagnosis
                        ? <span className="text-xs" style={{ color: 'var(--ink)' }}>
                            {c.latest_diagnosis.slice(0, 60)}{c.latest_diagnosis.length > 60 ? '…' : ''}
                          </span>
                        : <span className="text-xs" style={{ color: 'var(--ink-30)' }}>—</span>}
                    </Td>
                    <Td className="text-xs" style={{ color: 'var(--ink-60)' }}>{c.latest_vet || '—'}</Td>
                    <Td className="text-right">
                      <Btn size="sm" variant="primary" onClick={() => enterCow(c)}>View</Btn>
                    </Td>
                  </HoverRow>
                ))}
              </tbody>
            </table>
            </div>
          </Card>
        </>
      )}

      {showUpload && (
        <UploadModal
          cows={cows}
          onClose={() => setShowUpload(false)}
          onSuccess={refresh}
        />
      )}

      {viewRecord && (
        <RecordDetailModal
          record={viewRecord}
          onClose={() => setViewRecord(null)}
          onDownload={() => handleDownload(viewRecord)}
        />
      )}

      {editRecord && (
        <RecordFormModal
          record={editRecord.id ? editRecord : null}
          prefill={editRecord.prefill}
          cows={cows}
          onClose={() => setEditRecord(null)}
          onSaved={refresh}
        />
      )}
    </div>
  )
}
