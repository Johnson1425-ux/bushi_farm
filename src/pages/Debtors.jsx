import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../lib/api'
import { Card, CardTitle, Btn, PageHeader, EmptyState } from '../components/ui'
import { useAuth } from '../lib/AuthContext'

/* ══════════════════════════════════════════════════════════════
   DEBTORS

   The day book's debtor table. Every credit sale lands here on its own,
   and every payment taken at a till reduces the balance and shows up in
   that day's cash — the figure is only ever held in one place.

   Accounts in credit are shown alongside those in debt rather than
   netted off. A customer who has overpaid is owed milk, and folding them
   into "total owed" would make both numbers wrong.
══════════════════════════════════════════════════════════════ */

const fmt    = (n, dec = 0) => Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: dec })
const fmtTsh = (n) => `TSh ${fmt(n)}`
const num    = (v) => Number(v) || 0
const today  = () => new Date().toISOString().slice(0, 10)

const TH = ({ children, right }) => (
  <th className={`px-5 py-3 text-[11px] font-semibold tracking-wider uppercase border-b ${right ? 'text-right' : 'text-left'}`}
    style={{ color: 'var(--ink-60)', borderColor: 'var(--ink-10)', whiteSpace: 'nowrap' }}>{children}</th>
)
const TD = ({ children, right, mono, style = {} }) => (
  <td className={`px-5 py-3 border-b text-[13px] ${right ? 'text-right' : ''}`}
    style={{
      borderColor: 'var(--ink-10)', color: 'var(--ink)',
      fontFamily: mono ? "'DM Mono', monospace" : 'inherit', fontSize: mono ? 12 : 13, ...style,
    }}>{children}</td>
)

/* A balance is read constantly and its sign is the whole message, so it
   is coloured rather than left to a minus sign the eye skips. */
function Balance({ value, bold }) {
  const v = num(value)
  const color = v > 0.005 ? 'var(--red)' : v < -0.005 ? 'var(--green-600)' : 'var(--ink-30)'
  return (
    <span style={{ color, fontWeight: bold ? 600 : 500, fontFamily: "'DM Mono', monospace" }}>
      {v < -0.005 ? `${fmt(Math.abs(v))} cr` : fmt(v)}
    </span>
  )
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(10,30,20,0.45)' }}>
      <div className={`rounded-[16px] w-full ${wide ? 'max-w-3xl' : 'max-w-md'} p-7 max-h-[90vh] overflow-y-auto`}
        style={{ background: 'var(--surface)' }}>
        <div className="flex items-center justify-between mb-5">
          <div className="font-serif text-[18px]" style={{ color: 'var(--ink)' }}>{title}</div>
          <button onClick={onClose} className="border-0 bg-transparent text-[18px] cursor-pointer p-1 leading-none"
            style={{ color: 'var(--ink-30)' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

/* ── one account's statement, the way the paper book reads ── */
function Statement({ id, onClose, onChanged, canManage, branches, isAttendant, onNotice }) {
  const [data, setData] = useState(null)
  const [mode, setMode] = useState(null)      // 'payment' | 'charge' | 'adjustment'
  const [form, setForm] = useState({ amount: '', description: '', date: today(), branch_id: '' })
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try { setData(await apiFetch(`/debtors/${id}`)) }
    catch (e) { onNotice(e.message) }
  }, [id, onNotice])

  useEffect(() => { load() }, [load])

  const submit = async () => {
    const path = mode === 'payment' ? 'payments' : mode === 'charge' ? 'charges' : 'adjustments'
    setBusy(true)
    try {
      await apiFetch(`/debtors/${id}/${path}`, {
        method: 'POST',
        body: JSON.stringify({
          amount: num(form.amount),
          description: form.description,
          date: form.date,
          ...(form.branch_id ? { branch_id: Number(form.branch_id) } : {}),
        }),
      })
      setMode(null); setForm({ amount: '', description: '', date: today(), branch_id: '' })
      await load(); onChanged()
    } catch (e) { onNotice(e.message) } finally { setBusy(false) }
  }

  if (!data) return <Modal title="Loading…" onClose={onClose}><div /></Modal>

  const KIND_LABEL = { charge: 'Charge', payment: 'Payment', adjustment: 'Adjustment' }

  return (
    <Modal title={data.name} onClose={onClose} wide>
      <div className="flex flex-wrap gap-4 items-center justify-between mb-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--ink-60)' }}>Balance</div>
          <div style={{ fontSize: 26 }}><Balance value={data.balance} bold /></div>
          {num(data.balance) < -0.005 && (
            <div className="text-[11px]" style={{ color: 'var(--green-600)' }}>
              In credit — milk paid for and not yet collected.
            </div>
          )}
        </div>
        <div className="text-xs text-right" style={{ color: 'var(--ink-60)' }}>
          {data.phone && <div>{data.phone}</div>}
          {data.branch_name && <div>{data.branch_name}</div>}
          <div>Opening balance {fmtTsh(data.opening_balance)}</div>
        </div>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <Btn size="sm" variant="primary" onClick={() => setMode('payment')}>Record payment</Btn>
        {canManage && <Btn size="sm" onClick={() => setMode('charge')}>Add charge</Btn>}
        {canManage && <Btn size="sm" onClick={() => setMode('adjustment')}>Adjust</Btn>}
      </div>

      {mode && (
        <Card>
          <CardTitle>
            {mode === 'payment' ? 'Payment received'
              : mode === 'charge' ? 'Charge (goods handed over off the till)'
              : 'Adjustment — write-off or correction'}
          </CardTitle>
          {mode === 'adjustment' && (
            <p className="text-xs mb-3" style={{ color: 'var(--ink-60)' }}>
              Signed: a negative amount reduces what they owe. Nothing is ever edited away — the
              original entry stays and this explains it.
            </p>
          )}
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
            <div>
              <label className="block text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--ink-60)' }}>Amount</label>
              <input type="number" step="any" className="w-full" value={form.amount}
                min={mode === 'adjustment' ? undefined : '0'}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--ink-60)' }}>Date</label>
              <input type="date" className="w-full" value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            {mode === 'payment' && !isAttendant && (
              <div>
                <label className="block text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--ink-60)' }}>Taken at</label>
                <select className="w-full" value={form.branch_id}
                  onChange={e => setForm(f => ({ ...f, branch_id: e.target.value }))}>
                  <option value="">No branch (office)</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            )}
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="block text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--ink-60)' }}>
                {mode === 'payment' ? 'Note (optional)' : 'Reason'}
              </label>
              <input type="text" className="w-full" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          {mode === 'payment' && !isAttendant && !form.branch_id && (
            <div className="text-[11px] mt-2" style={{ color: 'var(--amber)' }}>
              A payment with no branch belongs to no till, so it will not appear in any day's
              cash-up. It still shows on this statement and in the reports.
            </div>
          )}
          <div className="flex gap-2 justify-end mt-4">
            <Btn size="sm" onClick={() => setMode(null)}>Cancel</Btn>
            <Btn size="sm" variant="primary" disabled={busy || !num(form.amount)} onClick={submit}>Save</Btn>
          </div>
        </Card>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr><TH>Date</TH><TH>What</TH><TH right>Charge</TH><TH right>Payment</TH><TH right>Balance</TH></tr>
          </thead>
          <tbody>
            <tr>
              <TD mono>—</TD>
              <TD style={{ color: 'var(--ink-60)' }}>Balance brought forward</TD>
              <TD /><TD />
              <TD right><Balance value={data.opening_balance} /></TD>
            </tr>
            {data.entries.map(e => (
              <tr key={e.id}>
                <TD mono>{e.entry_date}</TD>
                <TD>
                  {e.description || KIND_LABEL[e.kind]}
                  {e.receipt_no && (
                    <span className="ml-1.5 text-[11px]" style={{ color: 'var(--ink-30)', fontFamily: "'DM Mono', monospace" }}>
                      {e.receipt_no}
                    </span>
                  )}
                  {e.branch_name && (
                    <div className="text-[11px]" style={{ color: 'var(--ink-30)' }}>{e.branch_name}</div>
                  )}
                </TD>
                <TD right mono style={{ color: 'var(--ink-60)' }}>{e.amount > 0 ? fmt(e.amount) : ''}</TD>
                <TD right mono style={{ color: 'var(--green-600)' }}>{e.amount < 0 ? fmt(-e.amount) : ''}</TD>
                <TD right><Balance value={e.balance} /></TD>
              </tr>
            ))}
            {data.entries.length === 0 && (
              <tr><td colSpan={5}><EmptyState>Nothing on this account yet.</EmptyState></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Modal>
  )
}

export default function Debtors() {
  const { user } = useAuth()
  const isAttendant = user?.role === 'attendant'
  const canManage = !isAttendant

  const [data,     setData]     = useState(null)
  const [branches, setBranches] = useState([])
  const [open,     setOpen]     = useState(null)
  const [q,        setQ]        = useState('')
  const [showNew,  setShowNew]  = useState(false)
  const [form,     setForm]     = useState({ name: '', phone: '', opening_balance: '', branch_id: '' })
  const [error,    setError]    = useState(null)

  const load = useCallback(async () => {
    try { setData(await apiFetch(`/debtors${q ? `?q=${encodeURIComponent(q)}` : ''}`)) }
    catch (e) { setError(e.message) }
  }, [q])

  useEffect(() => { load() }, [load])
  useEffect(() => { apiFetch('/branches').then(setBranches).catch(() => {}) }, [])
  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(null), 6000)
    return () => clearTimeout(t)
  }, [error])

  const create = async () => {
    try {
      await apiFetch('/debtors', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          phone: form.phone || null,
          branch_id: form.branch_id ? Number(form.branch_id) : null,
          ...(canManage && num(form.opening_balance) ? { opening_balance: num(form.opening_balance) } : {}),
        }),
      })
      setForm({ name: '', phone: '', opening_balance: '', branch_id: '' })
      setShowNew(false); load()
    } catch (e) { setError(e.message) }
  }

  if (!data) return <div className="p-8 text-center text-sm" style={{ color: 'var(--ink-30)' }}>Loading…</div>

  return (
    <div style={{ animation: 'fadeUp .2s ease' }}>
      <PageHeader title="Debtors" sub="Who owes what, and who has paid ahead">
        <input type="search" placeholder="Search a name" value={q} onChange={e => setQ(e.target.value)} />
        <Btn size="sm" variant="primary" onClick={() => setShowNew(v => !v)}>
          {showNew ? 'Cancel' : '+ New account'}
        </Btn>
      </PageHeader>

      {error && (
        <div className="rounded-lg border mb-4 text-[13px]"
          style={{ padding: '10px 16px', background: 'rgba(217,64,64,0.08)', borderColor: 'var(--red)', color: 'var(--red)' }}>
          {error}
        </div>
      )}

      {showNew && (
        <Card>
          <CardTitle>New account</CardTitle>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            <div>
              <label className="block text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--ink-60)' }}>Name</label>
              <input type="text" className="w-full" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Isamilo" />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--ink-60)' }}>Phone</label>
              <input type="text" className="w-full" value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--ink-60)' }}>Usually served at</label>
              <select className="w-full" value={form.branch_id}
                onChange={e => setForm(f => ({ ...f, branch_id: e.target.value }))}>
                <option value="">—</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            {canManage && (
              <div>
                <label className="block text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--ink-60)' }}>
                  Already owing
                </label>
                <input type="number" step="any" className="w-full" value={form.opening_balance}
                  onChange={e => setForm(f => ({ ...f, opening_balance: e.target.value }))} placeholder="0" />
                <div className="text-[11px] mt-1" style={{ color: 'var(--ink-30)' }}>
                  What they owed before the app kept the book.
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <Btn size="sm" onClick={() => setShowNew(false)}>Cancel</Btn>
            <Btn size="sm" variant="primary" disabled={!form.name.trim()} onClick={create}>Open account</Btn>
          </div>
        </Card>
      )}

      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        {[
          { label: 'Owed to the farm', value: fmtTsh(data.totals.owed),      color: 'var(--red)' },
          { label: 'Paid in advance',  value: fmtTsh(Math.abs(data.totals.in_credit)), color: 'var(--green-600)' },
          { label: 'Net position',     value: fmtTsh(data.totals.net),       color: 'var(--ink)' },
          { label: 'Accounts',         value: fmt(data.totals.count),        color: 'var(--ink-60)' },
        ].map(k => (
          <div key={k.label} className="rounded-lg border" style={{ background: 'var(--surface)', borderColor: 'var(--ink-10)', padding: '16px 20px' }}>
            <div className="text-[11px] uppercase tracking-wider font-medium mb-1" style={{ color: 'var(--ink-60)' }}>{k.label}</div>
            <div className="text-[20px] font-semibold" style={{ color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      <Card noPad>
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr><TH>Account</TH><TH>Phone</TH><TH>Branch</TH><TH>Last activity</TH><TH right>Balance</TH></tr>
            </thead>
            <tbody>
              {data.debtors.length === 0 && (
                <tr><td colSpan={5}><EmptyState>
                  {q ? 'No account matches that name.' : 'No accounts yet. A credit sale at the till opens one.'}
                </EmptyState></td></tr>
              )}
              {data.debtors.map(d => (
                <tr key={d.id} style={{ opacity: d.active ? 1 : 0.5 }}>
                  <td className="px-5 py-3 border-b" style={{ borderColor: 'var(--ink-10)' }}>
                    <button onClick={() => setOpen(d.id)}
                      className="border-0 bg-transparent cursor-pointer font-semibold text-[13px] text-left"
                      style={{ color: 'var(--green-600)' }}>{d.name}</button>
                  </td>
                  <TD style={{ color: 'var(--ink-60)' }}>{d.phone || '—'}</TD>
                  <TD style={{ color: 'var(--ink-60)' }}>{d.branch_name || '—'}</TD>
                  <TD mono>{d.last_activity ? String(d.last_activity).slice(0, 10) : '—'}</TD>
                  <TD right><Balance value={d.balance} /></TD>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {open && (
        <Statement
          id={open}
          canManage={canManage}
          isAttendant={isAttendant}
          branches={branches}
          onClose={() => setOpen(null)}
          onChanged={load}
          onNotice={setError}
        />
      )}
    </div>
  )
}
