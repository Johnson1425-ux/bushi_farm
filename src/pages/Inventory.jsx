import { useState, useEffect, useRef } from 'react'
import { apiFetch, BASE } from '../lib/api'
import { Card, Btn, PageHeader, EmptyState } from '../components/ui'

const fmt   = n => Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })
const today = () => new Date().toISOString().slice(0, 10)

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

export default function Inventory() {
  const [items,         setItems]         = useState([])
  const [logs,          setLogs]          = useState([])
  const [loading,       setLoading]       = useState(true)
  const [tab,           setTab]           = useState('items')
  const [showItemModal, setShowItemModal] = useState(false)
  const [showLogModal,  setShowLogModal]  = useState(null)
  const [editItem,      setEditItem]      = useState(null)
  const [importResult,  setImportResult]  = useState(null)
  const [importLoading, setImportLoading] = useState(false)
  const [filterItem,    setFilterItem]    = useState('')
  const [filterFrom,    setFilterFrom]    = useState('')
  const [filterTo,      setFilterTo]      = useState('')
  const fileRef = useRef()

  const fetchItems = async () => {
    const data = await apiFetch('/inventory/items')
    setItems(data)
  }

  const fetchLogs = async () => {
    const params = new URLSearchParams()
    if (filterItem) params.set('item_id', filterItem)
    if (filterFrom) params.set('from', filterFrom)
    if (filterTo)   params.set('to', filterTo)
    const data = await apiFetch(`/inventory/logs?${params}`)
    setLogs(data)
  }

  useEffect(() => {
    fetchItems().finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (tab === 'logs') fetchLogs()
  }, [tab, filterItem, filterFrom, filterTo])

  const handleSaveItem = async (e) => {
    e.preventDefault()
    const fd = new FormData(e.target)
    const body = JSON.stringify({ name: fd.get('name'), unit: fd.get('unit'), notes: fd.get('notes') })
    if (editItem) {
      await apiFetch(`/inventory/items/${editItem.id}`, { method: 'PATCH', body })
    } else {
      await apiFetch('/inventory/items', { method: 'POST', body })
    }
    await fetchItems()
    setShowItemModal(false); setEditItem(null)
  }

  const handleDeleteItem = async (id) => {
    if (!confirm('Delete this item and all its logs?')) return
    await apiFetch(`/inventory/items/${id}`, { method: 'DELETE' })
    await fetchItems()
  }

  const handleLog = async (e) => {
    e.preventDefault()
    const fd = new FormData(e.target)
    await apiFetch('/inventory/logs', {
      method: 'POST',
      body: JSON.stringify({
        item_id:  showLogModal.id,
        type:     fd.get('type'),
        quantity: fd.get('quantity'),
        date:     fd.get('date'),
        notes:    fd.get('notes'),
      }),
    })
    await fetchItems()
    if (tab === 'logs') await fetchLogs()
    setShowLogModal(null)
  }

  const handleImport = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImportLoading(true); setImportResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const token = localStorage.getItem('mt_token')
      const res = await fetch(`${BASE}/inventory/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Import failed')
      setImportResult(result)
      await fetchItems()
    } catch (err) {
      setImportResult({ error: err.message })
    } finally {
      setImportLoading(false); e.target.value = ''
    }
  }

  if (loading) return <div className="p-8 text-center text-sm" style={{ color: 'var(--ink-30)' }}>Loading…</div>

  return (
    <div style={{ animation: 'fadeUp .2s ease' }}>
      <PageHeader title="Inventory" sub="Track equipment stock in and out">
        <Btn size="sm" onClick={() => { setShowItemModal(true); setEditItem(null) }}>+ Add Item</Btn>
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
          {importResult.error ? `✗ ${importResult.error}` : `✓ Imported ${importResult.imported} row(s).`}
        </div>
      )}

      {/* Tabs */}
      <div className="flex mb-5" style={{ borderBottom: '1px solid var(--ink-10)' }}>
        <TabBtn active={tab === 'items'} onClick={() => setTab('items')}>📦 Equipment List</TabBtn>
        <TabBtn active={tab === 'logs'}  onClick={() => setTab('logs')}>📋 Stock Logs</TabBtn>
      </div>

      {/* ── ITEMS TAB ── */}
      {tab === 'items' && (
        <Card noPad>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                {['Equipment', 'Unit', 'Stock', 'Total In', 'Total Out', 'Notes', ''].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-[11px] font-semibold tracking-wider uppercase border-b" style={{ color: 'var(--ink-60)', borderColor: 'var(--ink-10)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={7}><EmptyState>No equipment added yet.</EmptyState></td></tr>
              )}
              {items.map(item => (
                <tr key={item.id} style={{ transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--cream)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}
                >
                  <td className="px-5 py-3 border-b font-semibold" style={{ color: 'var(--ink)', borderColor: 'var(--ink-10)' }}>{item.name}</td>
                  <td className="px-5 py-3 border-b" style={{ color: 'var(--ink-60)', borderColor: 'var(--ink-10)' }}>{item.unit}</td>
                  <td className="px-5 py-3 border-b font-bold border-b" style={{ color: item.current_stock <= 0 ? 'var(--red)' : 'var(--green-600)', borderColor: 'var(--ink-10)' }}>
                    {fmt(item.current_stock)}
                  </td>
                  <td className="px-5 py-3 border-b" style={{ color: 'var(--blue)', borderColor: 'var(--ink-10)' }}>{fmt(item.total_in)}</td>
                  <td className="px-5 py-3 border-b" style={{ color: 'var(--amber)', borderColor: 'var(--ink-10)' }}>{fmt(item.total_out)}</td>
                  <td className="px-5 py-3 border-b text-xs" style={{ color: 'var(--ink-30)', borderColor: 'var(--ink-10)' }}>{item.notes || '—'}</td>
                  <td className="px-5 py-3 border-b" style={{ borderColor: 'var(--ink-10)' }}>
                    <div className="flex gap-2">
                      <Btn size="sm" variant="primary" onClick={() => setShowLogModal(item)}>Stock In/Out</Btn>
                      <Btn size="sm" onClick={() => { setEditItem(item); setShowItemModal(true) }}>Edit</Btn>
                      <Btn size="sm" variant="danger" onClick={() => handleDeleteItem(item.id)}>Delete</Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* ── LOGS TAB ── */}
      {tab === 'logs' && (
        <>
          <div className="flex flex-wrap gap-3 items-center rounded-lg mb-4 p-4" style={{ background: 'var(--cream-dark)' }}>
            <select value={filterItem} onChange={e => setFilterItem(e.target.value)}>
              <option value="">All Equipment</option>
              {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
            <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} placeholder="From" />
            <input type="date" value={filterTo}   onChange={e => setFilterTo(e.target.value)}   placeholder="To" />
            <Btn size="sm" onClick={() => { setFilterItem(''); setFilterFrom(''); setFilterTo('') }}>Clear</Btn>
          </div>

          <Card noPad>
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  {['Date', 'Equipment', 'Unit', 'Type', 'Qty', 'Notes'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-[11px] font-semibold tracking-wider uppercase border-b" style={{ color: 'var(--ink-60)', borderColor: 'var(--ink-10)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 && (
                  <tr><td colSpan={6}><EmptyState>No logs found.</EmptyState></td></tr>
                )}
                {logs.map(log => (
                  <tr key={log.id} style={{ transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--cream)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}
                  >
                    <td className="px-5 py-3 border-b font-mono text-xs" style={{ color: 'var(--ink-60)', borderColor: 'var(--ink-10)' }}>{log.date}</td>
                    <td className="px-5 py-3 border-b font-medium" style={{ color: 'var(--ink)', borderColor: 'var(--ink-10)' }}>{log.item_name}</td>
                    <td className="px-5 py-3 border-b" style={{ color: 'var(--ink-30)', borderColor: 'var(--ink-10)' }}>{log.unit}</td>
                    <td className="px-5 py-3 border-b" style={{ borderColor: 'var(--ink-10)' }}>
                      <span
                        className="inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                        style={log.type === 'in'
                          ? { background: 'var(--green-100)', color: 'var(--green-800)' }
                          : { background: 'rgba(232,160,32,0.15)', color: 'var(--amber)' }
                        }
                      >
                        {log.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-5 py-3 border-b font-medium" style={{ color: 'var(--ink)', borderColor: 'var(--ink-10)' }}>{fmt(log.quantity)}</td>
                    <td className="px-5 py-3 border-b text-xs" style={{ color: 'var(--ink-30)', borderColor: 'var(--ink-10)' }}>{log.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {/* ── ADD/EDIT ITEM MODAL ── */}
      {showItemModal && (
        <Modal title={editItem ? 'Edit Equipment' : 'Add Equipment'} onClose={() => { setShowItemModal(false); setEditItem(null) }}>
          <form onSubmit={handleSaveItem}>
            <Field label="Name" name="name" defaultValue={editItem?.name} required />
            <Field label="Unit (e.g. pcs, kg, litres)" name="unit" defaultValue={editItem?.unit ?? 'pcs'} required />
            <Field label="Notes" name="notes" defaultValue={editItem?.notes} />
            <div className="flex gap-2 justify-end mt-2">
              <Btn onClick={() => { setShowItemModal(false); setEditItem(null) }}>Cancel</Btn>
              <Btn variant="primary">
                <button type="submit" className="border-0 bg-transparent text-white cursor-pointer font-medium text-sm">
                  {editItem ? 'Save Changes' : 'Add Item'}
                </button>
              </Btn>
            </div>
          </form>
        </Modal>
      )}

      {/* ── STOCK IN/OUT MODAL ── */}
      {showLogModal && (
        <Modal title={`Stock In / Out — ${showLogModal.name}`} onClose={() => setShowLogModal(null)}>
          <form onSubmit={handleLog}>
            <Field label="Type" name="type">
              <select name="type" className="w-full" required>
                <option value="in">Stock IN ↑</option>
                <option value="out">Stock OUT ↓</option>
              </select>
            </Field>
            <Field label={`Quantity (${showLogModal.unit})`} name="quantity" type="number" min="0.01" step="any" required />
            <Field label="Date" name="date" type="date" defaultValue={today()} required />
            <Field label="Notes" name="notes" />
            <div className="flex gap-2 justify-end mt-2">
              <Btn onClick={() => setShowLogModal(null)}>Cancel</Btn>
              <Btn variant="primary">
                <button type="submit" className="border-0 bg-transparent text-white cursor-pointer font-medium text-sm">Record</button>
              </Btn>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}