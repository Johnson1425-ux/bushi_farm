/* ══════════════════════════════════════════════════════════════
   INDIVIDUAL HEALTH RECORD — THE FORM

   The Bushi Dairy Farm Individual Health Records sheet, as a form the vet
   fills in the app instead of on paper.

   It follows the printed sheet section for section and, inside a section,
   field for field, in the same order and under the same headings. A vet
   who knows the paper form should not have to look for anything: the point
   of keeping the order is that they can work down the screen the way they
   work down the page, and that a record typed here and a scan of the paper
   copy can be read against each other line by line.

   Every field is optional but the animal. An examination sheet is a record
   of what was found, and a vet who has not run a blood smear should not be
   made to type something into PCV to save the page — what they did not
   record is a blank, which is a fact about the examination, not an error.
══════════════════════════════════════════════════════════════ */

import { useState } from 'react'
import { Btn } from './ui'

/* ─── the form, as printed ────────────────────────────────────
   Labels are verbatim from the sheet, including its spelling, so this
   page and the .docx the app hands out ask the same questions in the same
   words. The keys are the API's; the backend's healthRecordForm.js holds
   the same list. */

const IDENTIFICATION = [
  { key: 'cow_tag',          label: 'ID/Tag no.' },
  { key: 'age',              label: 'Age',              placeholder: 'e.g. 4 years' },
  { key: 'breed',            label: 'Breed' },
  { key: 'sex',              label: 'Sex',              options: ['Female', 'Male'] },
  { key: 'body_weight',      label: 'Body weight',      placeholder: 'e.g. 420 kg' },
  { key: 'repro_status',     label: 'Status',           hint: 'pregnant / cycling / serviced',
    options: ['Pregnant', 'Cycling', 'Serviced', 'Open', 'Dry'] },
  { key: 'parity',           label: 'Parity' },
  { key: 'daily_milk_yield', label: 'Daily milk yield', placeholder: 'e.g. 18 L' },
  { key: 'days_in_milk',     label: 'Days in milk' },
]

const HISTORY = [
  { key: 'present_illness', label: 'Major complaint', rows: 2 },
  { key: 'past_history',    label: 'Past history', rows: 2,
    hint: 'Medical, surgical, Trauma, Vaccination, Deworming' },
  { key: 'environment',     label: 'Environment',   rows: 2 },
  { key: 'system_review',   label: 'System review', rows: 2 },
]

const VITALS = [
  { key: 'body_temperature', label: 'Body temperature', unit: '°C' },
  { key: 'pulse_rate',       label: 'Pulse rate',       unit: 'beats/min' },
  { key: 'respiratory_rate', label: 'Respiratory rate', unit: 'breaths/min' },
  { key: 'crt_seconds',      label: 'CRT',              unit: 'seconds' },
  { key: 'rumino_motility',  label: 'Rumino-motility',  unit: 'per 2 min' },
]

const SYSTEMS = [
  'General appearance (BCS)', 'Integumentary', 'Musculoskeletal', 'Circulatory',
  'Respiratory', 'Digestive', 'Genitourinary', 'Ears/Eyes',
  'Mammary system/Udder', 'Neural system', 'Lymph nodes', 'Circulatory (MM/CRT)',
]

const BLOOD_SMEAR = [
  { key: 'pcv',         label: 'PCV' },
  { key: 'eosinophils', label: 'Eosinophils' },
  { key: 'basophils',   label: 'Basophils' },
  { key: 'neutrophils', label: 'Neutrophils' },
]

const LABORATORY = [
  { key: 'bacteriology',   label: 'Bacteriology culture & sensitivity results', rows: 2 },
  { key: 'skin_scrapings', label: 'Skin scrapings' },
  { key: 'fecal_sample',   label: 'Faecal sample' },
  { key: 'other_lab',      label: 'Other laboratory' },
  { key: 'lab_findings',   label: 'Findings', rows: 2 },
]

/* The paper form prints four prescription lines. Starting with the same
   four means a vet coming from the sheet sees what they expect; the button
   below the table takes it further when a case needs more. */
const BLANK_TREATMENT_ROWS = 4

const emptyTreatment = () => ({ drug: '', prescription: '' })

/**
 * A blank record, with the findings grid already carrying all twelve rows.
 *
 * The grid is built full rather than grown as the vet fills it in, because
 * on the paper form all twelve are printed: the vet reads down them as a
 * checklist of what to examine. A grid that started empty would turn that
 * checklist into something they have to remember.
 */
function blankRecord() {
  return {
    cow_id: '',
    clinical_findings: SYSTEMS.map(system => ({ system, status: '', observations: '' })),
    treatments: Array.from({ length: BLANK_TREATMENT_ROWS }, emptyTreatment),
  }
}

/**
 * An existing record as form state.
 *
 * A record that arrived as an upload carries only the rows the parser
 * found, so the findings grid is filled back out to all twelve — the
 * systems the vet did not write about are still systems they may want to
 * fill in now, and dropping them would make the edit form quietly shorter
 * than the new-record form.
 */
function recordToForm(record) {
  const saved = Array.isArray(record.clinical_findings) ? record.clinical_findings : []
  const byName = new Map(saved.map(f => [f.system, f]))

  const findings = SYSTEMS.map(system => ({
    system,
    status:       byName.get(system)?.status || '',
    observations: byName.get(system)?.observations || '',
  }))
  /* Anything an older upload recorded under a name this form no longer
     prints is kept at the bottom rather than thrown away on save. */
  for (const f of saved) {
    if (!SYSTEMS.includes(f.system)) {
      findings.push({ system: f.system, status: f.status || '', observations: f.observations || '' })
    }
  }

  const saved_tx = Array.isArray(record.treatments) ? record.treatments : []
  const treatments = saved_tx.length
    ? saved_tx.map(t => ({ drug: t.drug || '', prescription: t.prescription || '' }))
    : Array.from({ length: BLANK_TREATMENT_ROWS }, emptyTreatment)

  return { ...record, cow_id: record.cow_id ?? '', clinical_findings: findings, treatments }
}

/* ─── layout ──────────────────────────────────────────────────── */

function Section({ n, title, hint, children }) {
  return (
    <section className="mb-8">
      <div className="flex items-baseline gap-2 mb-1 pb-1.5"
        style={{ borderBottom: '1px solid var(--ink-10)' }}>
        <span className="text-[11px] font-bold tabular-nums" style={{ color: 'var(--green-400)' }}>
          {String(n).padStart(2, '0')}
        </span>
        <h3 className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: 'var(--green-600)' }}>
          {title}
        </h3>
      </div>
      {hint && <p className="text-[11px] mb-3 font-light" style={{ color: 'var(--ink-30)' }}>{hint}</p>}
      <div className={hint ? '' : 'mt-3'}>{children}</div>
    </section>
  )
}

function Label({ children, hint, htmlFor }) {
  return (
    <label htmlFor={htmlFor} className="block mb-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--ink-60)' }}>
        {children}
      </span>
      {hint && <span className="text-[11px] ml-1.5 font-light normal-case" style={{ color: 'var(--ink-30)' }}>({hint})</span>}
    </label>
  )
}

/**
 * One field, rendered as whatever it is on the sheet: a short box, a
 * multi-line box for the ruled paragraphs, or a list where the sheet
 * prints the choices in the label itself.
 *
 * The lists stay editable — the sheet's "Status(pregnant/cycling/serviced)"
 * names three states but a vet writing "Dry" on paper is not filling the
 * form in wrongly, and a fixed dropdown would be the app deciding it knows
 * the herd better than they do.
 *
 * Every input spells out its type. The app styles inputs with
 * input[type="text"], an attribute selector that a bare <input> does not
 * match, so leaving the type off renders a box with no border, no padding
 * and no background — which reads on the page as a field that isn't there.
 */
function Field({ field, value, onChange }) {
  const id = `hr-${field.key}`
  const common = {
    id,
    value: value ?? '',
    onChange: e => onChange(field.key, e.target.value),
    className: 'w-full',
  }

  return (
    <div>
      <Label htmlFor={id} hint={field.hint}>{field.label}</Label>
      {field.rows ? (
        <textarea {...common} rows={field.rows} placeholder={field.placeholder}
          style={{
            border: '1.5px solid var(--ink-10)', borderRadius: 8, padding: '9px 12px',
            background: 'var(--surface)', color: 'var(--ink)', fontSize: 14,
            fontFamily: 'inherit', resize: 'vertical', outline: 'none',
          }} />
      ) : field.options ? (
        <>
          <input {...common} type="text" list={`${id}-options`} placeholder={field.placeholder} />
          <datalist id={`${id}-options`}>
            {field.options.map(o => <option key={o} value={o} />)}
          </datalist>
        </>
      ) : (
        <input {...common} type="text" placeholder={field.placeholder} />
      )}
    </div>
  )
}

function Grid({ cols = 3, children }) {
  return (
    <div className="grid gap-x-4 gap-y-4"
      style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${cols === 2 ? 260 : 200}px, 1fr))` }}>
      {children}
    </div>
  )
}

/* ─── the form ────────────────────────────────────────────────── */

export default function HealthRecordForm({ record, cows = [], onSubmit, onCancel, saving, error }) {
  const [form, setForm] = useState(() => record ? recordToForm(record) : blankRecord())
  const editing = Boolean(record?.id)

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }))

  const setFinding = (i, key, value) => setForm(f => ({
    ...f,
    clinical_findings: f.clinical_findings.map((row, j) => j === i ? { ...row, [key]: value } : row),
  }))

  const setTreatment = (i, key, value) => setForm(f => ({
    ...f,
    treatments: f.treatments.map((row, j) => j === i ? { ...row, [key]: value } : row),
  }))

  const addTreatment = () => setForm(f => ({ ...f, treatments: [...f.treatments, emptyTreatment()] }))

  const removeTreatment = i => setForm(f => ({
    ...f,
    treatments: f.treatments.length > 1 ? f.treatments.filter((_, j) => j !== i) : f.treatments,
  }))

  /**
   * Picking a cow fills in what the herd already knows.
   *
   * Only into fields the vet has not typed in: the record is what was true
   * at this examination, so a weight or a breed they have corrected on the
   * sheet stands, and the herd record does not overwrite it.
   */
  const pickCow = (cow_id) => {
    const cow = cows.find(c => String(c.id) === String(cow_id))
    setForm(f => ({
      ...f,
      cow_id,
      cow_tag: f.cow_tag || cow?.tag || '',
      breed:   f.breed   || cow?.breed || '',
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    /* Blank rows are dropped here rather than sent and filtered server-side
       so that what the vet sees saved is what they typed: twelve findings
       rows and four prescription lines are the printed page, not twelve
       findings and four treatments. */
    onSubmit({
      ...form,
      clinical_findings: form.clinical_findings.filter(f => f.status || f.observations?.trim()),
      treatments:        form.treatments.filter(t => t.drug?.trim()),
    })
  }

  const cowName = cows.find(c => String(c.id) === String(form.cow_id))?.name

  return (
    /* A column: the sheet scrolls, the actions below it do not. */
    <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto px-7 pt-6">
      {/* ── 01 Animal identification and history ── */}
      <Section n={1} title="Animal identification and history">
        <div className="mb-4">
          <Label htmlFor="hr-cow_id" hint="links the record to the herd">Cow</Label>
          <select id="hr-cow_id" className="w-full" value={form.cow_id ?? ''}
            onChange={e => pickCow(e.target.value)}>
            <option value="">— Not linked, identify by tag below —</option>
            {cows.map(c => (
              <option key={c.id} value={c.id}>{c.name}{c.tag ? ` #${c.tag}` : ''}</option>
            ))}
          </select>
        </div>
        <Grid>
          {IDENTIFICATION.map(f => (
            <Field key={f.key} field={f} value={form[f.key]} onChange={set} />
          ))}
        </Grid>
      </Section>

      {/* ── 02 Clinical examination ── */}
      <Section n={2} title="Clinical examination">
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {HISTORY.map(f => (
            <Field key={f.key} field={f} value={form[f.key]} onChange={set} />
          ))}
        </div>

        <div className="mt-5 rounded-lg p-4" style={{ background: 'var(--cream)' }}>
          <Grid cols={3}>
            {VITALS.map(f => (
              <Field key={f.key} field={{ ...f, hint: f.unit }} value={form[f.key]} onChange={set} />
            ))}
          </Grid>
        </div>
      </Section>

      {/* ── 03 Clinical examination findings ── */}
      <Section n={3} title="Clinical examination findings"
        hint="All twelve systems, as printed. Leave a row blank if it was not examined.">
        <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--ink-10)' }}>
          <table className="w-full border-collapse text-[13px]" style={{ minWidth: 520 }}>
            <thead>
              <tr>
                {['System', 'Status', 'Specific observations'].map((h, i) => (
                  <th key={h}
                    className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-wider border-b"
                    style={{
                      color: 'var(--ink-60)', borderColor: 'var(--ink-10)',
                      background: 'var(--cream)', width: i === 0 ? '30%' : i === 1 ? '22%' : '48%',
                    }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {form.clinical_findings.map((row, i) => (
                <tr key={row.system}>
                  <td className="px-3 py-1.5 border-b align-middle"
                    style={{ borderColor: 'var(--ink-10)', color: 'var(--ink)' }}>
                    {row.system}
                  </td>
                  <td className="px-3 py-1.5 border-b" style={{ borderColor: 'var(--ink-10)' }}>
                    <select className="w-full" value={row.status}
                      onChange={e => setFinding(i, 'status', e.target.value)}
                      style={{ padding: '5px 8px', fontSize: 13 }}>
                      <option value="">—</option>
                      <option value="Normal">Normal</option>
                      <option value="Abnormal">Abnormal</option>
                    </select>
                  </td>
                  <td className="px-3 py-1.5 border-b" style={{ borderColor: 'var(--ink-10)' }}>
                    <input type="text" className="w-full" value={row.observations}
                      onChange={e => setFinding(i, 'observations', e.target.value)}
                      placeholder={row.status === 'Abnormal' ? 'What was seen' : ''}
                      style={{ padding: '5px 8px', fontSize: 13 }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-4 mt-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          <Field field={{ key: 'significant_findings', label: 'Significant findings', rows: 2 }}
            value={form.significant_findings} onChange={set} />
          <Field field={{ key: 'tentative_diagnosis', label: 'Tentative diagnosis', rows: 2 }}
            value={form.tentative_diagnosis} onChange={set} />
        </div>
      </Section>

      {/* ── 04 Laboratory finding and final diagnosis ── */}
      <Section n={4} title="Laboratory finding and final diagnosis">
        <div className="mb-4">
          <Field field={{ key: 'blood_smear', label: 'Blood smear' }}
            value={form.blood_smear} onChange={set} />
        </div>
        <div className="rounded-lg p-4 mb-5" style={{ background: 'var(--cream)' }}>
          <Grid cols={3}>
            {BLOOD_SMEAR.map(f => (
              <Field key={f.key} field={f} value={form[f.key]} onChange={set} />
            ))}
          </Grid>
        </div>
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {LABORATORY.map(f => (
            <Field key={f.key} field={f} value={form[f.key]} onChange={set} />
          ))}
        </div>
      </Section>

      {/* ── 05 Diagnosis, treatment and withdraw compliance ── */}
      <Section n={5} title="Diagnosis, treatment and withdraw compliance">
        <div className="mb-5">
          <Field field={{ key: 'final_diagnosis', label: 'Tentative/Final diagnosis', rows: 2 }}
            value={form.final_diagnosis} onChange={set} />
        </div>

        <Label>Prescription</Label>
        <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--ink-10)' }}>
          <table className="w-full border-collapse text-[13px]" style={{ minWidth: 480 }}>
            <thead>
              <tr>
                {['Drug / vaccine', 'Prescription (dose, dosage and route)', ''].map((h, i) => (
                  <th key={i}
                    className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-wider border-b"
                    style={{
                      color: 'var(--ink-60)', borderColor: 'var(--ink-10)',
                      background: 'var(--cream)', width: i === 0 ? '32%' : i === 1 ? '62%' : '6%',
                    }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {form.treatments.map((row, i) => (
                <tr key={i}>
                  <td className="px-3 py-1.5 border-b" style={{ borderColor: 'var(--ink-10)' }}>
                    <input type="text" className="w-full" value={row.drug}
                      onChange={e => setTreatment(i, 'drug', e.target.value)}
                      style={{ padding: '5px 8px', fontSize: 13 }} />
                  </td>
                  <td className="px-3 py-1.5 border-b" style={{ borderColor: 'var(--ink-10)' }}>
                    <input type="text" className="w-full" value={row.prescription}
                      onChange={e => setTreatment(i, 'prescription', e.target.value)}
                      placeholder="e.g. 500 ml IV slow, once"
                      style={{ padding: '5px 8px', fontSize: 13 }} />
                  </td>
                  <td className="px-2 py-1.5 border-b text-center" style={{ borderColor: 'var(--ink-10)' }}>
                    <button type="button" onClick={() => removeTreatment(i)}
                      title="Remove this line"
                      className="border-0 bg-transparent cursor-pointer px-1 hover:opacity-60"
                      style={{ color: 'var(--ink-30)', fontSize: 15 }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2 mb-5">
          <Btn size="sm" onClick={addTreatment}>+ Add line</Btn>
        </div>

        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          <Field field={{ key: 'recommendation', label: 'Recommendation', rows: 2 }}
            value={form.recommendation} onChange={set} />
          <div>
            <Label htmlFor="hr-milk_withdraw_date" hint="milk unfit for sale until this date">
              Milk withdraw end date
            </Label>
            <input id="hr-milk_withdraw_date" type="date" className="w-full"
              value={form.milk_withdraw_date ?? ''}
              onChange={e => set('milk_withdraw_date', e.target.value)} />
          </div>
        </div>
      </Section>

      {/* ── 06 Sign-off ── */}
      <Section n={6} title="Signed off by">
        <Grid cols={3}>
          <Field field={{ key: 'attending_vet', label: 'Attending veterinarian / paraveterinarian' }}
            value={form.attending_vet} onChange={set} />
          <Field field={{ key: 'license_number', label: 'Licence #' }}
            value={form.license_number} onChange={set} />
          <div>
            <Label htmlFor="hr-exam_date">Date</Label>
            <input id="hr-exam_date" type="date" className="w-full" value={form.exam_date ?? ''}
              onChange={e => set('exam_date', e.target.value)} />
          </div>
        </Grid>
      </Section>

      </div>

      {/* Outside the scrolling body, so it sits under the form rather than
          over it — and stays reachable without scrolling to the end of a
          sheet this long. A save that failed is reported here too, where
          the vet is looking when they press the button. */}
      <div className="shrink-0 px-7 py-4"
        style={{ background: 'var(--surface)', borderTop: '1px solid var(--ink-10)' }}>
        {error && (
          <div className="rounded-lg px-4 py-2.5 mb-3 text-sm" style={{ background: '#fff0f0', color: '#c0392b' }}>
            ⚠ {error}
          </div>
        )}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="text-[11px]" style={{ color: 'var(--ink-30)' }}>
            {cowName
              ? `Record for ${cowName}`
              : form.cow_tag
                ? `Record for tag ${form.cow_tag}`
                : 'Choose a cow, or write the ID/Tag no.'}
          </span>
          <div className="flex gap-2">
            <Btn onClick={onCancel}>Cancel</Btn>
            <Btn type="submit" variant="primary" disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Save record'}
            </Btn>
          </div>
        </div>
      </div>
    </form>
  )
}
