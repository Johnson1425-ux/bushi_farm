import React, { useState, useEffect } from 'react'
import { apiFetch, initials } from '../lib/api'
import { useAuth } from '../lib/AuthContext'
import { Card, Btn, PageHeader } from '../components/ui'

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

export default function Users() {
  const { user: me } = useAuth()
  const [users,    setUsers]    = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form,     setForm]     = useState({ username: '', password: '', role: 'viewer' })
  const [pwdModal, setPwdModal] = useState(null)
  const [newPwd,   setNewPwd]   = useState('')
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState('')

  const load = () => apiFetch('/users').then(setUsers).catch(() => {})
  useEffect(() => { load() }, [])

  const flash = (msg, isErr = false) => {
    if (isErr) { setError(msg); setTimeout(() => setError(''), 4000) }
    else        { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }
  }

  const createUser = async (e) => {
    e.preventDefault()
    try {
      await apiFetch('/users', { method: 'POST', body: JSON.stringify(form) })
      setForm({ username: '', password: '', role: 'viewer' })
      setShowForm(false); load()
      flash(`User "${form.username}" created.`)
    } catch (err) { flash(err.message, true) }
  }

  const deleteUser = async (u) => {
    if (!confirm(`Delete user "${u.username}"? This cannot be undone.`)) return
    try {
      await apiFetch(`/users/${u.id}`, { method: 'DELETE' })
      load(); flash(`User "${u.username}" deleted.`)
    } catch (err) { flash(err.message, true) }
  }

  const changePassword = async (e) => {
    e.preventDefault()
    try {
      await apiFetch(`/users/${pwdModal.id}/password`, { method: 'PATCH', body: JSON.stringify({ password: newPwd }) })
      setPwdModal(null); setNewPwd(''); flash('Password updated.')
    } catch (err) { flash(err.message, true) }
  }

  return (
    <div style={{ animation: 'fadeUp .2s ease' }}>
      <PageHeader title="Users" sub="Manage who can access Bushi Farm">
        <Btn size="sm" variant="primary" onClick={() => setShowForm(v => !v)}>
          {showForm ? 'Cancel' : '+ New user'}
        </Btn>
      </PageHeader>

      {/* Feedback */}
      {error   && <div className="bg-red/10 border border-red/30 rounded-lg px-4 py-2.5 text-[13px] text-red mb-4">{error}</div>}
      {success && <div className="bg-green-50 border border-green-100 rounded-lg px-4 py-2.5 text-[13px] text-green-800 mb-4">{success}</div>}

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
                  <option value="viewer">Viewer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
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
              {['User', 'Role', 'Created', 'Actions'].map(h => (
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
                <td className="px-5 py-3.5 border-b border-ink-10"><RoleBadge role={u.role} /></td>
                <td className="px-5 py-3.5 border-b border-ink-10 text-ink-60 font-mono text-xs">
                  {u.created_at?.slice(0, 10)}
                </td>
                <td className="px-5 py-3.5 border-b border-ink-10">
                  <div className="flex gap-2">
                    <Btn size="sm" onClick={() => { setPwdModal(u); setNewPwd('') }}>
                      Change password
                    </Btn>
                    {u.id !== me?.id && (
                      <Btn size="sm" variant="danger" onClick={() => deleteUser(u)}>Delete</Btn>
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
        <strong className="text-ink-60">Admin</strong> — full access: import data, delete records, manage users.&nbsp;&nbsp;
        <strong className="text-ink-60">Viewer</strong> — read-only: browse dashboard, cows, records, and compare.
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