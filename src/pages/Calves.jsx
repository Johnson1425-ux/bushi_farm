import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { Card, Btn, PageHeader, EmptyState, RowMenu } from '../components/ui'
import { useAuth } from '../lib/AuthContext'
import { useConfirm } from '../lib/ConfirmContext'
import { notify } from '../lib/notify'

const today = () => new Date().toISOString().slice(0, 10)

const VIEWS = [
  ['current',       'On the farm'],
  ['moved_to_herd', 'In the herd'],
  ['dead',          'Died'],
  ['sold',          'Sold'],
  ['all',           'All'],
]

const STATUS_CHIP = {
  on_farm:       { label: 'On the farm', bg: 'var(--green-50)',           fg: 'var(--green-600)' },
  weaned:        { label: 'Weaned',      bg: 'var(--green-100)',          fg: 'var(--green-800)' },
  moved_to_herd: { label: 'In the herd', bg: 'rgba(52,120,200,0.12)',     fg: 'var(--blue)' },
  dead:          { label: 'Died',        bg: 'rgba(217,64,64,0.1)',       fg: 'var(--red)' },
  sold:          { label: 'Sold',        bg: 'var(--ink-10)',             fg: 'var(--ink-60)' },
}

/**
 * How old she is, in the units a farmer would actually say out loud.
 *
 * Days up to a fortnight, then weeks, then months, then years and months —
 * "412 days" tells nobody anything, and a calf's age is the whole reason
 * this page is read.
 */
function age(days) {
  if (days == null) return '—'
  if (days < 0)  return 'not yet born'
  if (days < 14) return `${days} day${days === 1 ? '' : 's'}`
  if (days < 70) return `${Math.floor(days / 7)} weeks`
  if (days < 365) return `${Math.floor(days / 30.44)} months`
  const years  = Math.floor(days / 365.25)
  const months = Math.floor((days - years * 365.25) / 30.44)
  return months ? `${years}y ${months}m` : `${years} year${years === 1 ? '' : 's'}`
}

function StatusChip({ status }) {
  const s = STATUS_CHIP[status] || STATUS_CHIP.on_farm
  return (
    <span className="inline-block text-[11px] font-medium px-2.5 py-0.5 rounded-full"
      style={{ background: s.bg, color: s.fg }}>{s.label}</span>
  )
}

function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(10,30,20,0.45)' }}
      role="dialog" aria-modal="true" aria-label={title}>
      <div className={`rounded-[16px] w-full ${wide ? 'max-w-lg' : 'max-w-md'} p-7 my-8`}
        style={{ background: 'var(--surface)' }}>
        <div className="flex items-center justify-between mb-5">
          <div className="font-serif text-[18px]" style={{ color: 'var(--ink)' }}>{title}</div>
          <button onClick={onClose} className="border-0 bg-transparent text-xl cursor-pointer p-1 hover:opacity-60"
            style={{ color: 'var(--ink-30)' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label className="block text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--ink-60)', marginBottom: 6 }}>
        {label}
        {hint && <span className="normal-case tracking-normal font-normal ml-1.5" style={{ color: 'var(--ink-30)' }}>{hint}</span>}
      </label>
      {children}
    </div>
  )
}

/**
 * Register a birth, or correct one already registered.
 *
 * The same form does both, because the fields are the same and a calf
 * typed in at 5am gets corrected at 9am more often than anyone admits.
 */
function CalfForm({ calf, cows, prefill, onClose, onSaved }) {
  const editing = Boolean(calf)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true); setError(null)
    const fd = new FormData(e.target)
    const body = {
      name:          fd.get('name'),
      tag:           fd.get('tag'),
      sex:           fd.get('sex'),
      breed:         fd.get('breed'),
      date_of_birth: fd.get('date_of_birth'),
      dam_id:        fd.get('dam_id') || null,
      sire:          fd.get('sire'),
      birth_weight:  fd.get('birth_weight'),
      notes:         fd.get('notes'),
    }
    if (!editing && prefill?.pregnancy_id) body.pregnancy_id = prefill.pregnancy_id

    try {
      const saved = editing
        ? await apiFetch(`/calves/${calf.id}`, { method: 'PATCH', body: JSON.stringify(body) })
        : await apiFetch('/calves', { method: 'POST', body: JSON.stringify(body) })
      notify.success(editing ? `${saved.name} updated.` : `${saved.name} is on the books.`)
      onSaved()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal title={editing ? `Edit ${calf.name}` : 'Record a calf'} onClose={onClose} wide>
      <form onSubmit={submit}>
        {!editing && prefill?.pregnancy_id && (
          <div className="text-xs mb-4 rounded-lg px-3 py-2" style={{ background: 'var(--green-50)', color: 'var(--green-800)' }}>
            Recording this calf closes the pregnancy she came from and marks it delivered.
          </div>
        )}

        <div className="grid grid-cols-2 gap-x-4">
          <Field label="Name">
            <input type='text' name="name" required maxLength={100} autoFocus={!editing} className="w-full"
              defaultValue={calf?.name || ''} placeholder="What she is called" />
          </Field>
          <Field label="Tag" hint="(optional)">
            <input type='text' name="tag" maxLength={50} className="w-full" defaultValue={calf?.tag || ''} />
          </Field>
          <Field label="Sex">
            <select name="sex" className="w-full" defaultValue={calf?.sex || 'female'}>
              <option value="female">Heifer calf (female)</option>
              <option value="male">Bull calf (male)</option>
            </select>
          </Field>
          <Field label="Date of birth">
            <input type='date' name="date_of_birth" required max={today()} className="w-full"
              defaultValue={calf?.date_of_birth || prefill?.date_of_birth || today()} />
          </Field>
          <Field label="Dam" hint="(the mother)">
            <select name="dam_id" className="w-full" defaultValue={calf?.dam_id || prefill?.dam_id || ''}>
              <option value="">Not recorded</option>
              {/* The list handed down is the working herd. A dam who has
                  since died or been sold is not in it, so she is added
                  back here — without this the select falls back to blank
                  and saving the form would quietly forget who the mother
                  was. */}
              {calf?.dam_id && !cows.some(c => String(c.id) === String(calf.dam_id)) && (
                <option value={calf.dam_id}>{calf.dam_name || `Cow #${calf.dam_id}`} (no longer in the herd)</option>
              )}
              {cows.map(c => (
                <option key={c.id} value={c.id}>{c.name}{c.tag ? ` #${c.tag}` : ''}</option>
              ))}
            </select>
          </Field>
          <Field label="Sire" hint="(bull or semen batch)">
            <input type='text' name="sire" maxLength={200} className="w-full"
              defaultValue={calf?.sire || prefill?.sire || ''} />
          </Field>
          <Field label="Breed" hint="(optional)">
            <input type='text' name="breed" maxLength={100} className="w-full" defaultValue={calf?.breed || ''} />
          </Field>
          <Field label="Birth weight" hint="(kg, optional)">
            <input type='number' name="birth_weight" step="0.1" min="0" className="w-full"
              defaultValue={calf?.birth_weight ?? ''} />
          </Field>
        </div>

        <Field label="Notes" hint="(optional)">
          <input type='text' name="notes" maxLength={1000} className="w-full" defaultValue={calf?.notes || ''}
            placeholder="How the calving went, anything worth remembering" />
        </Field>

        {error && (
          <div className="rounded-lg text-xs px-3 py-2 mb-3"
            style={{ background: 'rgba(217,64,64,0.1)', color: 'var(--red)', border: '1px solid rgba(217,64,64,0.2)' }}>
            {error}
          </div>
        )}

        <div className="flex gap-2 justify-end mt-2">
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" type="submit" disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save' : 'Record calf'}
          </Btn>
        </div>
      </form>
    </Modal>
  )
}

/** Weaned, died or sold — the three things that happen to a calf that are
    not "she joined the milking herd". */
function StatusForm({ calf, onClose, onSaved }) {
  const [status, setStatus] = useState(calf.status === 'on_farm' ? 'weaned' : calf.status)
  const [date,   setDate]   = useState(today())
  const [notes,  setNotes]  = useState('')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true); setError(null)
    const body = { status }
    if (status === 'weaned') body.weaned_on = date
    else body.left_on = date
    if (notes.trim()) body.notes = notes.trim()

    try {
      await apiFetch(`/calves/${calf.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      notify.success(`${calf.name} updated.`)
      onSaved()
    } catch (err) {
      setError(err.message); setSaving(false)
    }
  }

  return (
    <Modal title={`Update ${calf.name}`} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="What happened">
          <div className="flex gap-2 flex-wrap">
            {[['weaned', 'Weaned'], ['dead', 'Died'], ['sold', 'Sold']].map(([v, l]) => (
              <button key={v} type="button" onClick={() => setStatus(v)}
                className="px-3.5 py-1.5 rounded-full text-xs font-medium border cursor-pointer transition-all"
                style={status === v
                  ? { borderColor: 'var(--green-600)', background: 'var(--green-600)', color: '#fff' }
                  : { borderColor: 'var(--ink-10)', background: 'var(--surface)', color: 'var(--ink-60)' }}>
                {l}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Date">
          <input type="date" value={date} max={today()} onChange={e => setDate(e.target.value)} className="w-full" />
        </Field>

        <Field label="Note" hint="(optional)">
          <input type="text" value={notes} maxLength={1000} onChange={e => setNotes(e.target.value)} className="w-full"
            placeholder={status === 'sold' ? 'Buyer, price' : status === 'dead' ? 'Cause' : 'Anything worth remembering'} />
        </Field>

        {error && (
          <div className="rounded-lg text-xs px-3 py-2 mb-3"
            style={{ background: 'rgba(217,64,64,0.1)', color: 'var(--red)', border: '1px solid rgba(217,64,64,0.2)' }}>
            {error}
          </div>
        )}

        <div className="flex gap-2 justify-end mt-2">
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Btn>
        </div>
      </form>
    </Modal>
  )
}

export default function Calves({ cows = [], onChanged }) {
  const confirm = useConfirm()
  const { user } = useAuth()
  const canRecord = ['admin', 'manager', 'veteran'].includes(user?.role)
  const canMove   = ['admin', 'manager'].includes(user?.role)
  const canDelete = user?.role === 'admin'

  const [params, setParams] = useSearchParams()
  const [calves,  setCalves]  = useState([])
  const [loading, setLoading] = useState(true)
  const [view,    setView]    = useState('current')
  const [search,  setSearch]  = useState('')
  const [adding,  setAdding]  = useState(false)
  const [editing, setEditing] = useState(null)
  const [status,  setStatus]  = useState(null)

  /* The pregnancy page links here to record the calf from a delivery, so
     the dam and the birth date arrive in the address and the form opens
     already filled in. */
  const prefill = params.get('pregnancy')
    ? {
        pregnancy_id:  params.get('pregnancy'),
        dam_id:        params.get('dam') || '',
        date_of_birth: params.get('born') || today(),
        sire:          params.get('sire') || '',
      }
    : null

  const load = useCallback(async () => {
    try {
      setCalves(await apiFetch(`/calves?status=${view}`))
    } catch (e) {
      notify.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [view])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (prefill) setAdding(true) }, [params])

  const closeForm = () => {
    setAdding(false); setEditing(null)
    /* Clear the prefill out of the address, or coming back to the page
       reopens the form on a calf that has already been recorded. */
    if (params.get('pregnancy')) setParams({}, { replace: true })
  }

  const moveToHerd = async (calf) => {
    const ok = await confirm({
      title: `Move ${calf.name} into the herd`,
      message: `She gets a cow record, so her milk can be recorded against her and she `
             + `starts counting toward the herd's averages.`,
      detail: 'Her calf record is kept — her dam, her birth date and her birth weight stay with her.',
      confirmLabel: 'Move into the herd',
      tone: 'default',
    })
    if (!ok) return
    try {
      const { cow } = await apiFetch(`/calves/${calf.id}/move-to-herd`, { method: 'POST' })
      notify.success(`${cow.name} is in the herd.`)
      load(); onChanged?.()
    } catch (e) { notify.error(e.message) }
  }

  const remove = async (calf) => {
    const ok = await confirm({
      title: `Delete ${calf.name}`,
      message: 'The calf record is removed entirely.',
      detail: 'This is for a row typed in by mistake. If she died or was sold, use Update '
            + 'instead — that keeps her in the season\'s calving figures.',
      confirmLabel: 'Delete',
    })
    if (!ok) return
    try {
      await apiFetch(`/calves/${calf.id}`, { method: 'DELETE' })
      notify.success(`${calf.name} deleted.`)
      load()
    } catch (e) { notify.error(e.message) }
  }

  const shown = search
    ? calves.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.tag || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.dam_name || '').toLowerCase().includes(search.toLowerCase()))
    : calves

  /* Counted off what is on screen, so the numbers always describe the list
     underneath them rather than a herd the view is not showing. */
  const heifers = shown.filter(c => c.sex === 'female').length
  const bulls   = shown.filter(c => c.sex === 'male').length
  const unweaned = shown.filter(c => c.status === 'on_farm').length

  return (
    <div style={{ animation: 'fadeUp .2s ease' }}>
      <PageHeader title="Calves" sub="The young stock: born on the farm, raised to join the herd">
        {canRecord && <Btn size="sm" variant="primary" onClick={() => setAdding(true)}>+ Record a calf</Btn>}
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Shown',       value: shown.length, color: 'var(--ink)' },
          { label: 'Heifers',     value: heifers,      color: 'var(--green-600)' },
          { label: 'Bull calves', value: bulls,        color: 'var(--blue)' },
          { label: 'Still suckling', value: unweaned,  color: 'var(--amber)' },
        ].map(k => (
          <div key={k.label} className="rounded-lg border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--ink-10)' }}>
            <div className="text-[11px] uppercase tracking-wider font-medium mb-1" style={{ color: 'var(--ink-60)' }}>{k.label}</div>
            <div className="text-[26px] font-semibold" style={{ color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-4 flex-wrap items-center">
        {VIEWS.map(([v, l]) => (
          <button key={v} onClick={() => { setLoading(true); setView(v) }}
            className="px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer"
            style={{
              background:  view === v ? 'var(--green-600)' : 'var(--surface)',
              color:       view === v ? '#fff' : 'var(--ink-60)',
              borderColor: view === v ? 'var(--green-600)' : 'var(--ink-10)',
            }}>{l}</button>
        ))}
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search name, tag or dam…" className="w-48 ml-auto" />
      </div>

      <Card noPad>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                {['Calf', 'Sex', 'Born', 'Age', 'Dam', 'Sire', 'Status', ''].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-[11px] font-semibold tracking-wider uppercase border-b whitespace-nowrap"
                    style={{ color: 'var(--ink-60)', borderColor: 'var(--ink-10)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8}><EmptyState>Loading…</EmptyState></td></tr>
              )}
              {!loading && shown.length === 0 && (
                <tr><td colSpan={8}>
                  <EmptyState>
                    {search
                      ? 'No calves match that search.'
                      : view === 'current'
                        ? 'No calves on the farm yet. Record one when a cow calves, or from a delivered pregnancy.'
                        : 'Nothing here yet.'}
                  </EmptyState>
                </td></tr>
              )}
              {!loading && shown.map(c => (
                <tr key={c.id} style={{ transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--cream)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <td className="px-5 py-3 border-b font-semibold whitespace-nowrap" style={{ color: 'var(--ink)', borderColor: 'var(--ink-10)' }}>
                    {c.name}
                    {c.tag && <span className="text-xs ml-1 font-normal" style={{ color: 'var(--ink-30)' }}>#{c.tag}</span>}
                    {c.breed && <div className="text-[11px] font-normal" style={{ color: 'var(--ink-30)' }}>{c.breed}</div>}
                  </td>
                  <td className="px-5 py-3 border-b" style={{ color: 'var(--ink-60)', borderColor: 'var(--ink-10)' }}>
                    {c.sex === 'male' ? 'Bull' : 'Heifer'}
                  </td>
                  <td className="px-5 py-3 border-b font-mono text-xs whitespace-nowrap" style={{ color: 'var(--ink-60)', borderColor: 'var(--ink-10)' }}>
                    {c.date_of_birth}
                    {c.birth_weight != null && (
                      <div className="text-[10px]" style={{ color: 'var(--ink-30)' }}>{Number(c.birth_weight)} kg at birth</div>
                    )}
                  </td>
                  <td className="px-5 py-3 border-b whitespace-nowrap" style={{ color: 'var(--ink-60)', borderColor: 'var(--ink-10)' }}>
                    {age(c.age_days)}
                  </td>
                  <td className="px-5 py-3 border-b" style={{ color: 'var(--ink-60)', borderColor: 'var(--ink-10)' }}>
                    {c.dam_name || <span style={{ color: 'var(--ink-30)' }}>—</span>}
                  </td>
                  <td className="px-5 py-3 border-b text-xs" style={{ color: 'var(--ink-30)', borderColor: 'var(--ink-10)' }}>
                    {c.sire || '—'}
                  </td>
                  <td className="px-5 py-3 border-b whitespace-nowrap" style={{ borderColor: 'var(--ink-10)' }}>
                    <StatusChip status={c.status} />
                    {c.status === 'moved_to_herd' && c.herd_name && (
                      <div className="text-[10px] mt-0.5" style={{ color: 'var(--ink-30)' }}>as {c.herd_name}</div>
                    )}
                    {c.status === 'weaned' && c.weaned_on && (
                      <div className="text-[10px] mt-0.5" style={{ color: 'var(--ink-30)' }}>{c.weaned_on}</div>
                    )}
                    {['dead', 'sold'].includes(c.status) && c.left_on && (
                      <div className="text-[10px] mt-0.5" style={{ color: 'var(--ink-30)' }}>{c.left_on}</div>
                    )}
                  </td>
                  <td className="px-5 py-3 border-b" style={{ borderColor: 'var(--ink-10)' }}>
                    <div className="flex justify-end">
                      <RowMenu label={`Actions for ${c.name}`} items={[
                        canRecord && c.status !== 'moved_to_herd' && { label: 'Edit', onClick: () => setEditing(c) },
                        canRecord && c.status !== 'moved_to_herd' && { label: 'Update status', onClick: () => setStatus(c) },
                        canMove && ['on_farm', 'weaned'].includes(c.status) && c.sex === 'female' && {
                          label: 'Move to herd', onClick: () => moveToHerd(c),
                          title: 'She is old enough to milk — give her a place in the herd',
                        },
                        canDelete && c.status !== 'moved_to_herd' && { label: 'Delete', danger: true, onClick: () => remove(c) },
                      ]} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {(adding || editing) && (
        <CalfForm
          calf={editing}
          cows={cows}
          prefill={editing ? null : prefill}
          onClose={closeForm}
          onSaved={() => { closeForm(); load() }}
        />
      )}

      {status && (
        <StatusForm
          calf={status}
          onClose={() => setStatus(null)}
          onSaved={() => { setStatus(null); load() }}
        />
      )}
    </div>
  )
}
