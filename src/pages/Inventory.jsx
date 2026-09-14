import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { apiFetch, BASE } from '../lib/api'
import { authHeaders } from '../lib/session'
import { Card, CardTitle, Btn, PageHeader, EmptyState, MetricCard, Spinner } from '../components/ui'
import { useConfirm } from '../lib/ConfirmContext'
import { notify } from '../lib/notify'

/* ══════════════════════════════════════════════════════════════
   THE STORE

   Everything the production and processing unit consumes rather than
   sells — packaging bottles, caps, labels, crates, cultures, CIP
   chemicals, machine spares, PPE.

   The page it replaces could answer one question: how many are there.
   It could not answer any of the ones a store is actually kept for —
   how many came in and from whom, how many went out and to which shift,
   how many were broken rather than used, when to reorder, what the shelf
   is worth, or whether the book still agrees with the shelf.

   Five tabs, in the order the work happens:

     Overview   what needs ordering this morning, and what it costs
     Items      the stock card for every line the store carries
     Movements  every receipt, issue, breakage and return, with its author
     Counts     the shelf counted against the book, and the variance
     Report     a period's opening, movements and closing, per item

   One rule runs through all of it: the balance is the movement log summed,
   and never anything else. Nothing on this page lets a figure be typed
   over — a balance that disagrees with the shelf is corrected by counting
   the shelf, which leaves a document behind saying so.
══════════════════════════════════════════════════════════════ */

const fmt = (n, dec = 0) => Number(n ?? 0).toLocaleString(undefined, {
  minimumFractionDigits: 0, maximumFractionDigits: dec,
})
const money = n => Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })
const num   = v => (Number.isFinite(Number(v)) ? Number(v) : 0)
const today = () => new Date().toISOString().slice(0, 10)
const daysAgo = d => new Date(Date.now() - d * 864e5).toISOString().slice(0, 10)

/* What a movement means, in one place. The sign is what the ledger does
   with it, so a row's colour and its arithmetic can never disagree. */
const MOVEMENTS = {
  in:     { label: 'Received',   short: 'IN',     sign:  1, color: 'var(--green-600)', chip: 'var(--green-100)',            ink: 'var(--green-800)' },
  return: { label: 'Returned',   short: 'RETURN', sign:  1, color: 'var(--blue)',      chip: 'rgba(52,120,200,0.12)',       ink: 'var(--blue)' },
  out:    { label: 'Issued',     short: 'OUT',    sign: -1, color: 'var(--amber)',     chip: 'rgba(232,160,32,0.15)',       ink: 'var(--amber)' },
  damage: { label: 'Damaged',    short: 'DAMAGE', sign: -1, color: 'var(--red)',       chip: 'rgba(217,64,64,0.12)',        ink: 'var(--red)' },
  adjust: { label: 'Count adj.', short: 'ADJUST', sign:  0, color: 'var(--ink-60)',    chip: 'var(--cream-dark)',           ink: 'var(--ink-60)' },
}

/**
 * The + or − in front of a movement quantity.
 *
 * Four of the five types have a fixed direction, so the type alone decides.
 * An adjustment does not: a stock count corrects in whichever direction the
 * shelf disagreed, and its quantity is signed. Reading the sign off the type
 * for that one prints a correction of −50 as "50".
 */
const signPrefix = (type, value) => {
  const dir = type === 'adjust' ? Math.sign(value) : MOVEMENTS[type].sign
  return dir < 0 ? '−' : dir > 0 ? '+' : ''
}

/* Only the four a person files by hand. An adjustment comes from posting a
   stock count, so the variance always has a document behind it — the API
   refuses a typed one, and offering it here would only invite the refusal. */
const RECORDABLE = ['in', 'out', 'damage', 'return']

const CATEGORIES = [
  ['packaging',  'Packaging',  'Bottles, caps, labels, crates, film'],
  ['ingredient', 'Ingredients', 'Cultures, sugar, flavours, stabilisers'],
  ['chemical',   'Chemicals',  'CIP detergents, sanitisers'],
  ['spare',      'Spares',     'Machine spares and fittings'],
  ['tool',       'Tools',      'Equipment and hand tools'],
  ['ppe',        'PPE',        'Gloves, coats, boots, hairnets'],
  ['general',    'General',    'Everything else'],
]
const catLabel = c => CATEGORIES.find(x => x[0] === c)?.[1] ?? 'General'

const STATE = {
  out: { label: 'Out of stock', color: 'var(--red)',   chip: 'rgba(217,64,64,0.12)' },
  low: { label: 'Reorder',      color: 'var(--amber)', chip: 'rgba(232,160,32,0.15)' },
  ok:  { label: 'In stock',     color: 'var(--green-800)', chip: 'var(--green-100)' },
}

/* ── small building blocks ──────────────────────────────── */

const TH = ({ children, right, w }) => (
  <th className={`px-4 py-3 text-[11px] font-semibold tracking-wider uppercase border-b ${right ? 'text-right' : 'text-left'}`}
    style={{ color: 'var(--ink-60)', borderColor: 'var(--ink-10)', width: w }}>{children}</th>
)

const TD = ({ children, right, mono, strong, color, colSpan, title }) => (
  <td colSpan={colSpan} title={title}
    className={`px-4 py-3 border-b ${right ? 'text-right' : ''}`}
    style={{
      borderColor: 'var(--ink-10)',
      color: color || (strong ? 'var(--ink)' : 'var(--ink-60)'),
      fontWeight: strong ? 600 : 400,
      fontFamily: mono ? "'DM Mono', monospace" : 'inherit',
      fontSize: mono ? 12 : 13,
    }}>{children}</td>
)

const Row = ({ children, onClick }) => (
  <tr
    onClick={onClick}
    style={{ transition: 'background .15s', cursor: onClick ? 'pointer' : 'default' }}
    onMouseEnter={e => { e.currentTarget.style.background = 'var(--cream)' }}
    onMouseLeave={e => { e.currentTarget.style.background = '' }}
  >{children}</tr>
)

const Chip = ({ chip, ink, children }) => (
  <span className="inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap"
    style={{ background: chip, color: ink }}>{children}</span>
)

const StateChip = ({ state }) => {
  const s = STATE[state] || STATE.ok
  return <Chip chip={s.chip} ink={s.color}>{s.label}</Chip>
}

const TypeChip = ({ type }) => {
  const m = MOVEMENTS[type] || MOVEMENTS.adjust
  return <Chip chip={m.chip} ink={m.ink}>{m.short}</Chip>
}

function TabBtn({ active, onClick, children, count }) {
  return (
    <button onClick={onClick}
      className="px-4 py-2 text-sm font-medium border-0 bg-transparent cursor-pointer transition-all whitespace-nowrap"
      style={{
        color: active ? 'var(--green-600)' : 'var(--ink-60)',
        borderBottom: active ? '2px solid var(--green-600)' : '2px solid transparent',
      }}>
      {children}
      {count > 0 && (
        <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
          style={{ background: 'rgba(217,64,64,0.12)', color: 'var(--red)' }}>{count}</span>
      )}
    </button>
  )
}

function Modal({ title, sub, onClose, wide, children }) {
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto"
      style={{ background: 'rgba(10,30,20,0.45)', padding: '40px 16px' }}>
      <div className="rounded-[16px] w-full p-7" style={{ background: 'var(--surface)', maxWidth: wide ? 940 : 480 }}>
        <div className="flex items-start justify-between mb-5 gap-4">
          <div>
            <div className="font-serif text-[18px]" style={{ color: 'var(--ink)' }}>{title}</div>
            {sub && <div className="text-xs mt-1" style={{ color: 'var(--ink-60)' }}>{sub}</div>}
          </div>
          <button onClick={onClose} className="border-0 bg-transparent text-[18px] cursor-pointer p-1 leading-none hover:opacity-60"
            style={{ color: 'var(--ink-30)' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, hint, name, type = 'text', defaultValue, required, children, ...props }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label className="block text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--ink-60)', marginBottom: 6 }}>{label}</label>
      {children ?? <input name={name} type={type} defaultValue={defaultValue ?? ''} required={required} className="w-full" {...props} />}
      {hint && <div className="text-[11px] mt-1.5" style={{ color: 'var(--ink-30)' }}>{hint}</div>}
    </div>
  )
}

const Grid2 = ({ children }) => <div className="grid gap-x-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>{children}</div>

/**
 * Download whatever is on screen.
 *
 * The store's figures are asked for by people who do not have a login —
 * an auditor, a supplier reconciling deliveries — and the answer used to
 * be a screenshot. Values are quoted and internal quotes doubled, because
 * an item called 6" crate had until now split itself across two columns.
 */
function downloadCsv(filename, headers, rows) {
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = [headers.map(esc).join(','), ...rows.map(r => r.map(esc).join(','))].join('\r\n')
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  URL.revokeObjectURL(url)
}

/* ══════════════════════════════════════════════════════════════
   THE PAGE
══════════════════════════════════════════════════════════════ */

export default function Inventory() {
  const confirm = useConfirm()

  const [tab,     setTab]     = useState('overview')
  const [loading, setLoading] = useState(true)
  const [items,   setItems]   = useState([])
  const [summary, setSummary] = useState(null)

  /* modals */
  const [itemModal,  setItemModal]  = useState(null)   // {} for new, item for edit
  const [moveModal,  setMoveModal]  = useState(null)   // { item?, type? }
  const [cardItem,   setCardItem]   = useState(null)   // item id whose stock card is open
  const [countModal, setCountModal] = useState(null)   // count id, or 'new'

  const [importing,    setImporting]    = useState(false)
  const [importResult, setImportResult] = useState(null)
  const fileRef = useRef()

  const loadItems = useCallback(async () => {
    setItems(await apiFetch('/inventory/items?status=all'))
  }, [])

  const loadSummary = useCallback(async () => {
    setSummary(await apiFetch('/inventory/summary'))
  }, [])

  const refresh = useCallback(async () => {
    await Promise.all([loadItems(), loadSummary()])
  }, [loadItems, loadSummary])

  useEffect(() => {
    refresh()
      .catch(e => notify.error(e.message))
      .finally(() => setLoading(false))
  }, [refresh])

  const active     = useMemo(() => items.filter(i => i.status === 'active'), [items])
  const attention  = useMemo(() => active.filter(i => i.state !== 'ok').length, [active])

  /* ── actions ─────────────────────────────────────────── */

  const saveItem = async (body, existing) => {
    if (existing) {
      await apiFetch(`/inventory/items/${existing.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      notify.success(`${body.name ?? existing.name} updated.`)
    } else {
      await apiFetch('/inventory/items', { method: 'POST', body: JSON.stringify(body) })
      notify.success(`${body.name} added to the store.`)
    }
    await refresh()
    setItemModal(null)
  }

  const archiveItem = async (item) => {
    const ok = await confirm({
      title: `Archive ${item.name}`,
      message: 'It comes off the daily stock list and out of the reorder alerts.',
      detail: 'Every movement ever filed against it is kept, and it can be restored at any time.',
      confirmLabel: 'Archive',
      tone: 'default',
    })
    if (!ok) return
    try {
      await apiFetch(`/inventory/items/${item.id}/archive`, { method: 'POST' })
      notify.success(`${item.name} archived.`)
      await refresh()
    } catch (e) { notify.error(e.message) }
  }

  const restoreItem = async (item) => {
    try {
      await apiFetch(`/inventory/items/${item.id}/restore`, { method: 'POST' })
      notify.success(`${item.name} is back on the stock list.`)
      await refresh()
    } catch (e) { notify.error(e.message) }
  }

  /* Deleting is offered only where it is allowed to succeed — an item with
     no movements. Anything else is archived, and the API says the same, so
     a store keeper never has to find out by having the action refused. */
  const deleteItem = async (item) => {
    const ok = await confirm({
      title: `Delete ${item.name}`,
      message: 'This line has never been used, so nothing is lost by removing it.',
      detail: 'This cannot be undone.',
      confirmLabel: 'Delete',
    })
    if (!ok) return
    try {
      await apiFetch(`/inventory/items/${item.id}`, { method: 'DELETE' })
      notify.success(`${item.name} removed.`)
      await refresh()
    } catch (e) {
      notify.error(e.message)
    }
  }

  const handleImport = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true); setImportResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res    = await fetch(`${BASE}/inventory/import`, { method: 'POST', headers: await authHeaders(), body: fd })
      const result = await res.json()
      if (!res.ok) throw Object.assign(new Error(result.error || 'Import failed'), { body: result })
      setImportResult(result)
      if (result.imported) notify.success(`${result.imported} movement(s) imported.`)
      if (result.errors?.length) notify.warn(`${result.errors.length} row(s) were skipped — see the list on the page.`)
      await refresh()
    } catch (err) {
      setImportResult({ error: err.message, errors: err.body?.errors || [] })
      notify.error(err.message)
    } finally {
      setImporting(false); e.target.value = ''
    }
  }

  if (loading) return <div className="p-8 text-center text-sm" style={{ color: 'var(--ink-30)' }}><Spinner /> Loading the store…</div>

  return (
    <div style={{ animation: 'fadeUp .2s ease' }}>
      <PageHeader
        title="Store &amp; Inventory"
        sub="Packaging, ingredients, chemicals and spares — received, issued, damaged and counted"
      >
        <Btn size="sm" variant="primary" onClick={() => setMoveModal({})}>Record movement</Btn>
        <Btn size="sm" onClick={() => setItemModal({})}>+ Add item</Btn>
        <Btn size="sm" onClick={() => fileRef.current?.click()} disabled={importing}>
          {importing ? <><Spinner /> Importing…</> : '↑ Import'}
        </Btn>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={handleImport} />
      </PageHeader>

      {importResult && <ImportReport result={importResult} onClose={() => setImportResult(null)} />}

      <div className="flex mb-5 overflow-x-auto" style={{ borderBottom: '1px solid var(--ink-10)' }}>
        <TabBtn active={tab === 'overview'}  onClick={() => setTab('overview')}  count={attention}>Overview</TabBtn>
        <TabBtn active={tab === 'items'}     onClick={() => setTab('items')}>Stock list</TabBtn>
        <TabBtn active={tab === 'movements'} onClick={() => setTab('movements')}>Movements</TabBtn>
        <TabBtn active={tab === 'counts'}    onClick={() => setTab('counts')}>Stock counts</TabBtn>
        <TabBtn active={tab === 'report'}    onClick={() => setTab('report')}>Report</TabBtn>
      </div>

      {tab === 'overview' && (
        <Overview
          summary={summary} items={active}
          onOrder={item => setMoveModal({ item: items.find(i => i.id === item.id), type: 'in' })}
          onOpen={id => setCardItem(id)}
        />
      )}

      {tab === 'items' && (
        <ItemList
          items={items}
          onMove={(item, type) => setMoveModal({ item, type })}
          onEdit={item => setItemModal(item)}
          onArchive={archiveItem}
          onRestore={restoreItem}
          onDelete={deleteItem}
          onOpen={id => setCardItem(id)}
        />
      )}

      {tab === 'movements' && <Movements items={items} onChanged={refresh} />}

      {tab === 'counts' && <Counts onOpen={setCountModal} />}

      {tab === 'report' && <Report />}

      {itemModal && (
        <ItemForm
          item={itemModal.id ? itemModal : null}
          onSave={saveItem}
          onClose={() => setItemModal(null)}
        />
      )}

      {moveModal && (
        <MovementForm
          items={active}
          preset={moveModal}
          onDone={async () => { await refresh(); setMoveModal(null) }}
          onClose={() => setMoveModal(null)}
        />
      )}

      {cardItem && (
        <StockCard
          itemId={cardItem}
          onClose={() => setCardItem(null)}
          onChanged={refresh}
          onMove={(item, type) => { setCardItem(null); setMoveModal({ item, type }) }}
        />
      )}

      {countModal && (
        <CountSheet
          countId={countModal}
          onClose={() => setCountModal(null)}
          onChanged={refresh}
        />
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   IMPORT REPORT

   The old import answered with one line — "Imported 11 row(s)" — and, if
   rows had been dropped, said nothing at all about which. Every skipped
   row is named here, because a row nobody can find is a row nobody fixes.
══════════════════════════════════════════════════════════════ */
function ImportReport({ result, onClose }) {
  const failed = !!result.error
  return (
    <div className="rounded-lg text-sm mb-5" style={{
      padding: '12px 16px',
      background: failed ? 'rgba(217,64,64,0.08)' : 'var(--green-50)',
      border: `1px solid ${failed ? 'var(--red)' : 'var(--green-100)'}`,
      color: failed ? 'var(--red)' : 'var(--green-800)',
    }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          {failed
            ? <strong>{result.error}</strong>
            : <strong>
                {fmt(result.imported)} movement(s) imported
                {result.created > 0 && `, ${fmt(result.created)} new item(s) created`}.
              </strong>}
          {result.errors?.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs" style={{ color: 'var(--ink-60)' }}>
              {result.errors.map((e, i) => <li key={i}>· {e}</li>)}
              {result.truncated > 0 && <li>· …and {result.truncated} more.</li>}
            </ul>
          )}
        </div>
        <button onClick={onClose} className="border-0 bg-transparent cursor-pointer text-[16px] leading-none" style={{ color: 'inherit', opacity: .5 }}>✕</button>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   OVERVIEW

   What somebody opening this page at seven in the morning needs: what has
   run out, what is about to, and how much was broken rather than used.
══════════════════════════════════════════════════════════════ */
function Overview({ summary, items, onOrder, onOpen }) {
  if (!summary) return <EmptyState>No figures yet.</EmptyState>
  const p = summary.period

  const byCategory = useMemo(() => {
    const map = new Map()
    for (const i of items) {
      const cur = map.get(i.category) || { lines: 0, value: 0, attention: 0 }
      cur.lines += 1
      cur.value += i.stock_value
      if (i.state !== 'ok') cur.attention += 1
      map.set(i.category, cur)
    }
    return [...map.entries()].sort((a, b) => b[1].value - a[1].value)
  }, [items])

  return (
    <>
      <div className="grid gap-4 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <MetricCard label="Lines carried" value={fmt(summary.items)} unit="active items" />
        <MetricCard label="Value on the shelf" value={money(summary.stock_value)} unit="UGX" accent />
        <MetricCard label="Out of stock" value={fmt(summary.out_of_stock)}
          unit={summary.out_of_stock === 1 ? 'line' : 'lines'} note="Nothing left to issue" />
        <MetricCard label="Due an order" value={fmt(summary.low_stock)}
          unit={summary.low_stock === 1 ? 'line' : 'lines'} note="At or below reorder level" />
        <MetricCard label="Damaged" value={fmt(p.damaged)}
          unit={`units · ${p.damage_rate}% of what left the shelf`}
          note={`${money(p.damaged_value)} UGX, last 30 days`} />
      </div>

      <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        {/* ── the order sheet ── */}
        <Card noPad>
          <div className="px-5 pt-5">
            <CardTitle>
              <span>Needs ordering</span>
              {summary.needs_ordering.length > 0 && (
                <Btn size="sm" onClick={() => downloadCsv(
                  `order-sheet-${today()}.csv`,
                  ['Item', 'Category', 'On hand', 'Unit', 'Reorder level', 'Suggested order'],
                  summary.needs_ordering.map(r => [r.name, catLabel(r.category), r.current_stock, r.unit, r.reorder_level, r.suggested_order]),
                )}>Export</Btn>
              )}
            </CardTitle>
          </div>
          {summary.needs_ordering.length === 0
            ? <EmptyState>Every line is above its reorder level.</EmptyState>
            : (
              <div style={{ overflowX: 'auto' }}>
                <table className="w-full border-collapse text-[13px]">
                  <thead><tr><TH>Item</TH><TH right>On hand</TH><TH right>Level</TH><TH right>Order</TH><TH /></tr></thead>
                  <tbody>
                    {summary.needs_ordering.map(r => (
                      <Row key={r.id} onClick={() => onOpen(r.id)}>
                        <TD strong>
                          {r.name}
                          <div className="mt-1"><StateChip state={r.state} /></div>
                        </TD>
                        <TD right mono color={r.state === 'out' ? 'var(--red)' : 'var(--amber)'}>{fmt(r.current_stock, 2)} {r.unit}</TD>
                        <TD right mono>{fmt(r.reorder_level, 2)}</TD>
                        <TD right mono strong>{fmt(r.suggested_order, 2)}</TD>
                        <TD right>
                          <Btn size="sm" onClick={e => { e.stopPropagation(); onOrder(r) }}>Book in</Btn>
                        </TD>
                      </Row>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </Card>

        {/* ── the last 30 days, as arithmetic that adds up ── */}
        <Card>
          <CardTitle>Last 30 days</CardTitle>
          <p className="text-xs mb-4" style={{ color: 'var(--ink-60)' }}>
            {summary.from} to {summary.to}. Received and returned put stock on the shelf;
            issued and damaged take it off. Adjustments are what stock counts corrected.
          </p>
          <table className="w-full border-collapse text-[13px]">
            <tbody>
              {[
                ['in',     'Received',    p.received,  `${money(p.received_value)} UGX`],
                ['return', 'Returned to store', p.returned, ''],
                ['out',    'Issued to production', p.issued, ''],
                ['damage', 'Damaged / written off', p.damaged, `${money(p.damaged_value)} UGX`],
                ['adjust', 'Count adjustments', p.adjusted, ''],
              ].map(([type, label, value, aside]) => (
                <tr key={type}>
                  <TD><TypeChip type={type} /></TD>
                  <TD strong>{label}</TD>
                  {/* An adjustment carries its own direction — MOVEMENTS.adjust
                      has sign 0 — so it is the signed value that must be shown.
                      Taking the absolute value here printed a count that removed
                      fifty bottles identically to one that added fifty. */}
                  <TD right mono color={MOVEMENTS[type].color}>
                    {signPrefix(type, value)}{fmt(Math.abs(value), 2)}
                  </TD>
                  <TD right>{aside}</TD>
                </tr>
              ))}
            </tbody>
          </table>
          {p.damaged > 0 && (
            <div className="mt-4 rounded-lg text-xs" style={{ padding: '10px 14px', background: 'rgba(217,64,64,0.08)', color: 'var(--red)' }}>
              {p.damage_rate}% of everything that left the shelf was damage rather than use
              — {fmt(p.damaged, 2)} units, {money(p.damaged_value)} UGX.
            </div>
          )}
        </Card>
      </div>

      <Card noPad>
        <div className="px-5 pt-5"><CardTitle>By category</CardTitle></div>
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full border-collapse text-[13px]">
            <thead><tr><TH>Category</TH><TH>What it holds</TH><TH right>Lines</TH><TH right>Needing attention</TH><TH right>Value</TH></tr></thead>
            <tbody>
              {byCategory.length === 0 && <tr><TD colSpan={5}><EmptyState>No items yet.</EmptyState></TD></tr>}
              {byCategory.map(([cat, s]) => (
                <Row key={cat}>
                  <TD strong>{catLabel(cat)}</TD>
                  <TD>{CATEGORIES.find(c => c[0] === cat)?.[2] ?? ''}</TD>
                  <TD right mono>{fmt(s.lines)}</TD>
                  <TD right mono color={s.attention ? 'var(--amber)' : 'var(--ink-30)'}>{s.attention ? fmt(s.attention) : '—'}</TD>
                  <TD right mono strong>{money(s.value)}</TD>
                </Row>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}

/* ══════════════════════════════════════════════════════════════
   STOCK LIST
══════════════════════════════════════════════════════════════ */
function ItemList({ items, onMove, onEdit, onArchive, onRestore, onDelete, onOpen }) {
  const [q,        setQ]        = useState('')
  const [category, setCategory] = useState('all')
  const [state,    setState]    = useState('all')
  const [showArchived, setShowArchived] = useState(false)

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return items.filter(i => {
      if (!showArchived && i.status !== 'active') return false
      if (showArchived && i.status !== 'archived') return false
      if (category !== 'all' && i.category !== category) return false
      if (state === 'attention' && i.state === 'ok') return false
      if (state !== 'all' && state !== 'attention' && i.state !== state) return false
      if (!needle) return true
      return [i.name, i.code, i.supplier, i.location].some(v => v && String(v).toLowerCase().includes(needle))
    })
  }, [items, q, category, state, showArchived])

  const totalValue = shown.reduce((t, i) => t + i.stock_value, 0)

  return (
    <>
      <div className="flex flex-wrap gap-3 items-center rounded-lg mb-4 p-4" style={{ background: 'var(--cream-dark)' }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, code, supplier…" style={{ minWidth: 220 }} />
        <select value={category} onChange={e => setCategory(e.target.value)}>
          <option value="all">All categories</option>
          {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={state} onChange={e => setState(e.target.value)}>
          <option value="all">Any stock level</option>
          <option value="attention">Needs attention</option>
          <option value="out">Out of stock</option>
          <option value="low">At reorder level</option>
          <option value="ok">In stock</option>
        </select>
        <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--ink-60)' }}>
          <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />
          Archived
        </label>
        <div className="flex-1" />
        <Btn size="sm" onClick={() => downloadCsv(
          `stock-list-${today()}.csv`,
          ['Item', 'Code', 'Category', 'Unit', 'On hand', 'Reorder level', 'Unit cost', 'Value', 'Received', 'Issued', 'Damaged', 'Returned', 'Supplier', 'Location'],
          shown.map(i => [i.name, i.code, catLabel(i.category), i.unit, i.current_stock, i.reorder_level,
            i.unit_cost, i.stock_value, i.total_in, i.total_out, i.total_damaged, i.total_returned, i.supplier, i.location]),
        )}>Export CSV</Btn>
      </div>

      <Card noPad>
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <TH>Item</TH><TH>Category</TH>
                <TH right>On hand</TH><TH right>Reorder at</TH>
                <TH right>In</TH><TH right>Out</TH><TH right>Damaged</TH>
                <TH right>Value</TH><TH right>Last in</TH><TH />
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && (
                <tr><TD colSpan={10}>
                  <EmptyState>
                    {items.length === 0
                      ? 'Nothing in the store yet. Add an item, or import a stock sheet.'
                      : 'No items match these filters.'}
                  </EmptyState>
                </TD></tr>
              )}
              {shown.map(i => (
                <Row key={i.id} onClick={() => onOpen(i.id)}>
                  <TD strong>
                    {i.name}
                    <div className="flex items-center gap-2 mt-1">
                      {i.code && <span className="text-[11px]" style={{ color: 'var(--ink-30)', fontFamily: "'DM Mono', monospace" }}>{i.code}</span>}
                      {i.status === 'active' ? <StateChip state={i.state} /> : <Chip chip="var(--cream-dark)" ink="var(--ink-60)">Archived</Chip>}
                    </div>
                  </TD>
                  <TD>{catLabel(i.category)}</TD>
                  <TD right mono strong color={i.state === 'out' ? 'var(--red)' : i.state === 'low' ? 'var(--amber)' : 'var(--ink)'}>
                    {fmt(i.current_stock, 2)} <span style={{ color: 'var(--ink-30)' }}>{i.unit}</span>
                  </TD>
                  <TD right mono>{i.reorder_level > 0 ? fmt(i.reorder_level, 2) : '—'}</TD>
                  <TD right mono color={i.total_in > 0 ? 'var(--green-600)' : 'var(--ink-30)'}>{i.total_in > 0 ? fmt(i.total_in, 2) : '—'}</TD>
                  <TD right mono color={i.total_out > 0 ? 'var(--amber)' : 'var(--ink-30)'}>{i.total_out > 0 ? fmt(i.total_out, 2) : '—'}</TD>
                  <TD right mono color={i.total_damaged > 0 ? 'var(--red)' : 'var(--ink-30)'}>{i.total_damaged > 0 ? fmt(i.total_damaged, 2) : '—'}</TD>
                  <TD right mono>{i.unit_cost > 0 ? money(i.stock_value) : '—'}</TD>
                  <TD right mono>{i.last_received || '—'}</TD>
                  <TD right>
                    <div className="flex gap-1.5 justify-end" onClick={e => e.stopPropagation()}>
                      {i.status === 'active' ? (
                        <>
                          <Btn size="sm" variant="primary" onClick={() => onMove(i, 'in')}>In</Btn>
                          <Btn size="sm" onClick={() => onMove(i, 'out')} disabled={i.current_stock <= 0}
                            title={i.current_stock <= 0 ? 'Nothing on hand to issue' : 'Issue to production'}>Out</Btn>
                          <Btn size="sm" onClick={() => onEdit(i)}>Edit</Btn>
                          <Btn size="sm" onClick={() => onArchive(i)}>Archive</Btn>
                        </>
                      ) : (
                        <>
                          <Btn size="sm" variant="primary" onClick={() => onRestore(i)}>Restore</Btn>
                          {i.total_in === 0 && i.total_out === 0 && i.total_damaged === 0 && i.total_returned === 0 && (
                            <Btn size="sm" variant="danger" onClick={() => onDelete(i)}>Delete</Btn>
                          )}
                        </>
                      )}
                    </div>
                  </TD>
                </Row>
              ))}
            </tbody>
            {shown.length > 0 && (
              <tfoot>
                <tr style={{ background: 'var(--cream)' }}>
                  <TD strong colSpan={7}>{shown.length} line(s) shown</TD>
                  <TD right mono strong>{money(totalValue)}</TD>
                  <TD colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>
    </>
  )
}

/* ══════════════════════════════════════════════════════════════
   ADD / EDIT AN ITEM
══════════════════════════════════════════════════════════════ */
function ItemForm({ item, onSave, onClose }) {
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    const fd = new FormData(e.target)
    const body = {
      name:          fd.get('name'),
      code:          fd.get('code'),
      category:      fd.get('category'),
      unit:          fd.get('unit'),
      supplier:      fd.get('supplier'),
      location:      fd.get('location'),
      reorder_level: num(fd.get('reorder_level')),
      reorder_qty:   num(fd.get('reorder_qty')),
      unit_cost:     num(fd.get('unit_cost')),
      notes:         fd.get('notes'),
    }
    if (!item) {
      body.opening_stock = num(fd.get('opening_stock'))
      body.opening_date  = fd.get('opening_date')
    }
    setBusy(true)
    try {
      await onSave(body, item)
    } catch (err) {
      notify.error(err.message)
    } finally { setBusy(false) }
  }

  return (
    <Modal
      title={item ? `Edit ${item.name}` : 'Add an item to the store'}
      sub={item ? 'Changing the reorder level or unit cost does not touch the movement history.' : null}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <Field label="Name" name="name" defaultValue={item?.name} required placeholder="e.g. 500ml yoghurt bottle" />
        <Grid2>
          <Field label="Item code" name="code" defaultValue={item?.code} placeholder="optional" />
          <Field label="Unit" name="unit" defaultValue={item?.unit ?? 'pcs'} required placeholder="pcs, kg, litres, box" />
        </Grid2>
        <Field label="Category" name="category">
          <select name="category" className="w-full" defaultValue={item?.category ?? 'packaging'}>
            {CATEGORIES.map(([v, l, hint]) => <option key={v} value={v}>{l} — {hint}</option>)}
          </select>
        </Field>
        <Grid2>
          <Field label="Reorder level" name="reorder_level" type="number" min="0" step="any"
            defaultValue={item?.reorder_level ?? 0}
            hint="Warn at this figure. Leave at 0 for no warning." />
          <Field label="Usual order size" name="reorder_qty" type="number" min="0" step="any"
            defaultValue={item?.reorder_qty ?? 0}
            hint="Suggested on the order sheet." />
        </Grid2>
        <Grid2>
          <Field label="Unit cost (UGX)" name="unit_cost" type="number" min="0" step="any"
            defaultValue={item?.unit_cost ?? 0}
            hint="Updated automatically by a priced delivery." />
          <Field label="Supplier" name="supplier" defaultValue={item?.supplier} placeholder="optional" />
        </Grid2>
        <Field label="Kept where" name="location" defaultValue={item?.location} placeholder="e.g. Main store, rack B" />

        {!item && (
          <Grid2>
            <Field label="Opening stock" name="opening_stock" type="number" min="0" step="any" defaultValue={0}
              hint="Booked in as a receipt, so it appears on the stock card." />
            <Field label="Counted on" name="opening_date" type="date" defaultValue={today()} />
          </Grid2>
        )}

        <Field label="Notes" name="notes" defaultValue={item?.notes} />

        <div className="flex gap-2 justify-end mt-2">
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn type="submit" variant="primary" disabled={busy}>
            {busy ? <><Spinner /> Saving…</> : item ? 'Save changes' : 'Add item'}
          </Btn>
        </div>
      </form>
    </Modal>
  )
}

/* ══════════════════════════════════════════════════════════════
   RECORD A MOVEMENT

   The form knows what is on the shelf and says so as the quantity is
   typed. Issuing more than there is used to be accepted, silently, and
   left the balance negative — now the resulting figure is shown before
   the button is pressed, and the button will not submit an impossible one.
══════════════════════════════════════════════════════════════ */
function MovementForm({ items, preset, onDone, onClose }) {
  const [itemId, setItemId] = useState(preset.item?.id ?? '')
  const [type,   setType]   = useState(preset.type ?? 'in')
  const [qty,    setQty]    = useState('')
  const [busy,   setBusy]   = useState(false)

  const item = items.find(i => String(i.id) === String(itemId))
  const meta = MOVEMENTS[type]
  const quantity = num(qty)

  const after   = item ? item.current_stock + meta.sign * quantity : null
  const impossible = meta.sign === -1 && item && quantity > item.current_stock
  const belowLevel = after !== null && item && item.reorder_level > 0 && after <= item.reorder_level && after > 0

  const submit = async (e) => {
    e.preventDefault()
    const fd = new FormData(e.target)
    setBusy(true)
    try {
      const res = await apiFetch('/inventory/logs', {
        method: 'POST',
        body: JSON.stringify({
          item_id:   itemId,
          type,
          quantity,
          date:      fd.get('date'),
          reference: fd.get('reference'),
          party:     fd.get('party'),
          unit_cost: fd.get('unit_cost') || undefined,
          notes:     fd.get('notes'),
        }),
      })
      notify.success(`${meta.label}: ${fmt(quantity, 2)} ${item.unit} of ${item.name}. Now ${fmt(res.balance_after, 2)} on hand.`)
      await onDone()
    } catch (err) {
      notify.error(err.message)
    } finally { setBusy(false) }
  }

  return (
    <Modal title="Record a stock movement" onClose={onClose}
      sub="Corrections to the balance are made by posting a stock count, not here.">
      <form onSubmit={submit}>
        <Field label="Item" name="item_id">
          <select className="w-full" value={itemId} onChange={e => setItemId(e.target.value)} required>
            <option value="">Choose an item…</option>
            {CATEGORIES.map(([cat, label]) => {
              const group = items.filter(i => i.category === cat)
              if (!group.length) return null
              return (
                <optgroup key={cat} label={label}>
                  {group.map(i => (
                    <option key={i.id} value={i.id}>{i.name} — {fmt(i.current_stock, 2)} {i.unit} on hand</option>
                  ))}
                </optgroup>
              )
            })}
          </select>
        </Field>

        <Field label="What happened">
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            {RECORDABLE.map(t => (
              <button key={t} type="button" onClick={() => setType(t)}
                className="rounded-lg border text-sm font-medium cursor-pointer transition-all"
                style={{
                  padding: '10px 12px', textAlign: 'left',
                  borderColor: type === t ? MOVEMENTS[t].color : 'var(--ink-10)',
                  background:  type === t ? MOVEMENTS[t].chip  : 'var(--surface)',
                  color:       type === t ? MOVEMENTS[t].ink   : 'var(--ink-60)',
                }}>
                {MOVEMENTS[t].label}
                <div className="text-[11px] mt-0.5 font-normal" style={{ opacity: .75 }}>
                  {t === 'in' && 'A delivery arrived'}
                  {t === 'out' && 'Issued to production'}
                  {t === 'damage' && 'Broken, spoilt or expired'}
                  {t === 'return' && 'Unused, back to the store'}
                </div>
              </button>
            ))}
          </div>
        </Field>

        <Grid2>
          <Field label={`Quantity${item ? ` (${item.unit})` : ''}`}>
            <input type="number" min="0" step="any" value={qty} onChange={e => setQty(e.target.value)}
              required className="w-full"
              style={{ borderColor: impossible ? 'var(--red)' : undefined, color: impossible ? 'var(--red)' : undefined }} />
          </Field>
          <Field label="Date" name="date" type="date" defaultValue={today()} required max={today()} />
        </Grid2>

        {/* What the shelf will read afterwards — before it is committed. */}
        {item && quantity > 0 && (
          <div className="rounded-lg text-xs mb-4" style={{
            padding: '10px 14px',
            background: impossible ? 'rgba(217,64,64,0.08)' : belowLevel ? 'rgba(232,160,32,0.12)' : 'var(--cream-dark)',
            color:      impossible ? 'var(--red)' : belowLevel ? 'var(--amber)' : 'var(--ink-60)',
          }}>
            {impossible
              ? <>Only {fmt(item.current_stock, 2)} {item.unit} on hand — {type === 'damage' ? 'writing off' : 'issuing'} {fmt(quantity, 2)} would take the balance below zero. Book in the delivery first, or post a stock count if the book is wrong.</>
              : <>
                  {fmt(item.current_stock, 2)} {item.unit} on hand → <strong>{fmt(after, 2)} {item.unit}</strong> after this.
                  {belowLevel && ` That is at or below the reorder level of ${fmt(item.reorder_level, 2)}.`}
                </>}
          </div>
        )}

        <Grid2>
          <Field label={type === 'in' ? 'Delivery note / invoice' : 'Requisition no.'} name="reference" placeholder="optional" />
          <Field label={type === 'in' ? 'Supplier' : type === 'out' ? 'Issued to' : 'Who reported it'} name="party" placeholder="optional" />
        </Grid2>

        {type === 'in' && (
          <Field label="Unit cost (UGX)" name="unit_cost" type="number" min="0" step="any"
            defaultValue={item?.unit_cost || ''}
            hint="Updates the item's cost, so the value of the shelf follows the latest price." />
        )}

        <Field label="Notes" name="notes"
          placeholder={type === 'damage' ? 'What happened — crate dropped, seal failed, past date…' : 'optional'} />

        <div className="flex gap-2 justify-end mt-2">
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn type="submit" variant="primary" disabled={busy || impossible || !itemId || !(quantity > 0)}>
            {busy ? <><Spinner /> Recording…</> : `Record ${meta.label.toLowerCase()}`}
          </Btn>
        </div>
      </form>
    </Modal>
  )
}

/* ══════════════════════════════════════════════════════════════
   THE STOCK CARD

   One item's whole life: what it is, what it is worth, and every
   movement with the balance it left behind. The running balance comes
   from the API rather than being re-added here, so the column cannot
   drift from the figure at the top of the page.
══════════════════════════════════════════════════════════════ */
function StockCard({ itemId, onClose, onChanged, onMove }) {
  const confirm = useConfirm()
  const [data, setData] = useState(null)
  const [err,  setErr]  = useState(null)

  const load = useCallback(async () => {
    try { setData(await apiFetch(`/inventory/items/${itemId}`)) }
    catch (e) { setErr(e.message) }
  }, [itemId])

  useEffect(() => { load() }, [load])

  const removeMovement = async (m) => {
    const ok = await confirm({
      title: 'Remove this movement',
      message: `${MOVEMENTS[m.type].label} of ${fmt(m.quantity, 2)} on ${m.date} will be taken off the stock card.`,
      detail: 'The balance is recalculated from what is left. Use this for a mistyped entry, not to hide one.',
      confirmLabel: 'Remove',
    })
    if (!ok) return
    try {
      await apiFetch(`/inventory/logs/${m.id}`, { method: 'DELETE' })
      notify.success('Movement removed.')
      await load(); await onChanged()
    } catch (e) { notify.error(e.message) }
  }

  if (err)   return <Modal title="Stock card" onClose={onClose}><div className="text-sm" style={{ color: 'var(--red)' }}>{err}</div></Modal>
  if (!data) return <Modal title="Stock card" onClose={onClose}><div className="text-sm" style={{ color: 'var(--ink-30)' }}><Spinner /> Loading…</div></Modal>

  return (
    <Modal wide onClose={onClose}
      title={data.name}
      sub={[catLabel(data.category), data.code, data.supplier, data.location].filter(Boolean).join(' · ')}
    >
      <div className="grid gap-4 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
        <MetricCard label="On hand" value={fmt(data.current_stock, 2)} unit={data.unit}
          note={data.reorder_level > 0 ? `Reorder at ${fmt(data.reorder_level, 2)}` : 'No reorder level set'} accent />
        <MetricCard label="Received" value={fmt(data.total_in, 2)} unit={data.unit} />
        <MetricCard label="Issued" value={fmt(data.total_out, 2)} unit={data.unit} />
        <MetricCard label="Damaged" value={fmt(data.total_damaged, 2)} unit={data.unit}
          note={data.total_out + data.total_damaged > 0
            ? `${Math.round((data.total_damaged / (data.total_out + data.total_damaged)) * 1000) / 10}% of what left`
            : null} />
        <MetricCard label="Value" value={money(data.stock_value)} unit="UGX"
          note={data.unit_cost > 0 ? `at ${money(data.unit_cost)}/${data.unit}` : 'no unit cost set'} />
      </div>

      {data.notes && (
        <div className="rounded-lg text-xs mb-4" style={{ padding: '10px 14px', background: 'var(--cream-dark)', color: 'var(--ink-60)' }}>
          {data.notes}
        </div>
      )}

      <div className="flex gap-2 mb-4 flex-wrap">
        {RECORDABLE.map(t => (
          <Btn key={t} size="sm" variant={t === 'in' ? 'primary' : 'default'}
            disabled={MOVEMENTS[t].sign === -1 && data.current_stock <= 0}
            onClick={() => onMove(data, t)}>{MOVEMENTS[t].label}</Btn>
        ))}
        <div className="flex-1" />
        <Btn size="sm" onClick={() => downloadCsv(
          `${data.name.replace(/[^\w]+/g, '-')}-stock-card.csv`,
          ['Date', 'Movement', 'Quantity', 'Balance after', 'Reference', 'Party', 'Recorded by', 'Notes'],
          data.movements.map(m => [m.date, MOVEMENTS[m.type].label, m.quantity, m.running_balance, m.reference, m.party, m.recorded_by, m.notes]),
        )}>Export card</Btn>
      </div>

      <div style={{ maxHeight: 380, overflowY: 'auto', overflowX: 'auto' }}>
        <table className="w-full border-collapse text-[13px]">
          <thead style={{ position: 'sticky', top: 0, background: 'var(--surface)' }}>
            <tr><TH>Date</TH><TH>Movement</TH><TH right>Qty</TH><TH right>Balance</TH><TH>Reference</TH><TH>Who</TH><TH>Notes</TH><TH /></tr>
          </thead>
          <tbody>
            {data.movements.length === 0 && (
              <tr><TD colSpan={8}><EmptyState>Nothing has moved yet.</EmptyState></TD></tr>
            )}
            {data.movements.map(m => {
              const meta = MOVEMENTS[m.type]
              const signed = m.type === 'adjust' ? m.quantity : meta.sign * m.quantity
              return (
                <Row key={m.id}>
                  <TD mono>{m.date}</TD>
                  <TD><TypeChip type={m.type} /></TD>
                  <TD right mono strong color={signed < 0 ? 'var(--red)' : 'var(--green-600)'}>
                    {signPrefix(m.type, signed)}{fmt(Math.abs(signed), 2)}
                  </TD>
                  <TD right mono strong>{fmt(m.running_balance, 2)}</TD>
                  <TD mono>{m.reference || '—'}</TD>
                  <TD>{m.party || m.recorded_by || '—'}</TD>
                  <TD title={m.notes}>{m.notes ? (m.notes.length > 40 ? m.notes.slice(0, 40) + '…' : m.notes) : '—'}</TD>
                  <TD right>
                    {!m.count_id && (
                      <Btn size="sm" variant="danger" onClick={() => removeMovement(m)} title="Remove a mistyped entry">✕</Btn>
                    )}
                  </TD>
                </Row>
              )
            })}
          </tbody>
        </table>
      </div>
    </Modal>
  )
}

/* ══════════════════════════════════════════════════════════════
   MOVEMENTS
══════════════════════════════════════════════════════════════ */
function Movements({ items, onChanged }) {
  const confirm = useConfirm()
  const [logs,  setLogs]  = useState([])
  const [busy,  setBusy]  = useState(true)
  const [f, setF] = useState({ item_id: '', type: 'all', category: 'all', from: daysAgo(29), to: today(), q: '' })

  const load = useCallback(async () => {
    setBusy(true)
    try {
      const p = new URLSearchParams()
      Object.entries(f).forEach(([k, v]) => { if (v && v !== 'all') p.set(k, v) })
      setLogs(await apiFetch(`/inventory/logs?${p}`))
    } catch (e) { notify.error(e.message) }
    finally { setBusy(false) }
  }, [f])

  useEffect(() => { load() }, [load])

  const remove = async (m) => {
    if (m.count_id) {
      notify.warn('This adjustment belongs to a posted stock count. Post a further count to correct the balance.')
      return
    }
    const ok = await confirm({
      title: 'Remove this movement',
      message: `${MOVEMENTS[m.type].label} of ${fmt(m.quantity, 2)} ${m.unit} — ${m.item_name}, ${m.date}.`,
      detail: 'The balance is recalculated from what is left.',
      confirmLabel: 'Remove',
    })
    if (!ok) return
    try {
      await apiFetch(`/inventory/logs/${m.id}`, { method: 'DELETE' })
      notify.success('Movement removed.')
      await load(); await onChanged()
    } catch (e) { notify.error(e.message) }
  }

  /* Totals for exactly what is on screen, so a filtered view answers
     "how many bottles went out in June" without anyone adding up a column
     by hand and getting it wrong. */
  const totals = useMemo(() => {
    const t = { in: 0, out: 0, damage: 0, return: 0, adjust: 0 }
    for (const l of logs) t[l.type] = (t[l.type] || 0) + l.quantity
    return t
  }, [logs])

  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }))

  return (
    <>
      <div className="flex flex-wrap gap-3 items-center rounded-lg mb-4 p-4" style={{ background: 'var(--cream-dark)' }}>
        <select value={f.item_id} onChange={e => set('item_id', e.target.value)}>
          <option value="">All items</option>
          {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
        <select value={f.type} onChange={e => set('type', e.target.value)}>
          <option value="all">All movements</option>
          {Object.entries(MOVEMENTS).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
        </select>
        <select value={f.category} onChange={e => set('category', e.target.value)}>
          <option value="all">All categories</option>
          {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input type="date" value={f.from} onChange={e => set('from', e.target.value)} />
        <input type="date" value={f.to}   onChange={e => set('to', e.target.value)} />
        <input value={f.q} onChange={e => set('q', e.target.value)} placeholder="Reference, supplier, note…" style={{ minWidth: 180 }} />
        <Btn size="sm" onClick={() => setF({ item_id: '', type: 'all', category: 'all', from: '', to: '', q: '' })}>Clear</Btn>
        <div className="flex-1" />
        <Btn size="sm" onClick={() => downloadCsv(
          `stock-movements-${f.from || 'all'}-to-${f.to || today()}.csv`,
          ['Date', 'Item', 'Category', 'Movement', 'Quantity', 'Unit', 'Reference', 'Party', 'Recorded by', 'Notes'],
          logs.map(l => [l.date, l.item_name, catLabel(l.category), MOVEMENTS[l.type].label, l.quantity, l.unit, l.reference, l.party, l.recorded_by, l.notes]),
        )}>Export CSV</Btn>
      </div>

      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        {Object.entries(MOVEMENTS).map(([t, m]) => (
          <div key={t} className="rounded-lg border px-4 py-3" style={{ borderColor: 'var(--ink-10)', background: 'var(--surface)' }}>
            <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--ink-60)' }}>{m.label}</div>
            <div className="text-[20px] font-semibold" style={{ color: totals[t] ? m.color : 'var(--ink-30)' }}>
              {fmt(totals[t] || 0, 2)}
            </div>
          </div>
        ))}
      </div>

      <Card noPad>
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr><TH>Date</TH><TH>Item</TH><TH>Movement</TH><TH right>Qty</TH><TH>Reference</TH><TH>Party</TH><TH>Recorded by</TH><TH>Notes</TH><TH /></tr>
            </thead>
            <tbody>
              {busy && <tr><TD colSpan={9}><EmptyState><Spinner /> Loading…</EmptyState></TD></tr>}
              {!busy && logs.length === 0 && <tr><TD colSpan={9}><EmptyState>No movements in this range.</EmptyState></TD></tr>}
              {!busy && logs.map(l => {
                const meta   = MOVEMENTS[l.type]
                const signed = l.type === 'adjust' ? l.quantity : meta.sign * l.quantity
                return (
                  <Row key={l.id}>
                    <TD mono>{l.date}</TD>
                    <TD strong>{l.item_name}</TD>
                    <TD><TypeChip type={l.type} /></TD>
                    <TD right mono strong color={signed < 0 ? 'var(--red)' : 'var(--green-600)'}>
                      {signPrefix(l.type, signed)}{fmt(Math.abs(signed), 2)} <span style={{ color: 'var(--ink-30)' }}>{l.unit}</span>
                    </TD>
                    <TD mono>{l.reference || '—'}</TD>
                    <TD>{l.party || '—'}</TD>
                    <TD>{l.recorded_by || '—'}</TD>
                    <TD title={l.notes}>{l.notes ? (l.notes.length > 36 ? l.notes.slice(0, 36) + '…' : l.notes) : '—'}</TD>
                    <TD right>
                      {!l.count_id && <Btn size="sm" variant="danger" onClick={() => remove(l)} title="Remove a mistyped entry">✕</Btn>}
                    </TD>
                  </Row>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}

/* ══════════════════════════════════════════════════════════════
   STOCK COUNTS
══════════════════════════════════════════════════════════════ */
function Counts({ onOpen }) {
  const confirm = useConfirm()
  const [counts, setCounts] = useState([])
  const [busy,   setBusy]   = useState(true)
  const [opening, setOpening] = useState(false)

  const load = useCallback(async () => {
    setBusy(true)
    try { setCounts(await apiFetch('/inventory/counts')) }
    catch (e) { notify.error(e.message) }
    finally { setBusy(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const open = async () => {
    setOpening(true)
    try {
      const c = await apiFetch('/inventory/counts', {
        method: 'POST',
        body: JSON.stringify({ count_date: today() }),
      })
      notify.success(`${c.ref} opened with ${c.lines} line(s) to count.`)
      await load()
      onOpen(c.id)
    } catch (e) { notify.error(e.message) }
    finally { setOpening(false) }
  }

  const discard = async (c) => {
    const ok = await confirm({
      title: `Discard ${c.ref}`,
      message: 'Nothing has been posted from this count, so nothing changes on the shelf.',
      confirmLabel: 'Discard',
    })
    if (!ok) return
    try {
      await apiFetch(`/inventory/counts/${c.id}`, { method: 'DELETE' })
      notify.success('Count discarded.')
      await load()
    } catch (e) { notify.error(e.message) }
  }

  return (
    <>
      <Card>
        <CardTitle>
          <span>Counting the shelf against the book</span>
          <Btn size="sm" variant="primary" onClick={open} disabled={opening}>
            {opening ? <><Spinner /> Opening…</> : '+ Start a count'}
          </Btn>
        </CardTitle>
        <p className="text-sm" style={{ color: 'var(--ink-60)' }}>
          A count opens as a draft with one line per active item. Type in what is actually on the
          shelf, then post it: every line that disagrees with the book gets one adjustment carrying
          the difference, dated to the count and signed by whoever posted it. Lines that agree write
          nothing. This is the only way a balance changes without a delivery, an issue or a breakage
          behind it — so no figure on this page can be quietly typed over.
        </p>
      </Card>

      <Card noPad>
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr><TH>Reference</TH><TH>Date</TH><TH>Status</TH><TH right>Lines</TH><TH right>Variances</TH><TH>Counted by</TH><TH>Posted</TH><TH /></tr>
            </thead>
            <tbody>
              {busy && <tr><TD colSpan={8}><EmptyState><Spinner /> Loading…</EmptyState></TD></tr>}
              {!busy && counts.length === 0 && (
                <tr><TD colSpan={8}><EmptyState>No stock counts yet. The first one sets the book straight.</EmptyState></TD></tr>
              )}
              {!busy && counts.map(c => (
                <Row key={c.id} onClick={() => onOpen(c.id)}>
                  <TD strong mono>{c.ref}</TD>
                  <TD mono>{c.count_date}</TD>
                  <TD>
                    <Chip
                      chip={c.status === 'posted' ? 'var(--green-100)' : c.status === 'cancelled' ? 'var(--cream-dark)' : 'rgba(232,160,32,0.15)'}
                      ink={c.status === 'posted' ? 'var(--green-800)' : c.status === 'cancelled' ? 'var(--ink-60)' : 'var(--amber)'}>
                      {c.status.toUpperCase()}
                    </Chip>
                  </TD>
                  <TD right mono>{fmt(c.lines)}</TD>
                  <TD right mono color={c.variances > 0 ? 'var(--red)' : 'var(--ink-30)'}>
                    {c.status === 'posted' ? (c.variances > 0 ? fmt(c.variances) : 'none') : '—'}
                  </TD>
                  <TD>{c.counted_by || '—'}</TD>
                  <TD mono>{c.posted_at ? String(c.posted_at).slice(0, 10) : '—'}</TD>
                  <TD right>
                    <div onClick={e => e.stopPropagation()} className="flex gap-1.5 justify-end">
                      <Btn size="sm" onClick={() => onOpen(c.id)}>{c.status === 'draft' ? 'Continue' : 'View'}</Btn>
                      {c.status === 'draft' && <Btn size="sm" variant="danger" onClick={() => discard(c)}>Discard</Btn>}
                    </div>
                  </TD>
                </Row>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}

/**
 * One count sheet.
 *
 * The book figure beside every line is what the ledger says right now, and
 * the variance updates as the counted figure is typed — so the person with
 * the clipboard sees the discrepancy while they are still standing at the
 * shelf and can recount, rather than discovering it a week later.
 */
function CountSheet({ countId, onClose, onChanged }) {
  const confirm = useConfirm()
  const [count,   setCount]   = useState(null)
  const [entered, setEntered] = useState({})
  const [busy,    setBusy]    = useState(false)
  const [onlyVar, setOnlyVar] = useState(false)

  const load = useCallback(async () => {
    const c = await apiFetch(`/inventory/counts/${countId}`)
    setCount(c)
    setEntered(Object.fromEntries(c.lines.map(l => [l.item_id, String(l.counted_qty)])))
  }, [countId])

  useEffect(() => { load().catch(e => notify.error(e.message)) }, [load])

  const draft = count?.status === 'draft'

  const lines = useMemo(() => {
    if (!count) return []
    return count.lines.map(l => {
      const counted  = draft ? num(entered[l.item_id]) : l.counted_qty
      const variance = Math.round((counted - l.book_qty) * 1000) / 1000
      return { ...l, counted, variance, variance_value: Math.round(variance * l.unit_cost * 100) / 100 }
    })
  }, [count, entered, draft])

  const shown     = onlyVar ? lines.filter(l => l.variance !== 0) : lines
  const variances = lines.filter(l => l.variance !== 0)
  const shrinkage = variances.reduce((t, l) => t + l.variance_value, 0)

  const save = async () => {
    setBusy(true)
    try {
      await apiFetch(`/inventory/counts/${countId}`, {
        method: 'PATCH',
        body: JSON.stringify({ lines: lines.map(l => ({ item_id: l.item_id, counted_qty: l.counted })) }),
      })
      notify.success('Count saved. It stays a draft until you post it.')
      await load()
    } catch (e) { notify.error(e.message) }
    finally { setBusy(false) }
  }

  const post = async () => {
    const ok = await confirm({
      title: `Post ${count.ref}`,
      message: variances.length === 0
        ? 'Every line agrees with the book. Posting closes the count and writes no adjustments.'
        : `${variances.length} line(s) disagree with the book. Posting writes one adjustment each, dated ${count.count_date}.`,
      detail: 'A posted count cannot be edited or deleted — it is the record behind the adjustments it makes.',
      confirmLabel: 'Post the count',
      tone: variances.length ? 'danger' : 'default',
    })
    if (!ok) return
    setBusy(true)
    try {
      await apiFetch(`/inventory/counts/${countId}`, {
        method: 'PATCH',
        body: JSON.stringify({ lines: lines.map(l => ({ item_id: l.item_id, counted_qty: l.counted })) }),
      })
      const res = await apiFetch(`/inventory/counts/${countId}/post`, { method: 'POST' })
      notify.success(res.adjustments.length
        ? `${res.ref} posted — ${res.adjustments.length} balance(s) corrected.`
        : `${res.ref} posted. The book was already right.`)
      await load(); await onChanged()
    } catch (e) { notify.error(e.message) }
    finally { setBusy(false) }
  }

  if (!count) return <Modal title="Stock count" onClose={onClose}><div className="text-sm" style={{ color: 'var(--ink-30)' }}><Spinner /> Loading…</div></Modal>

  return (
    <Modal wide onClose={onClose}
      title={`Stock count ${count.ref}`}
      sub={`${count.count_date} · ${count.status.toUpperCase()}${count.counted_by ? ` · opened by ${count.counted_by}` : ''}${count.posted_by ? ` · posted by ${count.posted_by}` : ''}`}
    >
      <div className="grid gap-4 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        <MetricCard label="Lines" value={fmt(lines.length)} unit="items counted" />
        <MetricCard label="Disagreeing" value={fmt(variances.length)} unit="lines"
          note={variances.length ? 'Each writes one adjustment' : 'Book matches the shelf'} />
        <MetricCard label="Net variance value" value={money(shrinkage)} unit="UGX"
          note={shrinkage < 0 ? 'Stock is short of the book' : shrinkage > 0 ? 'More on the shelf than booked' : 'Balanced'} />
      </div>

      {draft && (
        <div className="rounded-lg text-xs mb-4" style={{ padding: '10px 14px', background: 'var(--cream-dark)', color: 'var(--ink-60)' }}>
          Type what is actually on the shelf. The book figure is what the movement log says right now —
          if a delivery is recorded while you count, save and reopen so you are comparing against the same book.
        </div>
      )}

      <div className="flex gap-2 items-center mb-3 flex-wrap">
        <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--ink-60)' }}>
          <input type="checkbox" checked={onlyVar} onChange={e => setOnlyVar(e.target.checked)} />
          Only lines that disagree
        </label>
        <div className="flex-1" />
        <Btn size="sm" onClick={() => downloadCsv(
          `${count.ref}.csv`,
          ['Item', 'Category', 'Unit', 'Book', 'Counted', 'Variance', 'Variance value'],
          lines.map(l => [l.name, catLabel(l.category), l.unit, l.book_qty, l.counted, l.variance, l.variance_value]),
        )}>Export sheet</Btn>
      </div>

      <div style={{ maxHeight: 380, overflowY: 'auto', overflowX: 'auto' }}>
        <table className="w-full border-collapse text-[13px]">
          <thead style={{ position: 'sticky', top: 0, background: 'var(--surface)' }}>
            <tr><TH>Item</TH><TH>Category</TH><TH right>Book</TH><TH right>Counted</TH><TH right>Variance</TH><TH right>Value</TH></tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr><TD colSpan={6}><EmptyState>{onlyVar ? 'Every line agrees with the book.' : 'This count has no lines.'}</EmptyState></TD></tr>
            )}
            {shown.map(l => (
              <Row key={l.id}>
                <TD strong>{l.name}</TD>
                <TD>{catLabel(l.category)}</TD>
                <TD right mono>{fmt(l.book_qty, 2)} <span style={{ color: 'var(--ink-30)' }}>{l.unit}</span></TD>
                <td className="px-4 py-2 border-b text-right" style={{ borderColor: 'var(--ink-10)' }}>
                  {draft ? (
                    <input type="number" min="0" step="any" style={{ width: 110, textAlign: 'right' }}
                      value={entered[l.item_id] ?? ''}
                      onChange={e => setEntered(prev => ({ ...prev, [l.item_id]: e.target.value }))} />
                  ) : (
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{fmt(l.counted, 2)}</span>
                  )}
                </td>
                <TD right mono strong color={l.variance === 0 ? 'var(--ink-30)' : l.variance < 0 ? 'var(--red)' : 'var(--green-600)'}>
                  {l.variance === 0 ? '—' : `${l.variance > 0 ? '+' : '−'}${fmt(Math.abs(l.variance), 2)}`}
                </TD>
                <TD right mono color={l.variance_value < 0 ? 'var(--red)' : 'var(--ink-60)'}>
                  {l.variance === 0 ? '—' : money(l.variance_value)}
                </TD>
              </Row>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2 justify-end mt-5">
        <Btn onClick={onClose}>Close</Btn>
        {draft && <Btn onClick={save} disabled={busy}>{busy ? <><Spinner /> Saving…</> : 'Save draft'}</Btn>}
        {draft && <Btn variant="primary" onClick={post} disabled={busy}>{busy ? <><Spinner /> Posting…</> : 'Post the count'}</Btn>}
      </div>
    </Modal>
  )
}

/* ══════════════════════════════════════════════════════════════
   REPORT

   Opening, what moved, closing — per item, for a period. The row adds up
   in front of the reader: opening + received + returned − issued −
   damaged ± adjustments = closing. If those two figures ever disagreed,
   the page would be the first place it showed.
══════════════════════════════════════════════════════════════ */
function Report() {
  const [from, setFrom] = useState(daysAgo(29))
  const [to,   setTo]   = useState(today())
  const [category, setCategory] = useState('all')
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(true)

  const load = useCallback(async () => {
    setBusy(true)
    try {
      const p = new URLSearchParams({ from, to })
      if (category !== 'all') p.set('category', category)
      setData(await apiFetch(`/inventory/report?${p}`))
    } catch (e) { notify.error(e.message) }
    finally { setBusy(false) }
  }, [from, to, category])

  useEffect(() => { load() }, [load])

  const moved = useMemo(
    () => (data?.rows || []).filter(r => r.received || r.issued || r.damaged || r.returned || r.adjusted || r.closing),
    [data]
  )

  return (
    <>
      <div className="flex flex-wrap gap-3 items-center rounded-lg mb-4 p-4" style={{ background: 'var(--cream-dark)' }}>
        <label className="text-xs uppercase tracking-wider" style={{ color: 'var(--ink-60)' }}>From</label>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
        <label className="text-xs uppercase tracking-wider" style={{ color: 'var(--ink-60)' }}>To</label>
        <input type="date" value={to} onChange={e => setTo(e.target.value)} />
        <select value={category} onChange={e => setCategory(e.target.value)}>
          <option value="all">All categories</option>
          {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <Btn size="sm" onClick={() => { setFrom(daysAgo(29)); setTo(today()) }}>Last 30 days</Btn>
        <Btn size="sm" onClick={() => {
          const d = new Date()
          setFrom(new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10))
          setTo(today())
        }}>This month</Btn>
        <div className="flex-1" />
        {data && (
          <Btn size="sm" onClick={() => downloadCsv(
            `inventory-report-${data.from}-to-${data.to}.csv`,
            ['Item', 'Category', 'Unit', 'Opening', 'Received', 'Returned', 'Issued', 'Damaged', 'Adjustments', 'Closing', 'Closing value', 'Damage rate %'],
            moved.map(r => [r.name, catLabel(r.category), r.unit, r.opening, r.received, r.returned, r.issued, r.damaged, r.adjusted, r.closing, r.closing_value, r.damage_rate]),
          )}>Export CSV</Btn>
        )}
      </div>

      {busy && <EmptyState><Spinner /> Working out the period…</EmptyState>}

      {!busy && data && (
        <>
          <div className="grid gap-4 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            <MetricCard label="Received" value={fmt(data.totals.received, 2)} unit="units in" />
            <MetricCard label="Issued" value={fmt(data.totals.issued, 2)} unit="units to production" />
            <MetricCard label="Damaged" value={fmt(data.totals.damaged, 2)} unit="units written off"
              note={`${money(data.totals.damaged_value)} UGX`} />
            <MetricCard label="Count adjustments" value={fmt(data.totals.adjusted, 2)} unit="units corrected" />
            <MetricCard label="Closing value" value={money(data.totals.closing_value)} unit="UGX" accent />
          </div>

          <Card noPad>
            <div style={{ overflowX: 'auto' }}>
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr>
                    <TH>Item</TH><TH right>Opening</TH><TH right>Received</TH><TH right>Returned</TH>
                    <TH right>Issued</TH><TH right>Damaged</TH><TH right>Adjust</TH>
                    <TH right>Closing</TH><TH right>Damage %</TH><TH right>Value</TH>
                  </tr>
                </thead>
                <tbody>
                  {moved.length === 0 && (
                    <tr><TD colSpan={10}><EmptyState>Nothing moved in this period.</EmptyState></TD></tr>
                  )}
                  {moved.map(r => (
                    <Row key={r.id}>
                      <TD strong>
                        {r.name}
                        <div className="text-[11px] mt-0.5" style={{ color: 'var(--ink-30)' }}>{catLabel(r.category)} · {r.unit}</div>
                      </TD>
                      <TD right mono>{fmt(r.opening, 2)}</TD>
                      <TD right mono color={r.received ? 'var(--green-600)' : 'var(--ink-30)'}>{r.received ? fmt(r.received, 2) : '—'}</TD>
                      <TD right mono color={r.returned ? 'var(--blue)' : 'var(--ink-30)'}>{r.returned ? fmt(r.returned, 2) : '—'}</TD>
                      <TD right mono color={r.issued ? 'var(--amber)' : 'var(--ink-30)'}>{r.issued ? fmt(r.issued, 2) : '—'}</TD>
                      <TD right mono color={r.damaged ? 'var(--red)' : 'var(--ink-30)'}>{r.damaged ? fmt(r.damaged, 2) : '—'}</TD>
                      <TD right mono color={r.adjusted ? 'var(--ink-60)' : 'var(--ink-30)'}>
                        {r.adjusted ? `${r.adjusted > 0 ? '+' : '−'}${fmt(Math.abs(r.adjusted), 2)}` : '—'}
                      </TD>
                      <TD right mono strong color={r.state === 'out' ? 'var(--red)' : r.state === 'low' ? 'var(--amber)' : 'var(--ink)'}>
                        {fmt(r.closing, 2)}
                      </TD>
                      <TD right mono color={r.damage_rate > 5 ? 'var(--red)' : 'var(--ink-60)'}>
                        {r.issued + r.damaged > 0 ? `${r.damage_rate}%` : '—'}
                      </TD>
                      <TD right mono>{r.unit_cost > 0 ? money(r.closing_value) : '—'}</TD>
                    </Row>
                  ))}
                </tbody>
                {moved.length > 0 && (
                  <tfoot>
                    <tr style={{ background: 'var(--cream)' }}>
                      <TD strong>Total — {data.from} to {data.to}</TD>
                      <TD />
                      <TD right mono strong>{fmt(data.totals.received, 2)}</TD>
                      <TD right mono strong>{fmt(data.totals.returned, 2)}</TD>
                      <TD right mono strong>{fmt(data.totals.issued, 2)}</TD>
                      <TD right mono strong color="var(--red)">{fmt(data.totals.damaged, 2)}</TD>
                      <TD right mono strong>{fmt(data.totals.adjusted, 2)}</TD>
                      <TD colSpan={2} />
                      <TD right mono strong>{money(data.totals.closing_value)}</TD>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Card>
        </>
      )}
    </>
  )
}
