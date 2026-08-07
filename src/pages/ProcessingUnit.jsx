import { useState, useEffect, useCallback, useRef } from 'react'
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { apiFetch, BASE } from '../lib/api'
import { Card, CardTitle, Btn, PageHeader, EmptyState, Spinner } from '../components/ui'
import { useAuth } from '../lib/AuthContext'
import { streamAi } from '../lib/aiApi'
import Markdown from '../components/Markdown'

const fmt = (n, dec = 1) => Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: dec })
const num = (v) => Number(v) || 0

/**
 * Download a file from an authenticated endpoint.
 *
 * A plain <a href> cannot carry the bearer token, so the response is fetched
 * and handed to the browser as a blob instead.
 */
async function downloadAuthed(path, fallbackName) {
  const token = localStorage.getItem('mt_token')
  const res = await fetch(BASE + path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error(e.error || `Download failed (${res.status})`)
  }
  const disposition = res.headers.get('Content-Disposition') || ''
  const match = /filename="?([^"]+)"?/.exec(disposition)
  const url = URL.createObjectURL(await res.blob())
  const a = document.createElement('a')
  a.href = url
  a.download = match ? match[1] : fallbackName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

const TooltipStyle = {
  background: 'var(--surface)', border: '1.5px solid var(--ink-10)',
  borderRadius: 10, fontFamily: "'Outfit', sans-serif",
  fontSize: 12, color: 'var(--ink)',
}

function TabBtn({ label, active, onClick }) {
  return (
    <button onClick={onClick} className="px-4 py-2 text-sm font-medium border-0 bg-transparent cursor-pointer"
      style={{
        color: active ? 'var(--green-600)' : 'var(--ink-60)',
        borderBottom: active ? '2px solid var(--green-600)' : '2px solid transparent',
      }}>{label}</button>
  )
}

function StatBadge({ children, color = 'green' }) {
  const colors = {
    green:  { bg: 'var(--green-100)', text: 'var(--green-800)' },
    amber:  { bg: 'rgba(232,160,32,0.15)', text: 'var(--amber)' },
    red:    { bg: 'rgba(217,64,64,0.1)', text: 'var(--red)' },
    blue:   { bg: 'rgba(52,120,200,0.1)', text: 'var(--blue)' },
    ink:    { bg: 'var(--ink-10)', text: 'var(--ink-60)' },
  }
  const c = colors[color] || colors.ink
  return (
    <span className="inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
      style={{ background: c.bg, color: c.text }}>{children}</span>
  )
}

function UploadSelector({ uploads, selectedId, onSelect, onUploaded, isAdmin }) {
  const [uploading, setUploading] = useState(false)
  const [error,     setError]     = useState(null)
  const [issues,    setIssues]    = useState([])
  const [warnings,  setWarnings]  = useState([])
  const [imported,  setImported]  = useState([])
  const fileRef = useRef()

  const doUpload = async (file) => {
    setUploading(true); setError(null); setIssues([]); setWarnings([]); setImported([])
    try {
      const fd = new FormData()
      fd.append('file', file)
      const token = localStorage.getItem('mt_token')
      const res  = await fetch(`${BASE}/processing/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) {
        // A 422 from the parser carries a list of specific problems to fix.
        if (data.issues?.length) setIssues(data.issues)
        if (data.warnings?.length) setWarnings(data.warnings)
        throw new Error(data.error || 'Upload failed')
      }
      // Warnings do not block the import, so they stay on screen next to the
      // months that were brought in — they are usually about one of them.
      if (data.warnings?.length) setWarnings(data.warnings)
      setImported(data.months || [])
      onUploaded?.(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setUploading(false)
    }
  }

  const downloadTemplate = async () => {
    setError(null)
    try {
      await downloadAuthed('/processing/template', 'MilkTrack_Processing.xlsx')
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="flex flex-wrap items-start gap-3">
      {uploads.length > 0 && (
        <select
          value={selectedId || ''}
          onChange={e => onSelect(e.target.value)}
          style={{ minWidth: 160 }}
        >
          <option value="">Select period…</option>
          {uploads.map(u => (
            <option key={u.id} value={u.id}>{u.label}</option>
          ))}
        </select>
      )}
      {isAdmin && (
        <div>
          <div className="flex items-center gap-2">
            <Btn size="sm" onClick={downloadTemplate}>↓ Template</Btn>
            <Btn size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? 'Uploading…' : '↑ Upload Excel'}
            </Btn>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden
              onChange={e => { const f = e.target.files[0]; if (f) doUpload(f); e.target.value = '' }} />
          </div>
          {error && <div className="text-xs mt-1" style={{ color: 'var(--red)' }}>✗ {error}</div>}
          {imported.length > 0 && (
            <div className="text-xs mt-1" style={{ color: 'var(--green-600)', maxWidth: 380 }}>
              {imported.map((m, i) => (
                <div key={i}>
                  ✓ {m.label} — {fmt(m.summary.packed_units, 0)} packed, {fmt(m.summary.issued_units, 0)} issued,
                  {' '}{fmt(m.summary.damaged_units, 0)} damaged
                </div>
              ))}
            </div>
          )}
          {issues.length > 0 && (
            <div className="text-xs mt-1" style={{ color: 'var(--red)', maxWidth: 420 }}>
              <div className="font-semibold mb-0.5">Fix these and re-upload:</div>
              {issues.map((it, i) => <div key={i}>• {it}</div>)}
            </div>
          )}
          {warnings.length > 0 && (
            <div className="text-xs mt-1" style={{ color: 'var(--amber)', maxWidth: 420 }}>
              <div className="font-semibold mb-0.5">Worth checking against the sheet:</div>
              {warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Streamed AI report for the selected month.
 *
 * Kept on this page rather than only under AI Reports because the reading
 * this report gives — yield, damage rate, whether the stock balance holds —
 * is only useful next to the figures it is drawn from.
 */
function ProcessingReport({ label }) {
  const [text,    setText]    = useState('')
  const [running, setRunning] = useState(false)
  const [error,   setError]   = useState(null)
  const abortRef = useRef(null)

  // A report belongs to the month it was generated for; switching months
  // must not leave the previous month's text sitting under the new heading.
  useEffect(() => {
    abortRef.current?.()
    abortRef.current = null
    setText(''); setError(null); setRunning(false)
  }, [label])

  useEffect(() => () => abortRef.current?.(), [])

  const generate = () => {
    setText(''); setError(null); setRunning(true)
    abortRef.current = streamAi('/ai/reports/processing', { month: label }, {
      onDelta: (t) => setText(prev => prev + t),
      onDone:  () => { setRunning(false); abortRef.current = null },
      onError: (e) => { setError(e.error); setRunning(false); abortRef.current = null },
    })
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <CardTitle>AI review — {label}</CardTitle>
        {running
          ? <Btn size="sm" onClick={() => { abortRef.current?.(); setRunning(false) }}>Stop</Btn>
          : <Btn size="sm" variant="primary" onClick={generate}>{text ? 'Regenerate' : 'Generate'}</Btn>}
      </div>
      {error && <div className="text-xs mb-2" style={{ color: 'var(--red)' }}>✗ {error}</div>}
      {!text && !running && !error && (
        <p className="text-sm" style={{ color: 'var(--ink-60)' }}>
          Reconciles milk taken in against packs produced, weighs the write-offs, and checks
          whether the closing stock for this month adds up.
        </p>
      )}
      {running && !text && <Spinner />}
      {text && <Markdown text={text} />}
    </Card>
  )
}

export default function ProcessingUnit() {
  const { user } = useAuth()
  const isAdmin  = user?.role === 'admin'

  const [uploads,    setUploads]    = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [data,       setData]       = useState(null)
  const [loading,    setLoading]    = useState(false)
  const [tab,        setTab]        = useState('overview')

  const loadUploads = useCallback(async () => {
    try {
      const list = await apiFetch('/processing')
      if (Array.isArray(list)) {
        setUploads(list)
        if (!selectedId && list.length) setSelectedId(String(list[0].id))
      }
    } catch (_) {}
  }, [selectedId])

  useEffect(() => { loadUploads() }, [user])

  useEffect(() => {
    if (!selectedId) { setData(null); return }
    setLoading(true); setData(null)
    apiFetch(`/processing/${selectedId}`)
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [selectedId])

  const handleUploaded = (result) => {
    loadUploads()
    setSelectedId(String(result.upload_id))
    setTab('overview')
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this upload and all its data?')) return
    await apiFetch(`/processing/${id}`, { method: 'DELETE' })
    setUploads(prev => prev.filter(u => String(u.id) !== String(id)))
    if (String(id) === selectedId) { setSelectedId(null); setData(null) }
  }

  /* ── derived stats ──
     Yield is the figure that actually says whether the unit ran well: the
     litres that came back out as sealed packs against the litres available
     to it, carried-in milk included. Litres for packs are derived from the
     pack size on import, so they cannot drift from the unit counts. */
  const stats = data ? (() => {
    const sum = (arr, key) => (arr || []).reduce((a, r) => a + num(r[key]), 0)
    const farm         = sum(data.received, 'farm_litres') + sum(data.received, 'mwabulugu_litres')
    const purchased    = sum(data.received, 'purchased_litres')
    const openingFresh = num(data.upload?.opening_fresh_litres)
    const available    = farm + purchased + openingFresh
    const packedUnits  = sum(data.packed,  'units')
    const packedL      = sum(data.packed,  'litres')
    const issuedUnits  = sum(data.issued,  'units')
    const damagedUnits = sum(data.damaged, 'units')
    const stockUnits   = sum(data.stock,   'units')
    /* The month total lives on the upload row; the per-day damaged_litres in
       `received` is the same loss broken out by date, so only one is summed. */
    const freshDamaged = num(data.upload?.fresh_damage_litres)
    const pct = (part, whole) => (whole > 0 ? ((part / whole) * 100).toFixed(1) + '%' : '—')
    return {
      farm, purchased, openingFresh, available,
      packedUnits, packedL, issuedUnits, damagedUnits, stockUnits, freshDamaged,
      yieldPct: pct(packedL, available),
      damagePct: pct(damagedUnits, packedUnits),
      negativeLines: (data.stock || []).filter(s => num(s.units) < 0),
    }
  })() : null

  // ── chart data ──
  const receivedChart = (data?.received || []).map(r => ({
    day: `D${r.day}`,
    Farm: num(r.farm_litres) + num(r.mwabulugu_litres),
    Purchased: num(r.purchased_litres),
  }))

  const productionChart = (() => {
    if (!data) return []
    const pm = {}, im = {}
    data.packed.forEach(r => { pm[r.day] = (pm[r.day] || 0) + (parseInt(r.units) || 0) })
    data.issued.forEach(r => { im[r.day] = (im[r.day] || 0) + (parseInt(r.units) || 0) })
    const days = [...new Set([...Object.keys(pm), ...Object.keys(im)])].sort((a, b) => a - b)
    return days.map(d => ({ day: `D${d}`, Packed: pm[d] || 0, Issued: im[d] || 0 }))
  })()

  const stockChart = (data?.stock || [])
    .filter(s => s.units > 0)
    .sort((a, b) => b.units - a.units)
    .map(s => ({ name: `${s.product} ${s.size}`, units: parseInt(s.units) }))

  const productBreakdown = (() => {
    if (!data) return []
    const map = {}
    const key = r => `${r.product}||${r.size}`
    data.packed.forEach(r => {
      if (!map[key(r)]) map[key(r)] = { product: r.product, size: r.size, packed: 0, packedL: 0, issued: 0, damaged: 0, stock: null }
      map[key(r)].packed += parseInt(r.units) || 0
      map[key(r)].packedL += parseFloat(r.litres) || 0
    })
    data.issued.forEach(r => {
      if (!map[key(r)]) map[key(r)] = { product: r.product, size: r.size, packed: 0, packedL: 0, issued: 0, damaged: 0, stock: null }
      map[key(r)].issued += parseInt(r.units) || 0
    })
    ;(data.damaged || []).forEach(r => {
      if (!map[key(r)]) map[key(r)] = { product: r.product, size: r.size, packed: 0, packedL: 0, issued: 0, damaged: 0, stock: null }
      map[key(r)].damaged += parseInt(r.units) || 0
    })
    data.stock.forEach(r => {
      if (map[key(r)]) map[key(r)].stock = parseInt(r.units) || 0
    })
    return Object.values(map).sort((a, b) => b.packed - a.packed)
  })()

  const TH = ({ children }) => (
    <th className="text-left px-5 py-3 text-[11px] font-semibold tracking-wider uppercase border-b"
      style={{ color: 'var(--ink-60)', borderColor: 'var(--ink-10)' }}>{children}</th>
  )
  const TR = ({ children, i }) => (
    <tr style={{ transition: 'background 0.15s' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--cream)'}
      onMouseLeave={e => e.currentTarget.style.background = ''}>{children}</tr>
  )
  const TD = ({ children, mono }) => (
    <td className="px-5 py-3 border-b text-[13px]"
      style={{ borderColor: 'var(--ink-10)', color: mono ? 'var(--ink-60)' : 'var(--ink)', fontFamily: mono ? "'DM Mono', monospace" : 'inherit', fontSize: mono ? 12 : 13 }}>
      {children}
    </td>
  )

  return (
    <div style={{ animation: 'fadeUp .2s ease' }}>
      <PageHeader title="Processing Unit" sub="Milk processing, packaging and stock management">
        <UploadSelector
          uploads={uploads}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onUploaded={handleUploaded}
          isAdmin={isAdmin}
        />
      </PageHeader>

      {/* Tabs */}
      <div className="flex mb-5" style={{ borderBottom: '1px solid var(--ink-10)' }}>
        {[['overview','Overview'], ['production','Production'], ['stock','Stock'], ['damage','Damage'], ['uploads','Uploads']].map(([v, l]) => (
          <TabBtn key={v} label={l} active={tab === v} onClick={() => setTab(v)} />
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-16 text-sm" style={{ color: 'var(--ink-30)' }}>Loading…</div>
      )}

      {/* No data */}
      {!selectedId && !loading && tab !== 'uploads' && (
        <EmptyState>
          {isAdmin ? 'Upload a monthly Excel file to get started.' : 'No processing data available yet.'}
        </EmptyState>
      )}

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && data && !loading && (
        <div>
          {/* A line closing below zero cannot be stock — more was issued or
              written off than was ever made, so it is a counting error on the
              source sheet. Surfaced here because it invalidates the balance
              above it, and would otherwise only show on the Stock tab. */}
          {stats.negativeLines.length > 0 && (
            <div className="rounded-lg border p-3 mb-4 text-[13px]"
              style={{ background: 'rgba(217,64,64,0.06)', borderColor: 'var(--red)', color: 'var(--ink)' }}>
              <div className="font-semibold mb-1" style={{ color: 'var(--red)' }}>
                {stats.negativeLines.length === 1
                  ? 'One product closes below zero'
                  : `${stats.negativeLines.length} products close below zero`}
              </div>
              <div style={{ color: 'var(--ink-60)' }}>
                More was issued or written off than was ever produced, so the figures for{' '}
                {stats.negativeLines.map(s => `${s.product} ${s.size} (${fmt(s.units, 0)})`).join(', ')}
                {' '}need checking against the original sheet.
              </div>
            </div>
          )}

          {data.upload?.source === 'legacy' && (
            <div className="text-xs mb-4" style={{ color: 'var(--ink-60)' }}>
              Read from the farm's own workbook layout. Litres are worked out from the pack
              size rather than taken from the sheet's own litres columns.
            </div>
          )}

          {/* KPI strip */}
          <div className="grid gap-3.5 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
            {[
              { label: 'Farm Milk',       value: fmt(stats.farm),           unit: 'L',     color: 'var(--green-600)' },
              { label: 'Purchased Milk',  value: fmt(stats.purchased),      unit: 'L',     color: 'var(--ink-60)' },
              { label: 'Carried In',      value: fmt(stats.openingFresh),   unit: 'L',     color: 'var(--ink-60)' },
              { label: 'Packed (units)',  value: fmt(stats.packedUnits, 0), unit: 'units', color: 'var(--amber)' },
              { label: 'Packed (litres)', value: fmt(stats.packedL),        unit: 'L',     color: 'var(--amber)' },
              { label: 'Yield',           value: stats.yieldPct,                           color: 'var(--green-600)' },
              { label: 'Issued (units)',  value: fmt(stats.issuedUnits, 0), unit: 'units', color: 'var(--blue)' },
              { label: 'Damaged (units)', value: fmt(stats.damagedUnits, 0), unit: 'units', color: 'var(--red)' },
              { label: 'Damage Rate',     value: stats.damagePct,                          color: 'var(--red)' },
              { label: 'Fresh Milk Lost', value: fmt(stats.freshDamaged),   unit: 'L',     color: 'var(--red)' },
              { label: 'Stock Balance',   value: fmt(stats.stockUnits, 0),  unit: 'units', color: 'var(--green-400)' },
            ].map(k => (
              <div key={k.label} className="rounded-lg border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--ink-10)' }}>
                <div className="text-[11px] uppercase tracking-wider font-medium mb-1" style={{ color: 'var(--ink-60)' }}>{k.label}</div>
                <div className="font-semibold" style={{ fontSize: 22, color: k.color, lineHeight: 1.2 }}>
                  {k.value}
                  {k.unit && <span className="text-xs font-normal ml-1" style={{ color: 'var(--ink-60)' }}>{k.unit}</span>}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-5">
            <Card>
              <CardTitle>Daily Milk Received (L)</CardTitle>
              {receivedChart.length ? (
                <div style={{ height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={receivedChart} barSize={14}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--ink-10)" />
                      <XAxis dataKey="day" tick={{ fill: 'var(--ink-60)', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: 'var(--ink-60)', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={TooltipStyle} cursor={{ fill: 'var(--cream-dark)' }} />
                      <Legend wrapperStyle={{ fontSize: 12, color: 'var(--ink-60)' }} />
                      <Bar dataKey="Farm" fill="var(--green-400)" radius={[4,4,0,0]} />
                      <Bar dataKey="Purchased" fill="var(--blue)" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <EmptyState>No received data.</EmptyState>}
            </Card>

            <Card>
              <CardTitle>Packed vs Issued — Daily Units</CardTitle>
              {productionChart.length ? (
                <div style={{ height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={productionChart} barSize={12}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--ink-10)" />
                      <XAxis dataKey="day" tick={{ fill: 'var(--ink-60)', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: 'var(--ink-60)', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={TooltipStyle} cursor={{ fill: 'var(--cream-dark)' }} />
                      <Legend wrapperStyle={{ fontSize: 12, color: 'var(--ink-60)' }} />
                      <Bar dataKey="Packed" fill="var(--amber)" radius={[4,4,0,0]} />
                      <Bar dataKey="Issued" fill="var(--green-400)" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <EmptyState>No production data.</EmptyState>}
            </Card>
          </div>

          {isAdmin && data.upload?.label && <ProcessingReport label={data.upload.label} />}
        </div>
      )}

      {/* ── PRODUCTION ── */}
      {tab === 'production' && data && !loading && (
        <Card noPad>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <TH>Product</TH><TH>Size</TH>
                <TH>Packed (units)</TH><TH>Packed (L)</TH><TH>Issued</TH><TH>Damaged</TH><TH>Stock</TH>
              </tr>
            </thead>
            <tbody>
              {productBreakdown.length === 0 && (
                <tr><td colSpan={7}><EmptyState>No data.</EmptyState></td></tr>
              )}
              {productBreakdown.map((row, i) => {
                const s  = row.stock
                const sc = s === null ? 'ink' : s > 400 ? 'green' : s > 100 ? 'amber' : 'red'
                return (
                  <TR key={i} i={i}>
                    <TD>{row.product}</TD>
                    <TD mono>{row.size}</TD>
                    <td className="px-5 py-3 border-b" style={{ borderColor: 'var(--ink-10)' }}>
                      <StatBadge color="amber">{row.packed}</StatBadge>
                    </td>
                    <TD mono>{row.packedL ? fmt(row.packedL) : '—'}</TD>
                    <td className="px-5 py-3 border-b" style={{ borderColor: 'var(--ink-10)' }}>
                      <StatBadge color="blue">{row.issued}</StatBadge>
                    </td>
                    <td className="px-5 py-3 border-b" style={{ borderColor: 'var(--ink-10)' }}>
                      {row.damaged > 0 ? <StatBadge color="red">{row.damaged}</StatBadge> : <span style={{ color: 'var(--ink-30)' }}>—</span>}
                    </td>
                    <td className="px-5 py-3 border-b" style={{ borderColor: 'var(--ink-10)' }}>
                      <StatBadge color={sc}>{s ?? '—'}</StatBadge>
                    </td>
                  </TR>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* ── STOCK ── */}
      {tab === 'stock' && data && !loading && (
        <div>
          <Card>
            <CardTitle>Closing Stock by Product</CardTitle>
            {stockChart.length ? (
              <div style={{ height: Math.max(stockChart.length * 36, 180) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stockChart} layout="vertical" barSize={14}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--ink-10)" horizontal={false} />
                    <XAxis type="number" tick={{ fill: 'var(--ink-60)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={160}
                      tick={{ fill: 'var(--ink)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={TooltipStyle} cursor={{ fill: 'var(--cream-dark)' }} />
                    <Bar dataKey="units" fill="var(--green-400)" radius={[0,4,4,0]} name="Units in Stock" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <EmptyState>No stock data.</EmptyState>}
          </Card>

          {/* The full working, not just the answer: a balance nobody can
              trace back to its movements is a balance nobody trusts. */}
          <Card noPad>
            <div className="px-5 pt-4 pb-1">
              <CardTitle>Stock Reconciliation</CardTitle>
              <p className="text-xs mb-2" style={{ color: 'var(--ink-60)' }}>
                Opening + packed − issued − damaged. Litres follow from the pack size.
              </p>
            </div>
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  <TH>Product</TH><TH>Size</TH><TH>Opening</TH><TH>Packed</TH>
                  <TH>Issued</TH><TH>Damaged</TH><TH>Closing</TH><TH>Closing (L)</TH>
                </tr>
              </thead>
              <tbody>
                {(data.stock || []).length === 0 && (
                  <tr><td colSpan={8}><EmptyState>No stock data.</EmptyState></td></tr>
                )}
                {(data.stock || []).map((s, i) => {
                  const closing = num(s.units)
                  // Below zero is not a low balance, it is an impossible one.
                  const sc = closing < 0 ? 'red' : closing > 400 ? 'green' : closing > 100 ? 'amber' : 'ink'
                  return (
                    <TR key={i} i={i}>
                      <TD>{s.product}</TD>
                      <TD mono>{s.size}</TD>
                      <TD mono>{fmt(s.opening_units, 0)}</TD>
                      <TD mono>{fmt(s.packed_units, 0)}</TD>
                      <TD mono>{fmt(s.issued_units, 0)}</TD>
                      <TD mono>{num(s.damaged_units) > 0 ? fmt(s.damaged_units, 0) : '—'}</TD>
                      <td className="px-5 py-3 border-b" style={{ borderColor: 'var(--ink-10)' }}>
                        <StatBadge color={sc}>{fmt(closing, 0)}</StatBadge>
                      </td>
                      <TD mono>{fmt(s.litres)}</TD>
                    </TR>
                  )
                })}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* ── DAMAGE ── */}
      {tab === 'damage' && data && !loading && (
        <div>
          <Card noPad>
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr><TH>Product</TH><TH>Size</TH><TH>Damaged (units)</TH></tr>
              </thead>
              <tbody>
                {(!data.damaged || data.damaged.length === 0) && (
                  <tr><td colSpan={3}><EmptyState>No damaged stock recorded for this period.</EmptyState></td></tr>
                )}
                {(() => {
                  const map = {}
                  ;(data.damaged || []).forEach(r => {
                    const k = `${r.product}||${r.size}`
                    map[k] = map[k] || { product: r.product, size: r.size, units: 0 }
                    map[k].units += parseInt(r.units) || 0
                  })
                  return Object.values(map).sort((a, b) => b.units - a.units).map((row, i) => (
                    <TR key={i} i={i}>
                      <TD>{row.product}</TD>
                      <TD mono>{row.size}</TD>
                      <td className="px-5 py-3 border-b" style={{ borderColor: 'var(--ink-10)' }}>
                        <StatBadge color="red">{row.units}</StatBadge>
                      </td>
                    </TR>
                  ))
                })()}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* ── UPLOADS ── */}
      {tab === 'uploads' && (
        <div>
          {isAdmin && (
            <Card>
              <CardTitle>Upload New Period</CardTitle>
              <p className="text-sm mb-2" style={{ color: 'var(--ink-60)' }}>
                Two layouts work. <strong>Download template</strong> gives a blank workbook with a
                sheet per month covering opening balance, milk received, packed, issued, damaged
                and fresh milk lost — fill the yellow cells and upload it back.
              </p>
              <p className="text-sm mb-4" style={{ color: 'var(--ink-60)' }}>
                The farm's own <code style={{ fontFamily: "'DM Mono', monospace", background: 'var(--cream-dark)', padding: '1px 6px', borderRadius: 4, fontSize: 12 }}>BUSH_PROCESSING_UNIT.xlsx</code>{' '}
                is read as-is: month sheets, their matching "DAMEGE" sheets, and the B/D carry-in
                column. Its SUMMARY sheet is ignored, since everything on it is recalculated here.
                Re-uploading a month replaces it.
              </p>
              <UploadSelector uploads={[]} selectedId={null} onSelect={() => {}} onUploaded={handleUploaded} isAdmin={true} />
            </Card>
          )}

          <Card noPad>
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  <TH>Period</TH><TH>Uploaded</TH>
                  {isAdmin && <TH></TH>}
                </tr>
              </thead>
              <tbody>
                {uploads.length === 0 && (
                  <tr><td colSpan={3}><EmptyState>No uploads yet.</EmptyState></td></tr>
                )}
                {uploads.map((u, i) => (
                  <TR key={u.id} i={i}>
                    <td className="px-5 py-3 border-b" style={{ borderColor: 'var(--ink-10)' }}>
                      <button onClick={() => { setSelectedId(String(u.id)); setTab('overview') }}
                        className="border-0 bg-transparent cursor-pointer font-semibold text-sm"
                        style={{ color: 'var(--green-600)', textDecoration: String(u.id) === selectedId ? 'underline' : 'none' }}>
                        {u.label}
                      </button>
                    </td>
                    <TD mono>{new Date(u.uploaded_at).toLocaleDateString()}</TD>
                    {isAdmin && (
                      <td className="px-5 py-3 border-b" style={{ borderColor: 'var(--ink-10)' }}>
                        <Btn size="sm" variant="danger" onClick={() => handleDelete(u.id)}>Delete</Btn>
                      </td>
                    )}
                  </TR>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </div>
  )
}