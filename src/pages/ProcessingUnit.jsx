import { useState, useEffect, useCallback, useRef } from 'react'
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { apiFetch, BASE } from '../lib/api'
import { Card, CardTitle, Btn, PageHeader, EmptyState } from '../components/ui'
import { useAuth } from '../lib/AuthContext'

const fmt = (n, dec = 1) => Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: dec })

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
  const [dragging,  setDragging]  = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error,     setError]     = useState(null)
  const [warnings,  setWarnings]  = useState([])
  const fileRef = useRef()

  const doUpload = async (file) => {
    setUploading(true); setError(null); setWarnings([])
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
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      if (data.warnings?.length) setWarnings(data.warnings)
      onUploaded?.(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
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
          <label>
            <Btn size="sm" onClick={() => fileRef.current?.click()}>
              {uploading ? 'Uploading…' : '↑ Upload Excel'}
            </Btn>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden
              onChange={e => { const f = e.target.files[0]; if (f) doUpload(f); e.target.value = '' }} />
          </label>
          {error && <div className="text-xs mt-1" style={{ color: 'var(--red)' }}>✗ {error}</div>}
          {warnings.length > 0 && (
            <div className="text-xs mt-1" style={{ color: 'var(--amber)', maxWidth: 320 }}>
              {warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
            </div>
          )}
        </div>
      )}
    </div>
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

  // ── derived stats ──
  const stats = data ? (() => {
    const sum = (arr, key) => arr.reduce((a, r) => a + (parseFloat(r[key]) || 0), 0)
    const farm        = sum(data.received, 'farm_litres')
    const purchased   = sum(data.received, 'purchased_litres')
    const packedUnits = sum(data.packed,   'units')
    const packedL     = sum(data.packed,   'litres')
    const issuedUnits = sum(data.issued,   'units')
    const damagedUnits = sum(data.damaged || [], 'units')
    const stockUnits  = sum(data.stock,    'units')
    const eff = packedUnits > 0 ? ((issuedUnits / packedUnits) * 100).toFixed(1) + '%' : '—'
    return { farm, purchased, packedUnits, packedL, issuedUnits, damagedUnits, stockUnits, eff }
  })() : null

  // ── chart data ──
  const receivedChart = (data?.received || []).map(r => ({
    day: `D${r.day}`,
    Farm: parseFloat(r.farm_litres) || 0,
    Purchased: parseFloat(r.purchased_litres) || 0,
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
          {/* KPI strip */}
          <div className="grid gap-3.5 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
            {[
              { label: 'Farm Milk',        value: fmt(stats.farm),        unit: 'L',     color: 'var(--green-600)' },
              { label: 'Purchased Milk',   value: fmt(stats.purchased),   unit: 'L',     color: 'var(--ink-60)' },
              { label: 'Packed (units)',   value: fmt(stats.packedUnits, 0), unit: 'units', color: 'var(--amber)' },
              { label: 'Packed (litres)',  value: fmt(stats.packedL),     unit: 'L',     color: 'var(--amber)' },
              { label: 'Issued (units)',   value: fmt(stats.issuedUnits, 0), unit: 'units', color: 'var(--blue)' },
              { label: 'Damaged (units)',  value: fmt(stats.damagedUnits, 0), unit: 'units', color: 'var(--red)' },
              { label: 'Stock Balance',    value: fmt(stats.stockUnits, 0), unit: 'units', color: 'var(--green-400)' },
              { label: 'Distribution Eff',value: stats.eff,                              color: 'var(--red)' },
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

          <Card noPad>
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr><TH>Product</TH><TH>Size</TH><TH>Units in Stock</TH></tr>
              </thead>
              <tbody>
                {data.stock.filter(s => s.units > 0).length === 0 && (
                  <tr><td colSpan={3}><EmptyState>No stock data.</EmptyState></td></tr>
                )}
                {data.stock.filter(s => s.units > 0).map((s, i) => {
                  const u  = parseInt(s.units)
                  const sc = u > 400 ? 'green' : u > 100 ? 'amber' : 'red'
                  return (
                    <TR key={i} i={i}>
                      <TD>{s.product}</TD>
                      <TD mono>{s.size}</TD>
                      <td className="px-5 py-3 border-b" style={{ borderColor: 'var(--ink-10)' }}>
                        <StatBadge color={sc}>{u}</StatBadge>
                      </td>
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
              <p className="text-sm mb-4" style={{ color: 'var(--ink-60)' }}>
                Upload the monthly Excel file (e.g. <code style={{ fontFamily: "'DM Mono', monospace", background: 'var(--cream-dark)', padding: '1px 6px', borderRadius: 4, fontSize: 12 }}>BUSH_PROCESSING_UNIT.xlsx</code>).
                The parser reads milk received, packed, issued, stock, and a matching "DAMEGE" sheet automatically.
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