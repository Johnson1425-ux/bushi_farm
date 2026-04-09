import React, { useRef, useState } from 'react'
import { Btn, PageHeader } from '../components/ui'

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
      const res  = await fetch('/api/import', { method: 'POST', body: fd })
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
      const cows = await fetch('/api/cows').then(r => r.json())
      for (const c of cows) await fetch(`/api/cows/${c.id}`, { method: 'DELETE' })
      addLog('ok', 'All data cleared.')
      onImported?.()
    } catch (e) {
      addLog('err', 'Error: ' + e.message)
    }
  }

  const logColor = { ok: 'text-green-600', err: 'text-red', info: 'text-blue' }

  return (
    <div style={{ animation: 'fadeUp .2s ease' }}>
      <PageHeader title="Import Data" sub="Upload Excel or CSV — saved directly to PostgreSQL">
        <Btn size="sm" variant="danger" onClick={confirmClear}>Clear all data</Btn>
      </PageHeader>

      {/* Format hint */}
      <div className="bg-green-50 border border-green-100 rounded-[10px] px-4 py-3.5 text-[12.5px] text-green-800 mb-4 leading-relaxed">
        <strong>Expected format:</strong> A column named <em>COW</em> (or similar), plus numeric day columns (1–31) for that month's readings.
        Month and year are auto-detected from the filename (e.g. <em>january2025.xlsx</em>). Duplicates are updated automatically.
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files) }}
        onClick={() => fileRef.current.click()}
        className={[
          'border-2 border-dashed rounded-lg px-8 py-12 text-center cursor-pointer transition-all duration-200',
          drag ? 'border-green-400 bg-green-50' : 'border-ink-10 bg-surface hover:border-green-200 hover:bg-cream',
        ].join(' ')}
      >
        <div className="text-[40px] mb-3">📂</div>
        <div className="text-[18px] font-medium mb-1.5">Drop Excel files here</div>
        <div className="text-[13px] text-ink-60 leading-relaxed">
          or click to browse<br />
          <span className="text-[11px] text-ink-30">.xlsx · .xls · .csv — multiple files OK</span>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        multiple
        className="hidden"
        onChange={e => { handleFiles(e.target.files); e.target.value = '' }}
      />

      {/* Log */}
      {log.length > 0 && (
        <div className="bg-cream-dark rounded-lg px-4 py-3 text-xs font-mono text-ink-60 max-h-[140px] overflow-y-auto mt-3.5 leading-relaxed">
          {log.map(l => (
            <div key={l.id} className={logColor[l.type]}>{l.msg}</div>
          ))}
        </div>
      )}
    </div>
  )
}