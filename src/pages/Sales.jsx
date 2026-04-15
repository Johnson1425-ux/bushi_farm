import { useState, useEffect, useRef } from 'react'
import { Bar } from 'react-chartjs-2'
import { Chart, BarElement, CategoryScale, LinearScale, Tooltip } from 'chart.js'
import { apiFetch, BASE } from '../lib/api'
import { Card, CardTitle, Btn, PageHeader, EmptyState } from '../components/ui'

Chart.register(BarElement, CategoryScale, LinearScale, Tooltip)

const fmt    = n => Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })
const fmtTsh = n => `TSh ${fmt(n)}`
const today  = () => new Date().toISOString().slice(0, 10)
const thisMonth = () => new Date().toISOString().slice(0, 7)

function Modal({ title, onClose, children }) {
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: 'rgba(10,30,20,0.45)' }}
    >
      <div className="rounded-[16px] w-full max-w-md p-7 mx-4" style={{ background: 'var(--surface)' }}>
        <div className="flex items-center justify-between mb-5">
          <div className="font-serif text-[18px]" style={{ color: 'var(--ink)' }}>{title}</div>
          <button onClick={onClose} className="border-0 bg-transparent text-[18px] cursor-pointer p-1 leading-none hover:opacity-60" style={{ color: 'var(--ink-30)' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, name, type = 'text', defaultValue, required, ...props }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label className="block text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--ink-60)', marginBottom: 6 }}>{label}</label>
      <input name={name} type={type} defaultValue={defaultValue ?? ''} required={required} className="w-full" {...props} />
    </div>
  )
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 text-sm font-medium border-0 bg-transparent cursor-pointer transition-all"
      style={{
        color: active ? 'var(--green-600)' : 'var(--ink-60)',
        borderBottom: active ? '2px solid var(--green-600)' : '2px solid transparent',
      }}
    >{children}</button>
  )
}

export default function Sales() {
  const [records,      setRecords]      = useState([])
  const [summary,      setSummary]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [tab,          setTab]          = useState('records')
  const [showModal,    setShowModal]    = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [importLoading,setImportLoading]= useState(false)
  const [filterMonth,  setFilterMonth]  = useState(thisMonth())
  const [filterFrom,   setFilterFrom]   = useState('')
  const [filterTo,     setFilterTo]     = useState('')
  const [useMonth,     setUseMonth]     = useState(true)
  const fileRef = useRef()

  const fetchRecords = async () => {
    const params = new URLSearchParams()
    if (useMonth && filterMonth) params.set('month', filterMonth)
    else { if (filterFrom) params.set('from', filterFrom); if (filterTo) params.set('to', filterTo) }
    const data = await apiFetch(`/sales?${params}`)
    setRecords(data)
  }

  const fetchSummary = async () => {
    const data = await apiFetch('/sales/summary')
    setSummary(data)
  }

  useEffect(() => {
    Promise.all([fetchRecords(), fetchSummary()]).finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchRecords() }, [filterMonth, filterFrom, filterTo, useMonth])

  const totalLitres  = records.reduce((s, r) => s + parseFloat(r.litres_sold ?? 0), 0)
  const totalRevenue = records.reduce((s, r) => s + parseFloat(r.total ?? 0), 0)
  const avgPrice     = records.length
    ? records.reduce((s, r) => s + parseFloat(r.price_per_litre ?? 0), 0) / records.length : 0

  const handleSave = async (e) => {
    e.preventDefault()
    const fd = new FormData(e.target)
    await apiFetch('/sales', {
      method: 'POST',
      body: JSON.stringify({
        date:            fd.get('date'),
        litres_sold:     fd.get('litres_sold'),
        price_per_litre: fd.get('price_per_litre'),
        notes:           fd.get('notes'),
      }),
    })
    await Promise.all([fetchRecords(), fetchSummary()])
    setShowModal(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this sale record?')) return
    await apiFetch(`/sales/${id}`, { method: 'DELETE' })
    await Promise.all([fetchRecords(), fetchSummary()])
  }

  const handleImport = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImportLoading(true); setImportResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const token = localStorage.getItem('mt_token')
      const res = await fetch(`${BASE}/sales/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Import failed')
      setImportResult(result)
      await Promise.all([fetchRecords(), fetchSummary()])
    } catch (err) {
      setImportResult({ error: err.message })
    } finally {
      setImportLoading(false); e.target.value = ''
    }
  }

  const chartData = {
    labels: [...summary].reverse().map(s => s.month),
    datasets: [{
      data: [...summary].reverse().map(s => parseFloat(s.total_revenue)),
      backgroundColor: 'var(--green-400)',
      borderRadius: 6,
    }]
  }
  const chartOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: v => fmtTsh(v.raw) } } },
    scales: {
      y: { ticks: { callback: v => `${(v/1000).toFixed(0)}k`, font: { size: 11 } }, grid: { color: 'var(--ink-10)' } },
      x: { grid: { display: false }, ticks: { font: { size: 11 } } },
    }
  }

  if (loading) return <div className="p-8 text-center text-sm" style={{ color: 'var(--ink-30)' }}>Loading…</div>

  return (
    <div style={{ animation: 'fadeUp .2s ease' }}>
      <PageHeader title="Sales Records" sub="Track milk sales and revenue">
        <Btn size="sm" onClick={() => setShowModal(true)}>+ Record Sale</Btn>
        <label>
          <Btn size="sm" className="cursor-pointer" onClick={() => fileRef.current?.click()}>
            {importLoading ? 'Importing…' : '↑ Import Excel'}
          </Btn>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={handleImport} />
        </label>
      </PageHeader>

      {/* Import result */}
      {importResult && (
        <div
          className="rounded-lg text-sm mb-5"
          style={{
            padding: '10px 16px',
            background: importResult.error ? 'rgba(217,64,64,0.1)' : 'var(--green-50)',
            border: `1px solid ${importResult.error ? 'var(--red)' : 'var(--green-100)'}`,
            color: importResult.error ? 'var(--red)' : 'var(--green-800)',
          }}
        >
          {importResult.error ? `✗ ${importResult.error}` : `✓ Imported ${importResult.imported} record(s).`}
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Total Litres Sold', value: `${fmt(totalLitres)} L`,  color: 'var(--blue)' },
          { label: 'Total Revenue',     value: fmtTsh(totalRevenue),      color: 'var(--green-600)' },
          { label: 'Avg Price / Litre', value: fmtTsh(avgPrice),          color: 'var(--amber)' },
        ].map(k => (
          <div key={k.label} className="rounded-lg border" style={{ background: 'var(--surface)', borderColor: 'var(--ink-10)', padding: '16px 20px' }}>
            <div className="text-[11px] uppercase tracking-wider font-medium mb-1" style={{ color: 'var(--ink-60)' }}>{k.label}</div>
            <div className="text-[22px] font-semibold" style={{ color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex mb-5" style={{ borderBottom: '1px solid var(--ink-10)' }}>
        <TabBtn active={tab === 'records'} onClick={() => setTab('records')}>📋 Records</TabBtn>
        <TabBtn active={tab === 'summary'} onClick={() => setTab('summary')}>📊 Monthly Summary</TabBtn>
      </div>

      {/* ── RECORDS TAB ── */}
      {tab === 'records' && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center rounded-lg mb-4 p-4" style={{ background: 'var(--cream-dark)' }}>
            <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--ink-60)' }}>
              <input type="radio" checked={useMonth} onChange={() => setUseMonth(true)} /> By Month
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--ink-60)' }}>
              <input type="radio" checked={!useMonth} onChange={() => setUseMonth(false)} /> Date Range
            </label>
            {useMonth
              ? <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} />
              : <>
                  <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} placeholder="From" />
                  <input type="date" value={filterTo}   onChange={e => setFilterTo(e.target.value)}   placeholder="To" />
                </>
            }
            <Btn size="sm" onClick={() => { setFilterMonth(thisMonth()); setFilterFrom(''); setFilterTo(''); setUseMonth(true) }}>Reset</Btn>
          </div>

          <Card noPad>
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  {['Date', 'Litres Sold', 'Price / L', 'Total (TSh)', 'Notes', ''].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-[11px] font-semibold tracking-wider uppercase border-b" style={{ color: 'var(--ink-60)', borderColor: 'var(--ink-10)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.length === 0 && (
                  <tr><td colSpan={6}><EmptyState>No records for selected period.</EmptyState></td></tr>
                )}
                {records.map(r => (
                  <tr key={r.id} style={{ transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--cream)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}
                  >
                    <td className="px-5 py-3 border-b font-mono text-xs" style={{ color: 'var(--ink-60)', borderColor: 'var(--ink-10)' }}>{r.date}</td>
                    <td className="px-5 py-3 border-b font-medium" style={{ color: 'var(--blue)', borderColor: 'var(--ink-10)' }}>{fmt(r.litres_sold)} L</td>
                    <td className="px-5 py-3 border-b" style={{ color: 'var(--ink-60)', borderColor: 'var(--ink-10)' }}>{fmtTsh(r.price_per_litre)}</td>
                    <td className="px-5 py-3 border-b font-semibold" style={{ color: 'var(--green-600)', borderColor: 'var(--ink-10)' }}>{fmtTsh(r.total)}</td>
                    <td className="px-5 py-3 border-b text-xs" style={{ color: 'var(--ink-30)', borderColor: 'var(--ink-10)' }}>{r.notes || '—'}</td>
                    <td className="px-5 py-3 border-b" style={{ borderColor: 'var(--ink-10)' }}>
                      <Btn size="sm" variant="danger" onClick={() => handleDelete(r.id)}>Delete</Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
              {records.length > 0 && (
                <tfoot>
                  <tr style={{ background: 'var(--cream-dark)' }}>
                    <td className="px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-60)' }}>Total</td>
                    <td className="px-5 py-3 font-semibold" style={{ color: 'var(--blue)' }}>{fmt(totalLitres)} L</td>
                    <td />
                    <td className="px-5 py-3 font-semibold" style={{ color: 'var(--green-600)' }}>{fmtTsh(totalRevenue)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </Card>
        </>
      )}

      {/* ── SUMMARY TAB ── */}
      {tab === 'summary' && (
        <>
          {summary.length > 0 && (
            <Card>
              <CardTitle>Monthly Revenue (TSh)</CardTitle>
              <div style={{ height: 240, position: 'relative' }}>
                <Bar data={chartData} options={chartOpts} />
              </div>
            </Card>
          )}
          <Card noPad>
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  {['Month', 'Records', 'Total Litres', 'Avg / Day', 'Total Revenue'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-[11px] font-semibold tracking-wider uppercase border-b" style={{ color: 'var(--ink-60)', borderColor: 'var(--ink-10)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary.length === 0 && (
                  <tr><td colSpan={5}><EmptyState>No sales data yet.</EmptyState></td></tr>
                )}
                {summary.map(s => (
                  <tr key={s.month} style={{ transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--cream)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}
                  >
                    <td className="px-5 py-3 border-b font-medium" style={{ color: 'var(--ink)', borderColor: 'var(--ink-10)' }}>{s.month}</td>
                    <td className="px-5 py-3 border-b" style={{ color: 'var(--ink-60)', borderColor: 'var(--ink-10)' }}>{s.record_count}</td>
                    <td className="px-5 py-3 border-b" style={{ color: 'var(--blue)', borderColor: 'var(--ink-10)' }}>{fmt(s.total_litres)} L</td>
                    <td className="px-5 py-3 border-b" style={{ color: 'var(--ink-60)', borderColor: 'var(--ink-10)' }}>{fmt(s.avg_litres_per_day)} L</td>
                    <td className="px-5 py-3 border-b font-semibold" style={{ color: 'var(--green-600)', borderColor: 'var(--ink-10)' }}>{fmtTsh(s.total_revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {/* ── ADD SALE MODAL ── */}
      {showModal && (
        <Modal title="Record Sale" onClose={() => setShowModal(false)}>
          <form onSubmit={handleSave}>
            <Field label="Date" name="date" type="date" defaultValue={today()} required />
            <Field label="Litres Sold" name="litres_sold" type="number" min="0.01" step="any" required />
            <Field label="Price per Litre (TSh)" name="price_per_litre" type="number" min="0.01" step="any" required />
            <Field label="Notes" name="notes" />
            <div className="flex gap-2 justify-end mt-2">
              <Btn onClick={() => setShowModal(false)}>Cancel</Btn>
              <Btn variant="primary" onClick={() => {}}>
                <button type="submit" className="border-0 bg-transparent text-white cursor-pointer font-medium text-sm">Save</button>
              </Btn>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}