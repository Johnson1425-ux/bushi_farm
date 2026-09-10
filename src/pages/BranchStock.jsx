import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../lib/api'
import { Card, CardTitle, Btn, PageHeader, EmptyState } from '../components/ui'
import { useAuth } from '../lib/AuthContext'

/* ══════════════════════════════════════════════════════════════
   MY BRANCH

   The branch side of the counter. An attendant sees what their branch
   holds, and the notes on the way to it that still need counting in.

   Confirming receipt is the branch's own signature on the paperwork, and
   the count entered here is what the branch is credited with — not what
   the note says was sent. Where the two differ the difference stays on
   the note as a shortfall for someone to explain, rather than being
   quietly absorbed by either side.

   This is also where the till will live once the sales side goes in: the
   stock figures below are what it will sell against.
══════════════════════════════════════════════════════════════ */

const fmt = (n, dec = 0) => Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: dec })
const num = (v) => Number(v) || 0

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

/* Counting in one note.

   The form opens pre-filled with what was sent, because that is what
   normally arrives and re-typing it would invite errors of its own. Every
   line is still editable, and any line reduced is called out before the
   attendant signs for it. */
function ReceiveForm({ issue, onDone, onCancel, onNotice }) {
  const [counts, setCounts] = useState(
    () => Object.fromEntries(issue.items.map(i => [i.product_id, String(num(i.units))]))
  )
  const [busy, setBusy] = useState(false)

  const shortfalls = issue.items
    .map(i => ({ ...i, counted: num(counts[i.product_id]) }))
    .filter(i => i.counted < num(i.units))

  const over = issue.items.filter(i => num(counts[i.product_id]) > num(i.units))

  const submit = async () => {
    setBusy(true)
    try {
      const res = await apiFetch(`/issues/${issue.id}/receive`, {
        method: 'POST',
        body: JSON.stringify({
          received: issue.items.map(i => ({ product_id: i.product_id, units: num(counts[i.product_id]) })),
        }),
      })
      onNotice({
        kind: res.shortfalls?.length ? 'warn' : 'success',
        text: res.shortfalls?.length
          ? `${issue.issue_no} received short on ${res.shortfalls.length} line(s). The difference is recorded on the note.`
          : `${issue.issue_no} received in full.`,
      })
      onDone()
    } catch (e) {
      onNotice({ kind: 'error', text: e.message })
    } finally { setBusy(false) }
  }

  return (
    <Card>
      <CardTitle>Count in {issue.issue_no}</CardTitle>
      <p className="text-sm mb-4" style={{ color: 'var(--ink-60)' }}>
        Sent {issue.issue_date}{issue.issued_by ? ` by ${issue.issued_by}` : ''}
        {issue.notes ? ` · ${issue.notes}` : ''}. Change any line where what arrived
        differs from what the note says.
      </p>

      <div style={{ overflowX: 'auto' }}>
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr><TH>Product</TH><TH>Size</TH><TH right>Sent</TH><TH right>Counted</TH></tr>
          </thead>
          <tbody>
            {issue.items.map(i => {
              const counted = num(counts[i.product_id])
              const short   = counted < num(i.units)
              const tooMany = counted > num(i.units)
              return (
                <tr key={i.product_id}>
                  <TD>{i.product}</TD>
                  <TD mono>{i.size}</TD>
                  <TD mono right>{fmt(i.units)}</TD>
                  <td className="px-5 py-2 border-b text-right" style={{ borderColor: 'var(--ink-10)' }}>
                    <input type="number" min="0" max={num(i.units)} step="1"
                      style={{
                        width: 100, textAlign: 'right',
                        borderColor: tooMany ? 'var(--red)' : short ? 'var(--amber)' : undefined,
                        color: tooMany ? 'var(--red)' : short ? 'var(--amber)' : undefined,
                      }}
                      value={counts[i.product_id] ?? ''}
                      onChange={e => setCounts(prev => ({ ...prev, [i.product_id]: e.target.value }))} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {over.length > 0 && (
        <div className="text-xs mt-3" style={{ color: 'var(--red)' }}>
          A branch cannot receive more than was sent. Check {over.map(i => `${i.product} ${i.size}`).join(', ')}.
        </div>
      )}
      {over.length === 0 && shortfalls.length > 0 && (
        <div className="text-xs mt-3" style={{ color: 'var(--amber)' }}>
          Signing for less than was sent on {shortfalls.length} line(s). The difference stays on the
          note as a shortfall — it is not returned to the processing store.
        </div>
      )}

      <div className="flex gap-2 justify-end mt-4">
        <Btn size="sm" onClick={onCancel}>Cancel</Btn>
        <Btn size="sm" variant="primary" disabled={busy || over.length > 0} onClick={submit}>
          {busy ? 'Saving…' : 'Confirm receipt'}
        </Btn>
      </div>
    </Card>
  )
}

export default function BranchStock() {
  const { user } = useAuth()
  const [branch,   setBranch]   = useState(null)
  const [stock,    setStock]    = useState([])
  const [issues,   setIssues]   = useState([])
  const [receiving, setReceiving] = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [notice,   setNotice]   = useState(null)
  const [error,    setError]    = useState(null)

  /* A manager arriving here without choosing a branch gets the first one;
     an attendant's branch comes from their account and cannot be changed
     from the browser. */
  const [branchId, setBranchId] = useState(user?.branch_id ?? null)
  const [allBranches, setAllBranches] = useState([])

  const load = useCallback(async () => {
    try {
      const branches = await apiFetch('/branches')
      setAllBranches(branches)

      const id = branchId ?? branches[0]?.id ?? null
      if (!id) { setError('No branch is assigned to this account yet. Ask an admin to set one.'); return }
      if (id !== branchId) setBranchId(id)

      const [st, iss] = await Promise.all([
        apiFetch(`/stock/on-hand?location=branch&branch_id=${id}`),
        apiFetch(`/issues?branch_id=${id}`),
      ])
      setBranch(branches.find(b => b.id === id) || null)
      setStock(st)
      setIssues(iss)
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally { setLoading(false) }
  }, [branchId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 6000)
    return () => clearTimeout(t)
  }, [notice])

  const openReceive = async (id) => {
    try { setReceiving(await apiFetch(`/issues/${id}`)) }
    catch (e) { setNotice({ kind: 'error', text: e.message }) }
  }

  const awaiting = issues.filter(i => i.status === 'dispatched')
  const totalUnits  = stock.reduce((a, s) => a + num(s.units), 0)
  const totalLitres = stock.reduce((a, s) => a + num(s.litres), 0)
  const lines       = stock.filter(s => num(s.units) > 0).length

  if (loading) return <div className="p-8 text-center text-sm" style={{ color: 'var(--ink-30)' }}>Loading…</div>

  if (error) {
    return (
      <div style={{ animation: 'fadeUp .2s ease' }}>
        <PageHeader title="My Branch" sub="Branch stock and incoming deliveries" />
        <Card><EmptyState>{error}</EmptyState></Card>
      </div>
    )
  }

  const noticeStyle = {
    error:   { bg: 'rgba(217,64,64,0.08)', border: 'var(--red)',       color: 'var(--red)' },
    success: { bg: 'var(--green-50)',      border: 'var(--green-100)', color: 'var(--green-800)' },
    warn:    { bg: 'rgba(232,160,32,0.1)', border: 'var(--amber)',     color: 'var(--amber)' },
  }[notice?.kind || 'success']

  return (
    <div style={{ animation: 'fadeUp .2s ease' }}>
      <PageHeader title={branch?.name || 'My Branch'} sub="Branch stock and incoming deliveries">
        {/* Managers oversee every branch, so they get a picker. An
            attendant has exactly one and is not offered a choice. */}
        {user?.role !== 'attendant' && allBranches.length > 1 && (
          <select value={branchId ?? ''} onChange={e => { setLoading(true); setBranchId(Number(e.target.value)) }}>
            {allBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
      </PageHeader>

      {notice && (
        <div className="rounded-lg border mb-4 text-[13px]"
          style={{ padding: '10px 16px', background: noticeStyle.bg, borderColor: noticeStyle.border, color: noticeStyle.color }}>
          {notice.text}
        </div>
      )}

      <div className="grid gap-3.5 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        {[
          { label: 'Units on hand',  value: fmt(totalUnits),      color: 'var(--green-600)' },
          { label: 'Litres on hand', value: fmt(totalLitres, 1),  color: 'var(--blue)' },
          { label: 'Product lines',  value: fmt(lines),           color: 'var(--ink)' },
          { label: 'To count in',    value: fmt(awaiting.length), color: awaiting.length ? 'var(--amber)' : 'var(--ink-30)' },
        ].map(k => (
          <div key={k.label} className="rounded-lg border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--ink-10)' }}>
            <div className="text-[11px] uppercase tracking-wider font-medium mb-1" style={{ color: 'var(--ink-60)' }}>{k.label}</div>
            <div className="font-semibold" style={{ fontSize: 22, color: k.color, lineHeight: 1.2 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {receiving && (
        <ReceiveForm
          issue={receiving}
          onCancel={() => setReceiving(null)}
          onNotice={setNotice}
          onDone={() => { setReceiving(null); load() }}
        />
      )}

      {!receiving && awaiting.length > 0 && (
        <Card noPad>
          <div className="px-5 pt-4 pb-1">
            <CardTitle>On the way — waiting to be counted in</CardTitle>
            <p className="text-xs mb-2" style={{ color: 'var(--ink-60)' }}>
              This stock has left the processing store. It joins the figures above only once
              the branch has counted it.
            </p>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr><TH>Note</TH><TH>Sent</TH><TH right>Lines</TH><TH right>Units</TH><TH></TH></tr>
              </thead>
              <tbody>
                {awaiting.map(i => (
                  <tr key={i.id}>
                    <TD mono>{i.issue_no}</TD>
                    <TD mono>{i.issue_date}</TD>
                    <TD mono right>{i.lines}</TD>
                    <TD mono right>{fmt(i.units)}</TD>
                    <td className="px-5 py-3 border-b text-right" style={{ borderColor: 'var(--ink-10)' }}>
                      <Btn size="sm" variant="primary" onClick={() => openReceive(i.id)}>Count in</Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card noPad>
        <div className="px-5 pt-4 pb-1"><CardTitle>Stock on hand</CardTitle></div>
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr><TH>Product</TH><TH>Size</TH><TH right>Units</TH><TH right>Litres</TH><TH right>Price</TH></tr>
            </thead>
            <tbody>
              {stock.length === 0 && (
                <tr><td colSpan={5}><EmptyState>Nothing received yet.</EmptyState></td></tr>
              )}
              {stock.map(s => (
                <tr key={s.product_id}>
                  <TD>{s.product}</TD>
                  <TD mono>{s.size}</TD>
                  <td className="px-5 py-3 border-b text-right font-semibold" style={{ borderColor: 'var(--ink-10)' }}>
                    <span style={{ color: num(s.units) < 0 ? 'var(--red)' : num(s.units) === 0 ? 'var(--ink-30)' : 'var(--ink)' }}>
                      {fmt(s.units)}
                    </span>
                  </td>
                  <TD mono right>{fmt(s.litres, 1)}</TD>
                  <TD mono right>{num(s.unit_price) ? `TSh ${fmt(s.unit_price)}` : '—'}</TD>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card noPad>
        <div className="px-5 pt-4 pb-1"><CardTitle>Delivery history</CardTitle></div>
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr><TH>Note</TH><TH>Date</TH><TH>Status</TH><TH right>Units</TH><TH>Received by</TH></tr>
            </thead>
            <tbody>
              {issues.length === 0 && (
                <tr><td colSpan={5}><EmptyState>No deliveries yet.</EmptyState></td></tr>
              )}
              {issues.map(i => (
                <tr key={i.id}>
                  <TD mono>{i.issue_no}</TD>
                  <TD mono>{i.issue_date}</TD>
                  <TD>{i.status}</TD>
                  <TD mono right>{fmt(i.units)}</TD>
                  <TD>{i.received_by || '—'}</TD>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
