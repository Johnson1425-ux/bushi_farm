import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../lib/api'
import { Card, CardTitle, Btn, PageHeader, EmptyState } from '../components/ui'
import { useAuth } from '../lib/AuthContext'
import { notify } from '../lib/notify'

/* ══════════════════════════════════════════════════════════════
   CUSTOMERS & DEBTORS

   One list, two ways of reading it. A debtor is not a different kind of
   person — it is a customer whose balance happens to be above zero
   today, and who stops being one the moment they settle up. So the
   Debtors tab is this same book filtered, not a second register that
   someone has to be moved between.

   What the Customers tab adds is the half a debtors book never had:
   what each customer is worth. Trade across every shop, cash and credit
   alike, so an account is worth opening for someone who always pays.
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
      {v < -0.005 ? `${fmt(Math.abs(v))} cr` : v > 0.005 ? fmt(v) : '—'}
    </span>
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

/* ── one account: the ledger, and what they have bought ── */
function Account({ id, onClose, onChanged, canManage, branches, isAttendant }) {
  const [data, setData] = useState(null)
  const [view, setView] = useState('ledger')
  const [mode, setMode] = useState(null)      // 'payment' | 'charge' | 'adjustment'
  const [form, setForm] = useState({ amount: '', description: '', date: today(), branch_id: '' })
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try { setData(await apiFetch(`/customers/${id}`)) }
    catch (e) { notify.error(e.message) }
  }, [id])

  useEffect(() => { load() }, [load])

  const submit = async () => {
    const path = mode === 'payment' ? 'payments' : mode === 'charge' ? 'charges' : 'adjustments'
    setBusy(true)
    try {
      await apiFetch(`/customers/${id}/${path}`, {
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
    } catch (e) { notify.error(e.message) } finally { setBusy(false) }
  }

  if (!data) return <Modal title="Loading…" onClose={onClose}><div /></Modal>

  const KIND_LABEL = { charge: 'Charge', payment: 'Payment', adjustment: 'Adjustment' }

  return (
    <Modal title={data.name} onClose={onClose} wide>
      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
        {[
          { label: 'Balance', node: <Balance value={data.balance} bold /> },
          { label: 'Spent with us', node: <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{fmtTsh(data.total_spent)}</span> },
          { label: 'Purchases', node: <span style={{ color: 'var(--ink-60)' }}>{fmt(data.purchases)}</span> },
          { label: 'Last seen', node: <span style={{ color: 'var(--ink-60)', fontSize: 15 }}>
              {data.last_purchase ? String(data.last_purchase).slice(0, 10) : '—'}</span> },
        ].map(k => (
          <div key={k.label} className="rounded-lg" style={{ background: 'var(--cream-dark)', padding: '10px 14px' }}>
            <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--ink-60)' }}>{k.label}</div>
            <div style={{ fontSize: 18 }}>{k.node}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-center justify-between mb-4">
        <div className="text-xs" style={{ color: 'var(--ink-60)' }}>
          {data.phone && <span>{data.phone} · </span>}
          {data.branch_name && <span>{data.branch_name} · </span>}
          <span>opened with {fmtTsh(data.opening_balance)}</span>
          {num(data.balance) < -0.005 && (
            <span style={{ color: 'var(--green-600)' }}> · in credit, milk paid for and not collected</span>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Btn size="sm" variant="primary" onClick={() => setMode('payment')}>Record payment</Btn>
          {canManage && <Btn size="sm" onClick={() => setMode('charge')}>Add charge</Btn>}
          {canManage && <Btn size="sm" onClick={() => setMode('adjustment')}>Adjust</Btn>}
        </div>
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

      <div className="flex mb-3" style={{ borderBottom: '1px solid var(--ink-10)' }}>
        <TabBtn label="Account ledger" active={view === 'ledger'}    onClick={() => setView('ledger')} />
        <TabBtn label="Purchases"      active={view === 'purchases'} onClick={() => setView('purchases')} />
      </div>

      {view === 'ledger' && (
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
                <tr><td colSpan={5}><EmptyState>
                  Nothing owed and nothing owing — this customer has always paid at the counter.
                </EmptyState></td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {view === 'purchases' && (
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr><TH>Receipt</TH><TH>Date</TH><TH>Branch</TH><TH>Paid</TH><TH>List</TH><TH right>Total</TH></tr>
            </thead>
            <tbody>
              {data.purchases.length === 0 && (
                <tr><td colSpan={6}><EmptyState>No purchases recorded against this account yet.</EmptyState></td></tr>
              )}
              {data.purchases.map(p => (
                <tr key={p.id} style={{ opacity: p.status === 'voided' ? 0.45 : 1 }}>
                  <TD mono>
                    {p.receipt_no}
                    {p.status === 'voided' && (
                      <span className="ml-1.5 text-[10px] uppercase font-bold" style={{ color: 'var(--red)' }}>void</span>
                    )}
                  </TD>
                  <TD mono>{p.sold_on}</TD>
                  <TD style={{ color: 'var(--ink-60)' }}>{p.branch_name}</TD>
                  <TD style={{ color: 'var(--ink-60)', textTransform: 'capitalize' }}>{p.payment_method}</TD>
                  <TD style={{ textTransform: 'capitalize', color: p.price_tier === 'wholesale' ? 'var(--blue)' : 'var(--ink-60)' }}>
                    {p.price_tier}
                  </TD>
                  <TD right mono style={{ fontWeight: 600 }}>{fmt(p.total)}</TD>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}

export default function Customers() {
  const { user } = useAuth()
  const isAttendant = user?.role === 'attendant'
  const canManage = !isAttendant

  const [tab,      setTab]      = useState('customers')
  const [data,     setData]     = useState(null)
  const [branches, setBranches] = useState([])
  const [open,     setOpen]     = useState(null)
  const [q,        setQ]        = useState('')
  const [showNew,  setShowNew]  = useState(false)
  const [form,     setForm]     = useState({ name: '', phone: '', opening_balance: '', branch_id: '' })

  const load = useCallback(async () => {
    try { setData(await apiFetch(`/customers${q ? `?q=${encodeURIComponent(q)}` : ''}`)) }
    catch (e) { notify.error(e.message) }
  }, [q])

  useEffect(() => { load() }, [load])
  useEffect(() => { apiFetch('/branches').then(setBranches).catch(() => {}) }, [])

  const create = async () => {
    try {
      await apiFetch('/customers', {
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
    } catch (e) { notify.error(e.message) }
  }

  if (!data) return <div className="p-8 text-center text-sm" style={{ color: 'var(--ink-30)' }}>Loading…</div>

  const rows = tab === 'debtors' ? data.debtors : data.customers

  return (
    <div style={{ animation: 'fadeUp .2s ease' }}>
      <PageHeader title="Customers & Debtors" sub="Who buys from us, and who still owes">
        <input type="search" placeholder="Search a name" value={q} onChange={e => setQ(e.target.value)} />
        <Btn size="sm" variant="primary" onClick={() => setShowNew(v => !v)}>
          {showNew ? 'Cancel' : '+ New customer'}
        </Btn>
      </PageHeader>

      {showNew && (
        <Card>
          <CardTitle>New customer</CardTitle>
          <p className="text-sm mb-3" style={{ color: 'var(--ink-60)' }}>
            Opening an account is worth it for anyone who comes back, not just for someone buying
            on credit — it is how the farm knows what a customer is worth. They only appear under
            Debtors if something is actually owed.
          </p>
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
          { label: 'Customers',        value: fmt(data.totals.count),                       color: 'var(--ink)' },
          { label: 'Lifetime trade',   value: fmtTsh(data.totals.lifetime_spend),           color: 'var(--green-600)' },
          { label: 'Owed to the farm', value: fmtTsh(data.totals.owed),                     color: data.totals.owed > 0 ? 'var(--red)' : 'var(--ink-30)' },
          { label: 'Paid in advance',  value: fmtTsh(Math.abs(data.totals.in_credit)),      color: 'var(--green-600)' },
        ].map(k => (
          <div key={k.label} className="rounded-lg border" style={{ background: 'var(--surface)', borderColor: 'var(--ink-10)', padding: '16px 20px' }}>
            <div className="text-[11px] uppercase tracking-wider font-medium mb-1" style={{ color: 'var(--ink-60)' }}>{k.label}</div>
            <div className="text-[20px] font-semibold" style={{ color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="flex mb-5" style={{ borderBottom: '1px solid var(--ink-10)' }}>
        <TabBtn label="Customers" active={tab === 'customers'} onClick={() => setTab('customers')} />
        <TabBtn label="Debtors"   active={tab === 'debtors'}   onClick={() => setTab('debtors')}
          badge={data.totals.owing_count} />
      </div>

      {tab === 'debtors' && data.debtors.length > 0 && (
        <div className="text-xs mb-3" style={{ color: 'var(--ink-60)' }}>
          The same customers, filtered to those with something outstanding. Settling up takes an
          account off this tab and leaves it on the other.
        </div>
      )}

      <Card noPad>
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <TH>Customer</TH><TH>Phone</TH><TH>Branch</TH>
                <TH right>Spent with us</TH><TH right>Purchases</TH>
                <TH>Last seen</TH><TH right>Balance</TH>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={7}><EmptyState>
                  {q ? 'Nobody matches that name.'
                     : tab === 'debtors' ? 'Nobody owes anything. '
                     : 'No customers yet. Naming one on a sale at the till opens an account.'}
                </EmptyState></td></tr>
              )}
              {rows.map(c => (
                <tr key={c.id} style={{ opacity: c.active ? 1 : 0.5 }}>
                  <td className="px-5 py-3 border-b" style={{ borderColor: 'var(--ink-10)' }}>
                    <button onClick={() => setOpen(c.id)}
                      className="border-0 bg-transparent cursor-pointer font-semibold text-[13px] text-left"
                      style={{ color: 'var(--green-600)' }}>{c.name}</button>
                  </td>
                  <TD style={{ color: 'var(--ink-60)' }}>{c.phone || '—'}</TD>
                  <TD style={{ color: 'var(--ink-60)' }}>{c.branch_name || '—'}</TD>
                  <TD right mono style={{ color: 'var(--ink)' }}>{num(c.total_spent) ? fmt(c.total_spent) : '—'}</TD>
                  <TD right mono style={{ color: 'var(--ink-60)' }}>{c.purchases || '—'}</TD>
                  <TD mono style={{ color: 'var(--ink-60)' }}>
                    {c.last_purchase ? String(c.last_purchase).slice(0, 10) : '—'}
                  </TD>
                  <TD right><Balance value={c.balance} /></TD>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {open && (
        <Account
          id={open}
          canManage={canManage}
          isAttendant={isAttendant}
          branches={branches}
          onClose={() => setOpen(null)}
          onChanged={load}
        />
      )}
    </div>
  )
}
