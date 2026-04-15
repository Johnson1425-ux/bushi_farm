import React, { useRef, useState } from 'react'
import { Btn, PageHeader } from '../components/ui'
import { BASE, apiFetch } from '../lib/api'

export default function ImportData({ onImported }) {
  const [log,  setLog]  = useState([])
  const [drag, setDrag] = useState(false)
  const fileRef = useRef()

  const addLog = (type, msg) => setLog(prev => [...prev, { type, msg, id: Date.now() + Math.random() }])

  const uploadFile = async (file) => {
    addLog('info', `Uploading ${file.name}…`)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const token = localStorage.getItem('mt_token')
      const res  = await fetch(`${BASE}/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      const monthInfo = data.detected_month ? ` (${data.detected_month}/${data.detected_year})` : ''
      addLog('ok', `✓ ${file.name}: ${data.added} records saved, ${data.skipped} skipped${monthInfo}`)
      onImported?.()
    } catch (e) {
      addLog('err', `✗ ${file.name}: ${e.message}`)
    }
  }

  const handleFiles = (files) => [...files].forEach(uploadFile)

  const confirmClear = async () => {
    if (!confirm('Delete ALL cows and records from the database?')) return
    try {
      const cows = await apiFetch('/cows')
      for (const c of cows) await apiFetch(`/cows/${c.id}`, { method: 'DELETE' })
      addLog('ok', 'All data cleared.')
      onImported?.()
    } catch (e) {
      addLog('err', 'Error: ' + e.message)
    }
  }

  const logColor = { ok: 'var(--green-600)', err: 'var(--red)', info: 'var(--blue)' }

  return (
    <div style={{ animation: 'fadeUp .2s ease' }}>
      <PageHeader title="Import Data" sub="Upload Excel or CSV — saved directly to PostgreSQL">
        <Btn size="sm" variant="danger" onClick={confirmClear}>Clear all data</Btn>
      </PageHeader>

      <div style={{ background: 'var(--green-50)', border: '1px solid var(--green-100)', borderRadius: 10, padding: '14px 18px', fontSize: 12.5, color: 'var(--green-800)', marginBottom: 18, lineHeight: 1.7 }}>
        <strong>Expected format:</strong> A column named <em>COW</em> (or similar), plus numeric day columns (1–31) for that month's readings.
        Month and year are auto-detected from the filename (e.g. <em>january2025.xlsx</em>). Duplicates are updated automatically.
      </div>

      <div
        onDragOver={e => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files) }}
        onClick={() => fileRef.current.click()}
        style={{
          border: `2px dashed ${drag ? 'var(--green-400)' : 'var(--ink-10)'}`,
          borderRadius: 'var(--radius-lg)',
          padding: '48px 32px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all .2s',
          background: drag ? 'var(--green-50)' : 'var(--surface)',
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
        <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 6 }}>Drop Excel files here</div>
        <div style={{ fontSize: 13, color: 'var(--ink-60)', lineHeight: 1.6 }}>
          or click to browse<br />
          <span style={{ fontSize: 11, color: 'var(--ink-30)' }}>.xlsx · .xls · .csv — multiple files OK</span>
        </div>
      </div>

      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" multiple style={{ display: 'none' }}
        onChange={e => { handleFiles(e.target.files); e.target.value = '' }} />

      {log.length > 0 && (
        <div style={{ background: 'var(--cream-dark)', borderRadius: 8, padding: '12px 16px', fontSize: 12, fontFamily: "'DM Mono',monospace", color: 'var(--ink-60)', maxHeight: 140, overflowY: 'auto', marginTop: 14, lineHeight: 1.8 }}>
          {log.map(l => (
            <div key={l.id} style={{ color: logColor[l.type] }}>{l.msg}</div>
          ))}
        </div>
      )}
    </div>
  )
}