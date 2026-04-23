import { useState, useEffect, useCallback, useRef } from 'react'
import { apiFetch, statusClass } from '../lib/api'
import { Card, CardTitle, Btn, PageHeader, EmptyState, Badge, InlineBar, Spinner } from '../components/ui'

const PAGE_SIZE = 25

function fmt(n) {
  return n == null ? '—' : Number(n).toFixed(1)
}

function fmtDate(d) {
  if (!d) return '—'
  const dt = new Date(d + 'T00:00:00')
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
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
    >
      {children}
    </button>
  )
}

function CowChip({ cow, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '5px 12px 5px 8px', borderRadius: 999,
        border: selected ? '1.5px solid var(--green-400)' : '1.5px solid var(--ink-10)',
        background: selected ? 'var(--green-50)' : 'var(--surface)',
        color: selected ? 'var(--green-800)' : 'var(--ink-60)',
        fontSize: 12, fontWeight: selected ? 600 : 400,
        cursor: 'pointer', transition: 'all .15s', whiteSpace: 'nowrap',
      }}
    >
      <span style={{
        width: 7, height: 7, borderRadius: '50%',
        background: selected ? 'var(--green-400)' : 'var(--ink-30)', flexShrink: 0,
      }} />
      {cow.name}
      {cow.tag && <span style={{ opacity: .5, fontSize: 10 }}>#{cow.tag}</span>}
      {cow.avg_litres != null && (
        <span style={{
          background: selected ? 'var(--green-100)' : 'var(--ink-10)',
          color: selected ? 'var(--green-800)' : 'var(--ink-60)',
          borderRadius: 4, padding: '1px 5px', fontSize: 10, fontWeight: 600,
        }}>{fmt(cow.avg_litres)}L</span>
      )}
    </button>
  )
}

export default function DailyRecords() {
  const [cows,       setCows]       = useState([])
  const [records,    setRecords]    = useState([])
  const [total,      setTotal]      = useState(0)
  const [loading,    setLoading]    = useState(true)
  const [tab,        setTab]        = useState('records')
  const [page,       setPage]       = useState(0)

  /* filters */
  const [search,     setSearch]     = useState('')
  const [selectedCow,setSelectedCow]= useState(null)
  const [dateFrom,   setDateFrom]   = useState('')
  const [dateTo,     setDateTo]     = useState('')
  const [sortField,  setSortField]  = useState('date')
  const [sortDir,    setSortDir]    = useState('desc')

  const debounceRef = useRef(null)

  /* ── load cows once ── */
  useEffect(() => {
    apiFetch('/cows').then(setCows)
  }, [])

  /* ── load records ── */
  const fetchRecords = useCallback(async (pg = 0) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: PAGE_SIZE, offset: pg * PAGE_SIZE })
      if (selectedCow) params.set('cow_id', selectedCow)
      if (dateFrom)    params.set('date_from', dateFrom)
      if (dateTo)      params.set('date_to', dateTo)

      const data = await apiFetch(`/records?${params}`)
      let rows = data.records || []

      if (search.trim()) {
        const q = search.toLowerCase()
        rows = rows.filter(r =>
          r.cow.toLowerCase().includes(q) ||
          r.date.includes(q) ||
          (r.notes || '').toLowerCase().includes(q)
        )
      }

      rows = [...rows].sort((a, b) => {
        let va = a[sortField], vb = b[sortField]
        if (sortField === 'litres') { va = Number(va); vb = Number(vb) }
        if (va < vb) return sortDir === 'asc' ? -1 : 1
        if (va > vb) return sortDir === 'asc' ? 1 : -1
        return 0
      })

      setRecords(rows)
      setTotal(data.total || rows.length)
    } finally {
      setLoading(false)
    }
  }, [selectedCow, dateFrom, dateTo, search, sortField, sortDir])

  useEffect(() => {
    setPage(0)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchRecords(0), search ? 300 : 0)
    return () => clearTimeout(debounceRef.current)
  }, [fetchRecords])

  /* ── helpers ── */
  const cowsMap    = Object.fromEntries(cows.map(c => [c.name, c]))
  const totalPages = Math.ceil(total / PAGE_SIZE)
  const hasFilters = search || selectedCow || dateFrom || dateTo

  function toggleSort(field) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  function SortIcon({ field }) {
    if (sortField !== field) return <span style={{ opacity: .25, fontSize: 10 }}>↕</span>
    return <span style={{ color: 'var(--green-400)', fontSize: 10 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  function clearFilters() {
    setSearch(''); setSelectedCow(null); setDateFrom(''); setDateTo('')
    setSortField('date'); setSortDir('desc')
  }

  function preset(days) {
    const to = new Date()
    const from = new Date(); from.setDate(to.getDate() - days)
    setDateFrom(from.toISOString().slice(0, 10))
    setDateTo(to.toISOString().slice(0, 10))
    setPage(0)
  }

  /* ── summary stats ── */
  const summaryByCow = cows.map(c => ({
    ...c,
    cls: statusClass(Number(c.avg_litres), Number(c.avg_litres)),
  }))

  if (loading && records.length === 0 && cows.length === 0) {
    return <div className="p-8 text-center text-sm" style={{ color: 'var(--ink-30)' }}>Loading…</div>
  }

  return (
    <div style={{ animation: 'fadeUp .2s ease' }}>
      <PageHeader title="Daily Records" sub="Search, filter and browse milk production logs per cow">
        <Btn size="sm" variant="primary" onClick={() => fetchRecords(page)}>↻ Refresh</Btn>
      </PageHeader>

      {/* ── Tabs ── */}
      <div className="flex mb-5" style={{ borderBottom: '1px solid var(--ink-10)' }}>
        <TabBtn active={tab === 'records'} onClick={() => setTab('records')}>🥛 Records</TabBtn>
        <TabBtn active={tab === 'summary'} onClick={() => setTab('summary')}>📊 Summary</TabBtn>
      </div>

      {/* ══════════════════════
          RECORDS TAB
      ══════════════════════ */}
      {tab === 'records' && (
        <>
          {/* Cow chips */}
          {cows.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div className="text-[11px] font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--ink-60)' }}>
                Filter by Cow
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <button
                  onClick={() => { setSelectedCow(null); setPage(0) }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '5px 14px', borderRadius: 999, fontSize: 12,
                    fontWeight: selectedCow === null ? 600 : 400,
                    border: `1.5px solid ${selectedCow === null ? 'var(--green-400)' : 'var(--ink-10)'}`,
                    background: selectedCow === null ? 'var(--green-50)' : 'var(--surface)',
                    color: selectedCow === null ? 'var(--green-800)' : 'var(--ink-60)',
                    cursor: 'pointer', transition: 'all .15s',
                  }}
                >
                  All Cows
                  <span style={{
                    background: selectedCow === null ? 'var(--green-100)' : 'var(--ink-10)',
                    color: selectedCow === null ? 'var(--green-800)' : 'var(--ink-60)',
                    borderRadius: 4, padding: '1px 5px', fontSize: 10, fontWeight: 600,
                  }}>{cows.length}</span>
                </button>
                {cows.map(c => (
                  <CowChip
                    key={c.id}
                    cow={c}
                    selected={selectedCow === c.id}
                    onClick={() => { setSelectedCow(selectedCow === c.id ? null : c.id); setPage(0) }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Search & date filters */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16, alignItems: 'flex-end' }}>
            <input
              type="search"
              placeholder="Search cow, date, notes…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ flex: '1 1 200px' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--ink-60)' }}>From</span>
              <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0) }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--ink-60)' }}>To</span>
              <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0) }} />
            </div>
            <div style={{ display: 'flex', gap: 5 }}>
              {[7, 14, 30, 90].map(d => (
                <Btn key={d} size="sm" onClick={() => preset(d)}>{d}d</Btn>
              ))}
            </div>
            {hasFilters && (
              <Btn size="sm" variant="danger" onClick={clearFilters}>✕ Clear</Btn>
            )}
          </div>

          {/* Table */}
          <Card noPad>
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  {[
                    { label: 'Date',   field: 'date'   },
                    { label: 'Cow',    field: 'cow'    },
                    { label: 'Breed',  field: null     },
                    { label: 'Litres', field: 'litres' },
                    { label: 'vs Avg', field: null     },
                    { label: 'Status', field: null     },
                    { label: 'Notes',  field: 'notes'  },
                  ].map(col => (
                    <th
                      key={col.label}
                      onClick={col.field ? () => toggleSort(col.field) : undefined}
                      className="text-left px-5 py-3 text-[11px] font-semibold tracking-wider uppercase border-b"
                      style={{
                        color: 'var(--ink-60)', borderColor: 'var(--ink-10)',
                        cursor: col.field ? 'pointer' : 'default', userSelect: 'none',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {col.label}
                      {col.field && <span className="ml-1"><SortIcon field={col.field} /></span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && records.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-sm" style={{ color: 'var(--ink-30)' }}>
                      <Spinner /> Loading records…
                    </td>
                  </tr>
                )}
                {!loading && records.length === 0 && (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState>
                        {hasFilters ? 'No records match your current filters.' : 'No milk records found.'}
                      </EmptyState>
                    </td>
                  </tr>
                )}
                {records.map(r => {
                  const cow = cowsMap[r.cow]
                  const cls = cow ? statusClass(Number(r.litres), Number(cow.avg_litres)) : 'mid'
                  return (
                    <tr
                      key={r.id}
                      style={{ transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--cream)'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}
                    >
                      <td className="px-5 py-3 border-b font-mono text-xs" style={{ color: 'var(--ink-60)', borderColor: 'var(--ink-10)', whiteSpace: 'nowrap' }}>
                        {fmtDate(r.date)}
                      </td>
                      <td className="px-5 py-3 border-b" style={{ borderColor: 'var(--ink-10)' }}>
                        <div className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{r.cow}</div>
                        {cow?.tag && <div className="text-xs mt-0.5" style={{ color: 'var(--ink-30)' }}>Tag #{cow.tag}</div>}
                      </td>
                      <td className="px-5 py-3 border-b text-xs" style={{ color: 'var(--ink-60)', borderColor: 'var(--ink-10)' }}>
                        {cow?.breed || <span style={{ color: 'var(--ink-30)' }}>—</span>}
                      </td>
                      <td className="px-5 py-3 border-b" style={{ borderColor: 'var(--ink-10)' }}>
                        <span className="font-bold" style={{ fontSize: 16, color: 'var(--ink)' }}>{fmt(r.litres)}</span>
                        <span className="text-xs ml-1" style={{ color: 'var(--ink-30)' }}>L</span>
                      </td>
                      <td className="px-5 py-3 border-b" style={{ borderColor: 'var(--ink-10)' }}>
                        {cow ? <InlineBar litres={Number(r.litres)} overall={Number(cow.avg_litres)} /> : <span style={{ color: 'var(--ink-30)' }}>—</span>}
                      </td>
                      <td className="px-5 py-3 border-b" style={{ borderColor: 'var(--ink-10)' }}>
                        <Badge cls={cls} />
                      </td>
                      <td className="px-5 py-3 border-b text-xs" style={{ color: 'var(--ink-60)', borderColor: 'var(--ink-10)', maxWidth: 200 }}>
                        {r.notes
                          ? <span title={r.notes} style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{r.notes}</span>
                          : <span style={{ color: 'var(--ink-30)' }}>—</span>
                        }
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between flex-wrap gap-2 px-5 py-3" style={{ borderTop: '1px solid var(--ink-10)' }}>
                <span className="text-xs" style={{ color: 'var(--ink-60)' }}>
                  Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total} records
                </span>
                <div className="flex gap-1.5 items-center">
                  <Btn size="sm" disabled={page === 0} onClick={() => { const p = 0; setPage(p); fetchRecords(p) }}>«</Btn>
                  <Btn size="sm" disabled={page === 0} onClick={() => { const p = page - 1; setPage(p); fetchRecords(p) }}>‹ Prev</Btn>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const start = Math.max(0, Math.min(page - 2, totalPages - 5))
                    const p = start + i
                    return (
                      <Btn key={p} size="sm" variant={p === page ? 'primary' : 'default'} onClick={() => { setPage(p); fetchRecords(p) }}>
                        {p + 1}
                      </Btn>
                    )
                  })}
                  <Btn size="sm" disabled={page >= totalPages - 1} onClick={() => { const p = page + 1; setPage(p); fetchRecords(p) }}>Next ›</Btn>
                  <Btn size="sm" disabled={page >= totalPages - 1} onClick={() => { const p = totalPages - 1; setPage(p); fetchRecords(p) }}>»</Btn>
                </div>
              </div>
            )}
          </Card>
        </>
      )}

      {/* ══════════════════════
          SUMMARY TAB
      ══════════════════════ */}
      {tab === 'summary' && (
        <>
          {cows.length === 0 ? (
            <EmptyState>No cows found.</EmptyState>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
              {cows.map(c => {
                const cls = statusClass(Number(c.avg_litres), Number(c.avg_litres) * 0.95 + 0.1)
                return (
                  <div
                    key={c.id}
                    className="rounded-lg p-5 border cursor-pointer"
                    style={{ background: 'var(--surface)', borderColor: 'var(--ink-10)', transition: 'border-color .15s' }}
                    onClick={() => { setSelectedCow(c.id); setTab('records'); setPage(0) }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--green-400)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--ink-10)'}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{c.name}</div>
                        <div className="text-xs mt-0.5" style={{ color: 'var(--ink-30)' }}>
                          {c.tag ? `Tag #${c.tag}` : ''}{c.tag && c.breed ? ' · ' : ''}{c.breed || ''}
                        </div>
                      </div>
                      <Badge cls={cls} />
                    </div>

                    <div className="flex gap-4 mb-3">
                      <div>
                        <div className="font-bold" style={{ fontSize: 24, color: 'var(--ink)', lineHeight: 1 }}>{fmt(c.avg_litres)}</div>
                        <div className="text-[10px] mt-0.5" style={{ color: 'var(--ink-60)' }}>avg L</div>
                      </div>
                      <div>
                        <div className="font-bold" style={{ fontSize: 24, color: 'var(--ink)', lineHeight: 1 }}>{fmt(c.total_litres)}</div>
                        <div className="text-[10px] mt-0.5" style={{ color: 'var(--ink-60)' }}>total L</div>
                      </div>
                      <div>
                        <div className="font-bold" style={{ fontSize: 24, color: 'var(--ink)', lineHeight: 1 }}>{c.record_count}</div>
                        <div className="text-[10px] mt-0.5" style={{ color: 'var(--ink-60)' }}>records</div>
                      </div>
                    </div>

                    <div className="text-[10px]" style={{ color: 'var(--ink-30)' }}>
                      {c.first_date ? `${fmtDate(c.first_date)} → ${fmtDate(c.last_date)}` : 'No records yet'}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}