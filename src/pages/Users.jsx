import React, { useState, useEffect } from 'react'
import { apiFetch, initials } from '../lib/api'
import { useAuth } from '../lib/AuthContext'
import { Card, Btn, PageHeader } from '../components/ui'
import { useConfirm } from '../lib/ConfirmContext'
import { notify } from '../lib/notify'

function RoleBadge({ role }) {
  return (
    <span className={[
      'inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider',
      role === 'admin' ? 'bg-green-100 text-green-800' : 'bg-ink-10 text-ink-60',
    ].join(' ')}>
      {role}
    </span>
  )
}

const ROLE_OPTIONS = [
  ['veteran',   'Veteran — animal health only',                   'Sees the dashboard, the herd list, and the animal health pages.'],
  ['manager',   'Manager — production, sales, stock, processing',  'Sees production, sales, inventory, processing and every branch. No health records.'],
  ['attendant', 'Attendant — one branch counter',                  'Sees only their own branch: its stock, the deliveries coming to it, and its till.'],
  ['admin',     'Admin — full access',                             'Full access, including AI reports and user management.'],
]

export default function Users() {
  const confirm = useConfirm()
  const { user: me } = useAuth()
  const [users,    setUsers]    = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form,     setForm]     = useState({ username: '', password: '', role: 'veteran', branch_id: '' })
  const [branches, setBranches] = useState([])
  const [editing,  setEditing]  = useState(null)
  const [pwdModal, setPwdModal] = useState(null)
  const [newPwd,   setNewPwd]   = useState('')

  const load = () => apiFetch('/users').then(setUsers).catch(() => {})
  useEffect(() => { load() }, [])

  /* Needed only to assign an attendant. If it fails the picker is empty and
     the API refuses the account anyway, which is the same answer. */
  useEffect(() => { apiFetch('/branches').then(setBranches).catch(() => {}) }, [])

  const createUser = async (e) => {
    e.preventDefault()
    try {
      await apiFetch('/users', {
        method: 'POST',
        body: JSON.stringify({ ...form, branch_id: form.branch_id ? Number(form.branch_id) : null }),
      })
      setForm({ username: '', password: '', role: 'veteran', branch_id: '' })
      setShowForm(false); load()
      notify.success(`User "${form.username}" created.`)
    } catch (err) { notify.error(err.message) }
  }

  const deleteUser = async (u) => {
    const ok = await confirm({
      title: 'Delete user',
      message: `The account "${u.username}" is removed and can no longer sign in.`,
      detail: 'This cannot be undone.',
      confirmLabel: 'Delete user',
    })
    if (!ok) return
    try {
      await apiFetch(`/users/${u.id}`, { method: 'DELETE' })
      load(); notify.success(`User "${u.username}" deleted.`)
    } catch (err) { notify.error(err.message) }
  }

  const saveRole = async (u, role, branch_id) => {
    try {
      await apiFetch(`/users/${u.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ role, branch_id: branch_id ? Number(branch_id) : null }),
      })
      setEditing(null); load()
      notify.success(`${u.username} updated.`)
    } catch (err) { notify.error(err.message) }
  }

  const changePassword = async (e) => {
    e.preventDefault()
    try {
      await apiFetch(`/users/${pwdModal.id}/password`, { method: 'PATCH', body: JSON.stringify({ password: newPwd }) })
      setPwdModal(null); setNewPwd(''); notify.success('Password updated.')
    } catch (err) { notify.error(err.message) }
  }

  return (
    <div style={{ animation: 'fadeUp .2s ease' }}>
      <PageHeader title="Users" sub="Manage who can access Milktrack">
        <Btn size="sm" variant="primary" onClick={() => setShowForm(v => !v)}>
          {showForm ? 'Cancel' : '+ New user'}
        </Btn>
      </PageHeader>

      {/* Feedback */}

      {/* Create user form */}
      {showForm && (
        <Card className="mb-5">
          <div className="font-semibold text-sm mb-4">New user</div>
          <form onSubmit={createUser}>
            <div className="grid grid-cols-[1fr_1fr_auto] gap-3 items-end">
              <div>
                <label className="block text-xs text-ink-60 font-medium mb-1.5">Username</label>
                <input type="text" required value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  placeholder="e.g. john" className="w-full" />
              </div>
              <div>
                <label className="block text-xs text-ink-60 font-medium mb-1.5">Password</label>
                <input type="password" required value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Min. 6 characters" className="w-full" minLength={6} />
              </div>
              <div>
                <label className="block text-xs text-ink-60 font-medium mb-1.5">Role</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  {ROLE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <div className="text-[11px] text-ink-30 mt-1.5">
                  {ROLE_OPTIONS.find(([v]) => v === form.role)?.[2]}
                </div>
              </div>
            </div>
            {form.role === 'attendant' && (
              <div className="mt-3" style={{ maxWidth: 280 }}>
                <label className="block text-xs text-ink-60 font-medium mb-1.5">Branch</label>
                <select required value={form.branch_id}
                  onChange={e => setForm(f => ({ ...f, branch_id: e.target.value }))} className="w-full">
                  <option value="">Choose a branch…</option>
                  {branches.filter(b => b.active).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <div className="text-[11px] text-ink-30 mt-1.5">
                  {branches.length === 0
                    ? 'No branches exist yet — add one under Stock & Issuing first.'
                    : 'The account is fixed to this branch and cannot reach any other.'}
                </div>
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <Btn variant="primary" size="sm" onClick={createUser}>Create user</Btn>
              <Btn size="sm" onClick={() => setShowForm(false)}>Cancel</Btn>
            </div>
          </form>
        </Card>
      )}

      {/* Users table */}
      <Card noPad>
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              {['User', 'Role', 'Branch', 'Created', 'Actions'].map(h => (
                <th key={h} className="text-left px-5 py-3 text-[11px] font-semibold tracking-wider uppercase text-ink-60 border-b border-ink-10">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="hover:bg-cream transition-colors">
                <td className="px-5 py-3.5 border-b border-ink-10">
                  <div className="flex items-center gap-2.5">
                    <div className="w-[34px] h-[34px] rounded-full bg-green-100 text-green-800 flex items-center justify-center font-bold text-xs flex-shrink-0">
                      {initials(u.username)}
                    </div>
                    <div>
                      <div className="font-semibold">{u.username}</div>
                      {u.id === me?.id && <div className="text-[11px] text-ink-30">you</div>}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5 border-b border-ink-10">
                  {editing?.id === u.id ? (
                    <select value={editing.role}
                      onChange={e => setEditing(ed => ({ ...ed, role: e.target.value }))}>
                      {ROLE_OPTIONS.map(([value]) => <option key={value} value={value}>{value}</option>)}
                    </select>
                  ) : <RoleBadge role={u.role} />}
                </td>
                <td className="px-5 py-3.5 border-b border-ink-10 text-ink-60 text-xs">
                  {editing?.id === u.id ? (
                    editing.role === 'attendant' ? (
                      <select value={editing.branch_id ?? ''}
                        onChange={e => setEditing(ed => ({ ...ed, branch_id: e.target.value }))}>
                        <option value="">Choose…</option>
                        {branches.filter(b => b.active).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    ) : <span className="text-ink-30">—</span>
                  ) : (u.branch_name || <span className="text-ink-30">—</span>)}
                </td>
                <td className="px-5 py-3.5 border-b border-ink-10 text-ink-60 font-mono text-xs">
                  {u.created_at?.slice(0, 10)}
                </td>
                <td className="px-5 py-3.5 border-b border-ink-10">
                  <div className="flex gap-2 flex-wrap">
                    {editing?.id === u.id ? (
                      <>
                        <Btn size="sm" variant="primary"
                          onClick={() => saveRole(u, editing.role, editing.branch_id)}>Save</Btn>
                        <Btn size="sm" onClick={() => setEditing(null)}>Cancel</Btn>
                      </>
                    ) : (
                      <>
                        {/* Changing your own role is refused by the API — the
                            last admin demoting themselves locks everyone out. */}
                        {u.id !== me?.id && (
                          <Btn size="sm" onClick={() => setEditing({ id: u.id, role: u.role, branch_id: u.branch_id ?? '' })}>
                            Change role
                          </Btn>
                        )}
                        <Btn size="sm" onClick={() => { setPwdModal(u); setNewPwd('') }}>
                          Change password
                        </Btn>
                        {u.id !== me?.id && (
                          <Btn size="sm" variant="danger" onClick={() => deleteUser(u)}>Delete</Btn>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Legend */}
      <div className="mt-4 text-xs text-ink-30 leading-relaxed">
        <strong className="text-ink-60">Admin</strong> — everything, including AI reports and user management.&nbsp;&nbsp;
        <strong className="text-ink-60">Manager</strong> — production records, imports, sales, inventory and the processing unit.&nbsp;&nbsp;
        <strong className="text-ink-60">Veteran</strong> — diseases and treatments, individual health records and pregnancies.&nbsp;&nbsp;
        <strong className="text-ink-60">Attendant</strong> — one branch: its stock, its incoming deliveries and its till.
        <div className="mt-1">
          Admin, manager and veteran accounts all see the dashboard and the herd list. An attendant
          sees neither — they are scoped to the branch on their account.
        </div>
      </div>

      {/* Change password modal */}
      {pwdModal && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setPwdModal(null) }}
          className="fixed inset-0 bg-[rgba(10,30,20,0.45)] z-[100] flex items-center justify-center"
        >
          <div className="bg-surface rounded-[16px] p-7 w-[340px] max-w-[92vw]">
            <div className="flex justify-between items-center mb-5">
              <div className="font-serif text-[18px]">Change password</div>
              <span onClick={() => setPwdModal(null)} className="cursor-pointer text-[18px] text-ink-30 hover:text-ink">✕</span>
            </div>
            <div className="text-[13px] text-ink-60 mb-4">
              Setting new password for <strong>{pwdModal.username}</strong>
            </div>
            <form onSubmit={changePassword}>
              <input
                type="password" required minLength={6} value={newPwd}
                onChange={e => setNewPwd(e.target.value)}
                placeholder="New password (min. 6 chars)"
                className="w-full mb-4" autoFocus
              />
              <div className="flex gap-2">
                <Btn variant="primary" size="sm" onClick={changePassword}>Update</Btn>
                <Btn size="sm" onClick={() => setPwdModal(null)}>Cancel</Btn>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}