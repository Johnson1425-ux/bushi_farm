import { useState, useEffect, useCallback, Fragment } from 'react'
import { apiFetch } from '../lib/api'
import { Card, CardTitle, Btn, PageHeader, EmptyState } from '../components/ui'
import { useAuth } from '../lib/AuthContext'

/* ══════════════════════════════════════════════════════════════
   STOCK & ISSUING

   The processing unit's live store, and the notes that move stock out of
   it to a branch.

   The monthly workbook still records what a month looked like, but it
   cannot say what is on the racks right now, and issuing needs exactly
   that. Everything on this page reads from the movement ledger instead:
   packed in, issued out, damaged, adjusted — one row per event.

   Dispatching and receiving are deliberately two steps. What sits between
   them is stock that has left the store and reached no shelf, shown here
   as In Transit. Collapsing the two would make a crate that never arrived
   look like branch stock nobody can find.
══════════════════════════════════════════════════════════════ */

const fmt = (n, dec = 0) => Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: dec })
const num = (v) => Number(v) || 0
const today = () => new Date().toISOString().slice(0, 10)

const STATUS_COLORS = {
  draft:      { bg: 'var(--ink-10)',              text: 'var(--ink-60)' },
  dispatched: { bg: 'rgba(232,160,32,0.15)',      text: 'var(--amber)' },
  received:   { bg: 'var(--green-100)',           text: 'var(--green-800)' },
  cancelled:  { bg: 'rgba(217,64,64,0.1)',        text: 'var(--red)' },
}

function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.draft
  return (
    <span className="inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider"
      style={{ background: c.bg, color: c.text }}>{status}</span>
  )
}

function TabBtn({ label, active, onClick, badge }) {
  return (
    <button onClick={onClick} className="px-4 py-2 text-sm font-medium border-0 bg-transparent cursor-pointer"
      style={{
        color: active ? 'var(--green-600)' : 'var(--ink-60)',
        borderBottom: active ? '2px solid var(--green-600)' : '2px solid transparent',
      }}>
      {label}
      {badge > 0 && (
        <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
          style={{ background: 'var(--amber)', color: '#fff' }}>{badge}</span>
      )}
    </button>
  )
}

const TH = ({ children, right }) => (
  <th className={`px-5 py-3 text-[11px] font-semibold tracking-wider uppercase border-b ${right ? 'text-right' : 'text-left'}`}
    style={{ color: 'var(--ink-60)', borderColor: 'var(--ink-10)' }}>{children}</th>
)
const TD = ({ children, mono, right }) => (
  <td className={`px-5 py-3 border-b text-[13px] ${right ? 'text-right' : ''}`}
    style={{
      borderColor: 'var(--ink-10)', color: mono ? 'var(--ink-60)' : 'var(--ink)',
      fontFamily: mono ? "'DM Mono', monospace" : 'inherit', fontSize: mono ? 12 : 13,
    }}>{children}</td>
)

function Notice({ kind = 'error', children, onClose }) {
  const styles = {
    error:   { bg: 'rgba(217,64,64,0.08)',  border: 'var(--red)',       color: 'var(--red)' },
    success: { bg: 'var(--green-50)',       border: 'var(--green-100)', color: 'var(--green-800)' },
    warn:    { bg: 'rgba(232,160,32,0.1)',  border: 'var(--amber)',     color: 'var(--amber)' },
  }[kind]
  return (
    <div className="rounded-lg border mb-4 text-[13px] flex items-start justify-between gap-3"
      style={{ padding: '10px 16px', background: styles.bg, borderColor: styles.border, color: styles.color }}>
      <div className="flex-1">{children}</div>
      {onClose && (
        <button onClick={onClose} className="border-0 bg-transparent cursor-pointer leading-none"
          style={{ color: 'inherit', opacity: 0.6 }}>✕</button>
      )}
    </div>
  )
}

/* ── the store: what is on hand, and recording a day's packing ── */
function StoreTab({ stock, onChanged, uploads, onNotice }) {
  const [showProduction, setShowProduction] = useState(false)
  const [date,  setDate]  = useState(today())
  const [rows,  setRows]  = useState({})
  const [busy,  setBusy]  = useState(false)

  const setCell = (id, field, value) =>
    setRows(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }))

  const submit = async () => {
    const entries = Object.entries(rows)
      .map(([product_id, v]) => ({
        product_id: Number(product_id),
        packed_units:  num(v.packed),
        damaged_units: num(v.damaged),
      }))
      .filter(e => e.packed_units > 0 || e.damaged_units > 0)

    if (!entries.length) return onNotice({ kind: 'error', text: 'Enter at least one figure.' })

    setBusy(true)
    try {
      await apiFetch('/stock/production', { method: 'POST', body: JSON.stringify({ date, entries }) })
      setRows({}); setShowProduction(false)
      onNotice({ kind: 'success', text: `Production for ${date} recorded.` })
      onChanged()
    } catch (e) {
      onNotice({ kind: 'error', text: e.message })
    } finally { setBusy(false) }
  }

  /* Seeding is offered only while the ledger has never been opened. Once
     stock exists, a second opening balance would double the store. */
  const ledgerEmpty = stock.every(s => s.units === 0)
  const seed = async (uploadId) => {
    setBusy(true)
    try {
      const r = await apiFetch('/stock/opening', { method: 'POST', body: JSON.stringify({ upload_id: uploadId }) })
      onNotice({
        kind: r.unmatched?.length ? 'warn' : 'success',
        text: `Opening balances set from ${r.from} — ${fmt(r.units)} units across ${r.products} products.`
          + (r.unmatched?.length ? ` Not matched to the catalogue: ${r.unmatched.join(', ')}.` : ''),
      })
      onChanged()
    } catch (e) {
      onNotice({ kind: 'error', text: e.message })
    } finally { setBusy(false) }
  }

  return (
    <div>
      {ledgerEmpty && uploads.length > 0 && (
        <Card>
          <CardTitle>Start the ledger from a month you have already uploaded</CardTitle>
          <p className="text-sm mb-3" style={{ color: 'var(--ink-60)' }}>
            The store is empty because nothing has been packed through the app yet. Stock that was
            already on the racks can be carried in from an uploaded month's closing balance — a
            one-time step, so day one of issuing starts from a real figure rather than zero.
          </p>
          <div className="flex flex-wrap gap-2 items-center">
            {uploads.slice(0, 6).map(u => (
              <Btn key={u.id} size="sm" disabled={busy} onClick={() => seed(u.id)}>
                Carry in {u.label}
              </Btn>
            ))}
          </div>
        </Card>
      )}

      <div className="flex justify-end mb-3">
        <Btn size="sm" variant={showProduction ? 'default' : 'primary'}
          onClick={() => setShowProduction(v => !v)}>
          {showProduction ? 'Cancel' : "+ Record a day's packing"}
        </Btn>
      </div>

      {showProduction && (
        <Card>
          <CardTitle>Record packing</CardTitle>
          <p className="text-sm mb-4" style={{ color: 'var(--ink-60)' }}>
            Packs made, and packs written off before they left the store. Leave a line blank if
            nothing happened on it — a blank is not the same as a zero.
          </p>
          <div className="mb-4" style={{ maxWidth: 200 }}>
            <label className="block text-xs font-medium uppercase tracking-wider mb-1.5" style={{ color: 'var(--ink-60)' }}>Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full" />
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr><TH>Product</TH><TH>Size</TH><TH right>Packed</TH><TH right>Damaged</TH></tr>
              </thead>
              <tbody>
                {stock.map(s => (
                  <tr key={s.product_id}>
                    <TD>{s.product}</TD>
                    <TD mono>{s.size}</TD>
                    <td className="px-5 py-2 border-b text-right" style={{ borderColor: 'var(--ink-10)' }}>
                      <input type="number" min="0" step={s.sold_by === 'litre' ? 'any' : '1'}
                        style={{ width: 90, textAlign: 'right' }}
                        value={rows[s.product_id]?.packed ?? ''}
                        onChange={e => setCell(s.product_id, 'packed', e.target.value)} />
                    </td>
                    <td className="px-5 py-2 border-b text-right" style={{ borderColor: 'var(--ink-10)' }}>
                      <input type="number" min="0" step={s.sold_by === 'litre' ? 'any' : '1'}
                        style={{ width: 90, textAlign: 'right' }}
                        value={rows[s.product_id]?.damaged ?? ''}
                        onChange={e => setCell(s.product_id, 'damaged', e.target.value)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <Btn size="sm" onClick={() => { setRows({}); setShowProduction(false) }}>Cancel</Btn>
            <Btn size="sm" variant="primary" disabled={busy} onClick={submit}>
              {busy ? 'Saving…' : 'Save'}
            </Btn>
          </div>
        </Card>
      )}

      <Card noPad>
        <div className="px-5 pt-4 pb-1">
          <CardTitle>On hand in the processing store</CardTitle>
          <p className="text-xs mb-2" style={{ color: 'var(--ink-60)' }}>
            Opening + packed − issued − damaged ± adjustments, summed from the movement ledger.
          </p>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr><TH>Product</TH><TH>Size</TH><TH right>Units</TH><TH right>Litres</TH></tr>
            </thead>
            <tbody>
              {stock.length === 0 && <tr><td colSpan={4}><EmptyState>No products in the catalogue.</EmptyState></td></tr>}
              {stock.map(s => (
                <tr key={s.product_id}>
                  <TD>{s.product}</TD>
                  <TD mono>{s.size}</TD>
                  <td className="px-5 py-3 border-b text-right font-semibold" style={{ borderColor: 'var(--ink-10)' }}>
                    <span style={{ color: s.units < 0 ? 'var(--red)' : s.units === 0 ? 'var(--ink-30)' : 'var(--ink)' }}>
                      {fmt(s.units)}
                    </span>
                  </td>
                  <TD mono right>{fmt(s.litres, 1)}</TD>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

/* ── raising an issue note ── */
function IssueTab({ stock, branches, onIssued, onNotice }) {
  const [branchId, setBranchId] = useState('')
  const [date,     setDate]     = useState(today())
  const [notes,    setNotes]    = useState('')
  const [qty,      setQty]      = useState({})
  const [busy,     setBusy]     = useState(false)
  const [shortfalls, setShortfalls] = useState([])

  const activeBranches = branches.filter(b => b.active)
  const lines = Object.entries(qty)
    .map(([product_id, units]) => ({ product_id: Number(product_id), units: num(units) }))
    .filter(l => l.units > 0)

  const totalUnits = lines.reduce((a, l) => a + l.units, 0)

  const submit = async (dispatch) => {
    if (!branchId) return onNotice({ kind: 'error', text: 'Choose a branch.' })
    if (!lines.length) return onNotice({ kind: 'error', text: 'Add at least one product.' })

    setBusy(true); setShortfalls([])
    try {
      const issue = await apiFetch('/issues', {
        method: 'POST',
        body: JSON.stringify({ branch_id: Number(branchId), issue_date: date, notes, items: lines, dispatch }),
      })
      setQty({}); setNotes('')
      onNotice({
        kind: 'success',
        text: `${issue.issue_no} ${dispatch ? 'dispatched to' : 'saved as a draft for'} ${issue.branch_name}.`,
      })
      onIssued()
    } catch (e) {
      /* A shortfall is the one failure worth showing line by line: the
         operator has to know which product to cut, not just that the note
         was refused. */
      if (e.body?.shortfalls) setShortfalls(e.body.shortfalls)
      onNotice({ kind: 'error', text: e.message })
    } finally { setBusy(false) }
  }

  return (
    <div>
      {shortfalls.length > 0 && (
        <Notice kind="error" onClose={() => setShortfalls([])}>
          <div className="font-semibold mb-1">The store cannot cover this note</div>
          {shortfalls.map((s, i) => (
            <div key={i}>• {s.product} {s.size} — asked for {fmt(s.wanted)}, {fmt(s.on_hand)} on hand</div>
          ))}
        </Notice>
      )}

      <Card>
        <CardTitle>Issue stock to a branch</CardTitle>
        {activeBranches.length === 0 ? (
          <EmptyState>No open branches yet. Add one on the Branches tab first.</EmptyState>
        ) : (
          <>
            <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider mb-1.5" style={{ color: 'var(--ink-60)' }}>Branch</label>
                <select value={branchId} onChange={e => setBranchId(e.target.value)} className="w-full">
                  <option value="">Choose a branch…</option>
                  {activeBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider mb-1.5" style={{ color: 'var(--ink-60)' }}>Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full" />
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider mb-1.5" style={{ color: 'var(--ink-60)' }}>Note (optional)</label>
                <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. morning run" className="w-full" />
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr><TH>Product</TH><TH>Size</TH><TH right>On hand</TH><TH right>Issue</TH></tr>
                </thead>
                <tbody>
                  {stock.map(s => {
                    const asked = num(qty[s.product_id])
                    const over  = asked > s.units
                    return (
                      <tr key={s.product_id}>
                        <TD>{s.product}</TD>
                        <TD mono>{s.size}</TD>
                        <TD mono right>
                          <span style={{ color: s.units <= 0 ? 'var(--ink-30)' : 'var(--ink-60)' }}>{fmt(s.units)}</span>
                        </TD>
                        <td className="px-5 py-2 border-b text-right" style={{ borderColor: 'var(--ink-10)' }}>
                          <input type="number" min="0" max={Math.max(s.units, 0)}
                            step={s.sold_by === 'litre' ? 'any' : '1'}
                            style={{
                              width: 100, textAlign: 'right',
                              borderColor: over ? 'var(--red)' : undefined,
                              color: over ? 'var(--red)' : undefined,
                            }}
                            value={qty[s.product_id] ?? ''}
                            onChange={e => setQty(prev => ({ ...prev, [s.product_id]: e.target.value }))} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
              <div className="text-sm" style={{ color: 'var(--ink-60)' }}>
                {lines.length
                  ? `${lines.length} line${lines.length > 1 ? 's' : ''}, ${fmt(totalUnits)} units`
                  : 'Nothing added yet'}
              </div>
              <div className="flex gap-2">
                <Btn size="sm" disabled={busy || !lines.length} onClick={() => submit(false)}>Save draft</Btn>
                <Btn size="sm" variant="primary" disabled={busy || !lines.length} onClick={() => submit(true)}>
                  {busy ? 'Working…' : 'Dispatch now'}
                </Btn>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}

/* ── the notes themselves ── */
function NotesTab({ issues, onChanged, onNotice }) {
  const [open, setOpen] = useState(null)
  const [detail, setDetail] = useState(null)
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState('')

  const expand = async (id) => {
    if (open === id) { setOpen(null); setDetail(null); return }
    setOpen(id); setDetail(null)
    try { setDetail(await apiFetch(`/issues/${id}`)) } catch (e) { onNotice({ kind: 'error', text: e.message }) }
  }

  const act = async (id, action, label) => {
    if (action === 'cancel' && !confirm('Cancel this note? Anything already dispatched goes back to the store.')) return
    setBusy(true)
    try {
      if (action === 'delete') await apiFetch(`/issues/${id}`, { method: 'DELETE' })
      else await apiFetch(`/issues/${id}/${action}`, { method: 'POST', body: JSON.stringify({}) })
      onNotice({ kind: 'success', text: label })
      setOpen(null); setDetail(null)
      onChanged()
    } catch (e) {
      onNotice({ kind: 'error', text: e.message })
    } finally { setBusy(false) }
  }

  const shown = filter ? issues.filter(i => i.status === filter) : issues

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <span className="text-xs uppercase tracking-wider font-medium" style={{ color: 'var(--ink-60)' }}>Show</span>
        {['', 'draft', 'dispatched', 'received', 'cancelled'].map(s => (
          <button key={s || 'all'} onClick={() => setFilter(s)}
            className="text-xs px-3 py-1 rounded-full border cursor-pointer"
            style={{
              background: filter === s ? 'var(--green-600)' : 'transparent',
              color: filter === s ? '#fff' : 'var(--ink-60)',
              borderColor: filter === s ? 'var(--green-600)' : 'var(--ink-10)',
            }}>
            {s || 'all'}
          </button>
        ))}
      </div>

      <Card noPad>
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <TH>Note</TH><TH>Branch</TH><TH>Date</TH><TH>Status</TH>
                <TH right>Lines</TH><TH right>Units</TH><TH></TH>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && (
                <tr><td colSpan={7}><EmptyState>
                  {filter ? `No ${filter} notes.` : 'No issue notes yet. Raise one on the Issue Stock tab.'}
                </EmptyState></td></tr>
              )}
              {shown.map(i => (
                <Fragment key={i.id}>
                  <tr>
                    <td className="px-5 py-3 border-b" style={{ borderColor: 'var(--ink-10)' }}>
                      <button onClick={() => expand(i.id)}
                        className="border-0 bg-transparent cursor-pointer font-semibold text-[13px]"
                        style={{ color: 'var(--green-600)', fontFamily: "'DM Mono', monospace" }}>
                        {open === i.id ? '▾ ' : '▸ '}{i.issue_no}
                      </button>
                    </td>
                    <TD>{i.branch_name}</TD>
                    <TD mono>{i.issue_date}</TD>
                    <td className="px-5 py-3 border-b" style={{ borderColor: 'var(--ink-10)' }}>
                      <StatusBadge status={i.status} />
                    </td>
                    <TD mono right>{i.lines}</TD>
                    <TD mono right>{fmt(i.units)}</TD>
                    <td className="px-5 py-3 border-b text-right" style={{ borderColor: 'var(--ink-10)' }}>
                      <div className="flex gap-2 justify-end">
                        {i.status === 'draft' && (
                          <>
                            <Btn size="sm" variant="primary" disabled={busy}
                              onClick={() => act(i.id, 'dispatch', `${i.issue_no} dispatched.`)}>Dispatch</Btn>
                            <Btn size="sm" variant="danger" disabled={busy}
                              onClick={() => act(i.id, 'delete', `${i.issue_no} deleted.`)}>Delete</Btn>
                          </>
                        )}
                        {i.status === 'dispatched' && (
                          <Btn size="sm" variant="danger" disabled={busy}
                            onClick={() => act(i.id, 'cancel', `${i.issue_no} cancelled.`)}>Cancel</Btn>
                        )}
                      </div>
                    </td>
                  </tr>
                  {open === i.id && (
                    <tr>
                      <td colSpan={7} className="border-b" style={{ borderColor: 'var(--ink-10)', background: 'var(--cream-dark)', padding: '12px 20px' }}>
                        {!detail ? (
                          <div className="text-xs" style={{ color: 'var(--ink-30)' }}>Loading…</div>
                        ) : (
                          <div>
                            <div className="text-xs mb-2" style={{ color: 'var(--ink-60)' }}>
                              Issued by {detail.issued_by || '—'}
                              {detail.received_by && ` · received by ${detail.received_by}`}
                              {detail.notes && ` · ${detail.notes}`}
                            </div>
                            <table className="w-full border-collapse text-[12px]">
                              <thead>
                                <tr>
                                  <th className="text-left py-1 font-semibold" style={{ color: 'var(--ink-60)' }}>Product</th>
                                  <th className="text-right py-1 font-semibold" style={{ color: 'var(--ink-60)' }}>Sent</th>
                                  <th className="text-right py-1 font-semibold" style={{ color: 'var(--ink-60)' }}>Received</th>
                                </tr>
                              </thead>
                              <tbody>
                                {detail.items.map(it => {
                                  const sent = num(it.units)
                                  const got  = it.received_units == null ? null : num(it.received_units)
                                  return (
                                    <tr key={it.id}>
                                      <td className="py-1" style={{ color: 'var(--ink)' }}>{it.product} {it.size}</td>
                                      <td className="py-1 text-right" style={{ fontFamily: "'DM Mono', monospace" }}>{fmt(sent)}</td>
                                      <td className="py-1 text-right" style={{
                                        fontFamily: "'DM Mono', monospace",
                                        color: got == null ? 'var(--ink-30)' : got < sent ? 'var(--red)' : 'var(--green-600)',
                                      }}>
                                        {got == null ? 'not yet counted' : fmt(got)}
                                        {got != null && got < sent && ` (${fmt(got - sent)})`}
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

/* ── branches and their selling prices ── */
function BranchesTab({ branches, products, onChanged, onNotice }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', code: '', location: '', phone: '' })
  const [prices, setPrices] = useState({})
  const [busy, setBusy] = useState(false)
  const [showBulk, setShowBulk] = useState(false)
  const [bulkForm, setBulkForm] = useState({ product: '', size: 'LTR', retail_price: '', wholesale_price: '' })

  const addBulk = async () => {
    setBusy(true)
    try {
      await apiFetch('/products', {
        method: 'POST',
        body: JSON.stringify({
          product: bulkForm.product, size: bulkForm.size || 'LTR', sold_by: 'litre',
          retail_price: num(bulkForm.retail_price), wholesale_price: num(bulkForm.wholesale_price),
        }),
      })
      setBulkForm({ product: '', size: 'LTR', retail_price: '', wholesale_price: '' })
      setShowBulk(false)
      onNotice({ kind: 'success', text: 'Loose-milk line added.' })
      onChanged()
    } catch (err) { onNotice({ kind: 'error', text: err.message }) } finally { setBusy(false) }
  }

  const create = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await apiFetch('/branches', { method: 'POST', body: JSON.stringify(form) })
      setForm({ name: '', code: '', location: '', phone: '' }); setShowForm(false)
      onNotice({ kind: 'success', text: 'Branch added.' })
      onChanged()
    } catch (err) { onNotice({ kind: 'error', text: err.message }) } finally { setBusy(false) }
  }

  const toggle = async (b) => {
    const closing = b.active
    if (closing && !confirm(`Close ${b.name}? Its history stays; no new stock can be issued to it.`)) return
    try {
      await apiFetch(`/branches/${b.id}`, { method: 'PATCH', body: JSON.stringify({ active: !b.active }) })
      onChanged()
    } catch (err) { onNotice({ kind: 'error', text: err.message }) }
  }

  /* Both lists are edited on one row and saved together: they are two
     prices for the same pack, and setting one without looking at the other
     is how a wholesale price ends up above its retail price. */
  const savePrice = async (p) => {
    const edit = prices[p.id]
    if (!edit) return
    try {
      await apiFetch(`/products/${p.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          retail_price:    num(edit.retail    ?? p.retail_price),
          wholesale_price: num(edit.wholesale ?? p.wholesale_price),
        }),
      })
      setPrices(prev => { const next = { ...prev }; delete next[p.id]; return next })
      onNotice({ kind: 'success', text: `${p.product} ${p.size} prices updated.` })
      onChanged()
    } catch (err) { onNotice({ kind: 'error', text: err.message }) }
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <Btn size="sm" variant={showForm ? 'default' : 'primary'} onClick={() => setShowForm(v => !v)}>
          {showForm ? 'Cancel' : '+ New branch'}
        </Btn>
      </div>

      {showForm && (
        <Card>
          <CardTitle>New branch</CardTitle>
          <form onSubmit={create}>
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
              {[
                ['name', 'Name', true, 'e.g. Mwabulugu Shop'],
                ['code', 'Code', false, 'e.g. MWA'],
                ['location', 'Location', false, 'e.g. Bukoba'],
                ['phone', 'Phone', false, ''],
              ].map(([key, label, required, ph]) => (
                <div key={key}>
                  <label className="block text-xs font-medium uppercase tracking-wider mb-1.5" style={{ color: 'var(--ink-60)' }}>
                    {label}
                  </label>
                  <input type="text" required={required} placeholder={ph} value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} className="w-full" />
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <Btn size="sm" onClick={() => setShowForm(false)}>Cancel</Btn>
              <Btn size="sm" variant="primary" disabled={busy} onClick={create}>Add branch</Btn>
            </div>
          </form>
        </Card>
      )}

      <Card noPad>
        <div className="px-5 pt-4 pb-1"><CardTitle>Branches</CardTitle></div>
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <TH>Name</TH><TH>Code</TH><TH>Location</TH>
                <TH right>Stock (units)</TH><TH right>Attendants</TH><TH></TH>
              </tr>
            </thead>
            <tbody>
              {branches.length === 0 && (
                <tr><td colSpan={6}><EmptyState>No branches yet. Add the first one above.</EmptyState></td></tr>
              )}
              {branches.map(b => (
                <tr key={b.id} style={{ opacity: b.active ? 1 : 0.5 }}>
                  <TD>
                    {b.name}
                    {!b.active && <span className="ml-2 text-[11px] uppercase tracking-wider" style={{ color: 'var(--ink-30)' }}>closed</span>}
                  </TD>
                  <TD mono>{b.code || '—'}</TD>
                  <TD>{b.location || '—'}</TD>
                  <TD mono right>{fmt(b.stock_units)}</TD>
                  <TD mono right>{b.attendants}</TD>
                  <td className="px-5 py-3 border-b text-right" style={{ borderColor: 'var(--ink-10)' }}>
                    <Btn size="sm" variant={b.active ? 'danger' : 'default'} onClick={() => toggle(b)}>
                      {b.active ? 'Close' : 'Reopen'}
                    </Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card noPad>
        <div className="px-5 pt-4 pb-1">
          <CardTitle>Selling prices</CardTitle>
          <p className="text-xs mb-2" style={{ color: 'var(--ink-60)' }}>
            Retail is what a shop charges over the counter; wholesale is what an agent pays for a
            crate. Leave wholesale at zero and the till simply charges the retail price — an unset
            price is never treated as free.
          </p>
          <div className="flex justify-end mb-2">
            <Btn size="sm" onClick={() => setShowBulk(v => !v)}>
              {showBulk ? 'Cancel' : '+ Loose milk line'}
            </Btn>
          </div>
          {showBulk && (
            <div className="rounded-lg p-4 mb-3" style={{ background: 'var(--cream-dark)' }}>
              <p className="text-xs mb-3" style={{ color: 'var(--ink-60)' }}>
                Milk sold by the litre from the churn. Sealed products come from the processing
                catalogue instead, so the workbook template and the parser stay aware of them.
              </p>
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
                {[
                  ['product', 'Name', 'e.g. Fresh Milk', 'text'],
                  ['size', 'Label', 'LTR', 'text'],
                  ['retail_price', 'Retail / litre', '0', 'number'],
                  ['wholesale_price', 'Wholesale / litre', '0', 'number'],
                ].map(([key, label, ph, type]) => (
                  <div key={key}>
                    <label className="block text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--ink-60)' }}>{label}</label>
                    <input type={type} step={type === 'number' ? 'any' : undefined} min={type === 'number' ? '0' : undefined}
                      className="w-full" placeholder={ph} value={bulkForm[key]}
                      onChange={e => setBulkForm(f => ({ ...f, [key]: e.target.value }))} />
                  </div>
                ))}
              </div>
              <div className="flex justify-end mt-3">
                <Btn size="sm" variant="primary" disabled={busy || !bulkForm.product.trim()} onClick={addBulk}>
                  Add line
                </Btn>
              </div>
            </div>
          )}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <TH>Product</TH><TH>Size</TH><TH>Sold by</TH>
                <TH right>Retail (TSh)</TH><TH right>Wholesale (TSh)</TH><TH></TH>
              </tr>
            </thead>
            <tbody>
              {products.map(p => {
                const edit = prices[p.id]
                const retail    = edit?.retail    ?? p.retail_price
                const wholesale = edit?.wholesale ?? p.wholesale_price
                const edited = !!edit
                  && (num(retail) !== num(p.retail_price) || num(wholesale) !== num(p.wholesale_price))
                /* Wholesale above retail is almost certainly the two typed
                   into the wrong boxes, so it is flagged before it is saved
                   rather than discovered in a month's takings. */
                const inverted = num(wholesale) > 0 && num(wholesale) > num(retail)
                const setField = (field, value) =>
                  setPrices(prev => ({
                    ...prev,
                    [p.id]: { retail, wholesale, ...(prev[p.id] || {}), [field]: value },
                  }))
                return (
                  <tr key={p.id}>
                    <TD>{p.product}</TD>
                    <TD mono>{p.size}</TD>
                    <TD style={{ color: p.sold_by === 'litre' ? 'var(--blue)' : 'var(--ink-60)', fontSize: 12 }}>
                      {p.sold_by === 'litre' ? 'the litre' : 'the pack'}
                    </TD>
                    <td className="px-5 py-2 border-b text-right" style={{ borderColor: 'var(--ink-10)' }}>
                      <input type="number" min="0" step="any" style={{ width: 110, textAlign: 'right' }}
                        value={retail}
                        onChange={e => setField('retail', e.target.value)} />
                    </td>
                    <td className="px-5 py-2 border-b text-right" style={{ borderColor: 'var(--ink-10)' }}>
                      <input type="number" min="0" step="any"
                        style={{ width: 110, textAlign: 'right', borderColor: inverted ? 'var(--amber)' : undefined }}
                        value={wholesale}
                        onChange={e => setField('wholesale', e.target.value)} />
                      {inverted && (
                        <div className="text-[10px] mt-0.5" style={{ color: 'var(--amber)' }}>above retail</div>
                      )}
                    </td>
                    <td className="px-5 py-2 border-b text-right" style={{ borderColor: 'var(--ink-10)' }}>
                      {edited && <Btn size="sm" variant="primary" onClick={() => savePrice(p)}>Save</Btn>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

export default function StockIssuing() {
  const { user } = useAuth()
  const [tab,      setTab]      = useState('store')
  const [overview, setOverview] = useState({ processing: [], branches: [], in_transit: [] })
  const [branches, setBranches] = useState([])
  const [products, setProducts] = useState([])
  const [issues,   setIssues]   = useState([])
  const [uploads,  setUploads]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [notice,   setNotice]   = useState(null)

  const load = useCallback(async () => {
    try {
      const [ov, br, pr, iss] = await Promise.all([
        apiFetch('/stock/overview'),
        apiFetch('/branches'),
        apiFetch('/products'),
        apiFetch('/issues'),
      ])
      setOverview(ov); setBranches(br); setProducts(pr); setIssues(iss)
    } catch (e) {
      setNotice({ kind: 'error', text: e.message })
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  /* Only needed to offer the one-time opening balance, so a failure here is
     not worth a message — the offer simply does not appear. */
  useEffect(() => { apiFetch('/processing').then(setUploads).catch(() => {}) }, [])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 6000)
    return () => clearTimeout(t)
  }, [notice])

  const storeUnits   = overview.processing.reduce((a, s) => a + num(s.units), 0)
  const branchUnits  = overview.branches.reduce((a, b) => a + num(b.units), 0)
  const transitUnits = overview.in_transit.reduce((a, t) => a + num(t.units), 0)
  const awaiting     = issues.filter(i => i.status === 'dispatched').length

  if (loading) return <div className="p-8 text-center text-sm" style={{ color: 'var(--ink-30)' }}>Loading…</div>

  return (
    <div style={{ animation: 'fadeUp .2s ease' }}>
      <PageHeader
        title="Stock & Issuing"
        sub="What the processing store holds, and where it goes"
      />

      {notice && (
        <Notice kind={notice.kind} onClose={() => setNotice(null)}>{notice.text}</Notice>
      )}

      <div className="grid gap-3.5 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        {[
          { label: 'In the store',   value: fmt(storeUnits),   color: 'var(--green-600)' },
          { label: 'In transit',     value: fmt(transitUnits), color: 'var(--amber)' },
          { label: 'At branches',    value: fmt(branchUnits),  color: 'var(--blue)' },
          { label: 'Awaiting receipt', value: fmt(awaiting),   color: awaiting ? 'var(--amber)' : 'var(--ink-30)' },
        ].map(k => (
          <div key={k.label} className="rounded-lg border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--ink-10)' }}>
            <div className="text-[11px] uppercase tracking-wider font-medium mb-1" style={{ color: 'var(--ink-60)' }}>{k.label}</div>
            <div className="font-semibold" style={{ fontSize: 22, color: k.color, lineHeight: 1.2 }}>
              {k.value}
              <span className="text-xs font-normal ml-1" style={{ color: 'var(--ink-60)' }}>units</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex mb-5 flex-wrap" style={{ borderBottom: '1px solid var(--ink-10)' }}>
        <TabBtn label="Store"       active={tab === 'store'}    onClick={() => setTab('store')} />
        <TabBtn label="Issue Stock" active={tab === 'issue'}    onClick={() => setTab('issue')} />
        <TabBtn label="Issue Notes" active={tab === 'notes'}    onClick={() => setTab('notes')} badge={awaiting} />
        <TabBtn label="Branches"    active={tab === 'branches'} onClick={() => setTab('branches')} />
      </div>

      {tab === 'store' && (
        <StoreTab stock={overview.processing} uploads={uploads} onChanged={load} onNotice={setNotice} />
      )}
      {tab === 'issue' && (
        <IssueTab stock={overview.processing} branches={branches} onIssued={load} onNotice={setNotice} />
      )}
      {tab === 'notes' && (
        <NotesTab issues={issues} onChanged={load} onNotice={setNotice} />
      )}
      {tab === 'branches' && (
        <BranchesTab branches={branches} products={products} onChanged={load} onNotice={setNotice} />
      )}
    </div>
  )
}
