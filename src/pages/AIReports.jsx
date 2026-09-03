import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../lib/AuthContext'
import { Card, CardTitle, Btn, PageHeader, EmptyState, Spinner } from '../components/ui'
import Markdown from '../components/Markdown'
import {
  streamAi, aiStatus, listAiReports, getAiReport, deleteAiReport, getCowSummary,
} from '../lib/aiApi'

/* ── date helpers ────────────────────────────────────────── */

const iso = (d) => d.toISOString().slice(0, 10)
const today = () => iso(new Date())
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d) }

const PRESETS = [
  { label: 'Last 7 days',  from: () => daysAgo(6),  to: today },
  { label: 'Last 30 days', from: () => daysAgo(29), to: today },
  {
    label: 'This month',
    from: () => { const d = new Date(); return iso(new Date(d.getFullYear(), d.getMonth(), 1)) },
    to: today,
  },
  {
    label: 'Last month',
    from: () => { const d = new Date(); return iso(new Date(d.getFullYear(), d.getMonth() - 1, 1)) },
    to:   () => { const d = new Date(); return iso(new Date(d.getFullYear(), d.getMonth(), 0)) },
  },
]

const TABS = [
  { id: 'report',  label: 'Period report' },
  { id: 'ask',     label: 'Ask the data' },
  { id: 'cow',     label: 'Cow summary' },
  { id: 'history', label: 'Saved reports' },
]

/* ── shared bits ─────────────────────────────────────────── */

function Notice({ kind = 'error', children }) {
  const styles = {
    error: { background: 'rgba(217,64,64,0.1)',  color: 'var(--red)' },
    warn:  { background: 'rgba(232,160,32,0.15)', color: 'var(--amber)' },
    info:  { background: 'var(--cream-dark)',     color: 'var(--ink-60)' },
  }
  return (
    <div className="rounded-lg px-4 py-3 text-[13px] mb-4" style={styles[kind]}>
      {children}
    </div>
  )
}

/** Blinking caret shown at the end of text that is still streaming in. */
function Caret() {
  return (
    <span
      className="inline-block w-[7px] h-[15px] align-text-bottom ml-0.5"
      style={{ background: 'var(--green-400)', animation: 'blink 1s steps(1) infinite' }}
    />
  )
}

function downloadMarkdown(filename, content) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function ResultActions({ content, filename }) {
  const [copied, setCopied] = useState(false)
  if (!content) return null
  return (
    <div className="flex gap-2">
      <Btn
        size="sm"
        onClick={() => {
          navigator.clipboard?.writeText(content)
          setCopied(true)
          setTimeout(() => setCopied(false), 1600)
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </Btn>
      <Btn size="sm" onClick={() => downloadMarkdown(filename, content)}>Download</Btn>
    </div>
  )
}

/* ══════════════════════════════════
   TAB — PERIOD REPORT
══════════════════════════════════ */

function PeriodReportTab({ canGenerate, onSaved }) {
  const [from, setFrom]   = useState(daysAgo(29))
  const [to, setTo]       = useState(today())
  const [focus, setFocus] = useState('')
  const [text, setText]   = useState('')
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState('')
  const [warn, setWarn]   = useState('')
  const abortRef = useRef(null)

  useEffect(() => () => abortRef.current?.(), [])

  const generate = () => {
    setText(''); setError(''); setWarn(''); setBusy(true)
    abortRef.current = streamAi('/ai/reports/period', { from, to, focus }, {
      onDelta:   (t) => setText(prev => prev + t),
      onWarning: (w) => setWarn(w.message),
      onError:   (e) => { setError(e.error); setBusy(false) },
      onDone:    () => { setBusy(false); onSaved?.() },
    })
  }

  return (
    <>
      <Card>
        <CardTitle>Generate a report</CardTitle>

        <div className="flex flex-wrap gap-2 mb-4">
          {PRESETS.map(p => (
            <Btn
              key={p.label}
              size="sm"
              disabled={busy}
              onClick={() => { setFrom(p.from()); setTo(p.to()) }}
            >
              {p.label}
            </Btn>
          ))}
        </div>

        <div className="flex flex-wrap gap-4 items-end">
          <label className="text-[12px]" style={{ color: 'var(--ink-60)' }}>
            <div className="mb-1">From</div>
            <input
              type="date" value={from} disabled={busy}
              onChange={e => setFrom(e.target.value)}
              className="px-3 py-2 rounded-lg border text-[13px]"
              style={{ borderColor: 'var(--ink-10)', background: 'var(--surface)', color: 'var(--ink)' }}
            />
          </label>
          <label className="text-[12px]" style={{ color: 'var(--ink-60)' }}>
            <div className="mb-1">To</div>
            <input
              type="date" value={to} disabled={busy}
              onChange={e => setTo(e.target.value)}
              className="px-3 py-2 rounded-lg border text-[13px]"
              style={{ borderColor: 'var(--ink-10)', background: 'var(--surface)', color: 'var(--ink)' }}
            />
          </label>
          <label className="text-[12px] flex-1 min-w-[220px]" style={{ color: 'var(--ink-60)' }}>
            <div className="mb-1">Anything specific to focus on? (optional)</div>
            <input
              type="text" value={focus} disabled={busy}
              placeholder="e.g. why did output drop in week 3"
              onChange={e => setFocus(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-[13px]"
              style={{ borderColor: 'var(--ink-10)', background: 'var(--surface)', color: 'var(--ink)' }}
            />
          </label>
          <Btn variant="primary" onClick={generate} disabled={busy || !canGenerate}>
            {busy ? <><Spinner />Writing…</> : 'Generate report'}
          </Btn>
        </div>

        {!canGenerate && (
          <div className="text-[12px] mt-3" style={{ color: 'var(--ink-60)' }}>
            Your role can read saved reports but not generate new ones.
          </div>
        )}
      </Card>

      {error && <Notice>{error}</Notice>}
      {warn  && <Notice kind="warn">{warn}</Notice>}

      {(text || busy) && (
        <Card>
          <CardTitle>
            <span>Farm report — {from} to {to}</span>
            {!busy && <ResultActions content={text} filename={`milktrack-report-${from}_${to}.md`} />}
          </CardTitle>
          <Markdown text={text} />
          {busy && <Caret />}
        </Card>
      )}
    </>
  )
}

/* ══════════════════════════════════
   TAB — ASK THE DATA
══════════════════════════════════ */

const TOOL_LABELS = {
  list_cows:       'Looking up the herd',
  get_farm_data:   'Pulling farm data',
  get_cow_dossier: 'Reading a cow\'s record',
  get_alerts:      'Checking current alerts',
}

const SUGGESTIONS = [
  'Which cows dropped output the most this month?',
  'How much milk did we sell last week, and what did it earn?',
  'Which cows are due to calve in the next month?',
  'What are we running low on?',
]

function AskTab() {
  const [messages, setMessages] = useState([])   // {role, content}
  const [input, setInput]       = useState('')
  const [busy, setBusy]         = useState(false)
  const [tool, setTool]         = useState('')
  const [error, setError]       = useState('')
  const abortRef = useRef(null)
  const bottomRef = useRef(null)

  useEffect(() => () => abortRef.current?.(), [])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, tool])

  const ask = (question) => {
    const q = (question ?? input).trim()
    if (!q || busy) return

    // History sent to the server is the conversation *before* this question.
    const history = messages.map(m => ({ role: m.role, content: m.content }))

    setMessages(prev => [...prev, { role: 'user', content: q }, { role: 'assistant', content: '' }])
    setInput(''); setError(''); setTool(''); setBusy(true)

    const appendToLast = (t) => setMessages(prev => {
      const next = [...prev]
      next[next.length - 1] = { ...next[next.length - 1], content: next[next.length - 1].content + t }
      return next
    })

    abortRef.current = streamAi('/ai/chat', { message: q, history }, {
      onDelta: (t) => { setTool(''); appendToLast(t) },
      onTool:  (c) => setTool(TOOL_LABELS[c.name] || `Running ${c.name}`),
      onError: (e) => { setError(e.error); setTool(''); setBusy(false) },
      onDone:  () => { setTool(''); setBusy(false) },
    })
  }

  return (
    <Card>
      <CardTitle>
        <span>Ask about the farm</span>
        {messages.length > 0 && (
          <Btn size="sm" onClick={() => { abortRef.current?.(); setMessages([]); setBusy(false); setError('') }}>
            Clear
          </Btn>
        )}
      </CardTitle>

      {messages.length === 0 ? (
        <div className="py-6">
          <div className="text-[13px] mb-4" style={{ color: 'var(--ink-60)' }}>
            Ask a question in plain English. Answers come from your live records, not from
            anything the model was trained on.
          </div>
          <div className="flex flex-col gap-2 items-start">
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                onClick={() => ask(s)}
                className="text-left text-[13px] px-3 py-2 rounded-lg border-0 cursor-pointer transition-colors duration-150 hover:opacity-75"
                style={{ background: 'var(--cream-dark)', color: 'var(--ink)' }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="max-h-[55vh] overflow-y-auto pr-1 mb-4">
          {messages.map((m, i) => (
            <div key={i} className="mb-4">
              {m.role === 'user' ? (
                <div className="flex justify-end">
                  <div
                    className="rounded-lg px-3.5 py-2 text-[13.5px] max-w-[80%]"
                    style={{ background: 'var(--green-600)', color: '#fff' }}
                  >
                    {m.content}
                  </div>
                </div>
              ) : (
                <div style={{ color: 'var(--ink)' }}>
                  <Markdown text={m.content} />
                  {busy && i === messages.length - 1 && !m.content && !tool && <Caret />}
                </div>
              )}
            </div>
          ))}
          {tool && (
            <div className="text-[12px] flex items-center gap-1.5" style={{ color: 'var(--ink-60)' }}>
              <Spinner />{tool}…
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {error && <Notice>{error}</Notice>}

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          disabled={busy}
          placeholder="e.g. which cows were treated last month?"
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') ask() }}
          className="flex-1 px-3 py-2 rounded-lg border text-[13.5px]"
          style={{ borderColor: 'var(--ink-10)', background: 'var(--surface)', color: 'var(--ink)' }}
        />
        <Btn variant="primary" onClick={() => ask()} disabled={busy || !input.trim()}>
          {busy ? <Spinner /> : 'Ask'}
        </Btn>
      </div>
    </Card>
  )
}

/* ══════════════════════════════════
   TAB — COW SUMMARY
══════════════════════════════════ */

function CowSummaryTab({ cows, canGenerate, onSaved }) {
  const [cowId, setCowId]   = useState('')
  const [text, setText]     = useState('')
  const [saved, setSaved]   = useState(null)
  const [busy, setBusy]     = useState(false)
  const [error, setError]   = useState('')
  const abortRef = useRef(null)

  useEffect(() => () => abortRef.current?.(), [])

  // Show the most recent saved summary as soon as a cow is picked.
  useEffect(() => {
    setText(''); setSaved(null); setError('')
    if (!cowId) return
    let stale = false
    getCowSummary(cowId).then(r => { if (!stale) setSaved(r) })
    return () => { stale = true }
  }, [cowId])

  const cow = cows.find(c => String(c.id) === String(cowId))

  const generate = () => {
    setText(''); setSaved(null); setError(''); setBusy(true)
    abortRef.current = streamAi(`/ai/cows/${cowId}/summary`, {}, {
      onDelta: (t) => setText(prev => prev + t),
      onError: (e) => { setError(e.error); setBusy(false) },
      onDone:  () => { setBusy(false); onSaved?.() },
    })
  }

  const shown = text || saved?.content || ''

  return (
    <>
      <Card>
        <CardTitle>Summarise one cow</CardTitle>
        <div className="flex flex-wrap gap-3 items-end">
          <label className="text-[12px]" style={{ color: 'var(--ink-60)' }}>
            <div className="mb-1">Cow</div>
            <select
              value={cowId}
              disabled={busy}
              onChange={e => setCowId(e.target.value)}
              className="px-3 py-2 rounded-lg border text-[13px] min-w-[200px]"
              style={{ borderColor: 'var(--ink-10)', background: 'var(--surface)', color: 'var(--ink)' }}
            >
              <option value="">Select a cow…</option>
              {cows.map(c => (
                <option key={c.id} value={c.id}>{c.name}{c.tag ? ` (${c.tag})` : ''}</option>
              ))}
            </select>
          </label>
          <Btn variant="primary" onClick={generate} disabled={busy || !cowId || !canGenerate}>
            {busy ? <><Spinner />Writing…</> : saved ? 'Regenerate' : 'Generate summary'}
          </Btn>
        </div>
        {saved && !text && !busy && (
          <div className="text-[12px] mt-3" style={{ color: 'var(--ink-30)' }}>
            Showing the summary saved on {new Date(saved.created_at).toLocaleString()}.
          </div>
        )}
      </Card>

      {error && <Notice>{error}</Notice>}

      {(shown || busy) && (
        <Card>
          <CardTitle>
            <span>{cow?.name || 'Cow'} — health summary</span>
            {!busy && <ResultActions content={shown} filename={`${cow?.name || 'cow'}-summary.md`} />}
          </CardTitle>
          <Markdown text={shown} />
          {busy && <Caret />}
        </Card>
      )}
    </>
  )
}

/* ══════════════════════════════════
   TAB — SAVED REPORTS
══════════════════════════════════ */

const KIND_LABELS = {
  period:      'Period report',
  briefing:    'Daily briefing',
  cow_summary: 'Cow summary',
}

function HistoryTab({ reports, loading, reload }) {
  const { user } = useAuth()
  const [open, setOpen]   = useState(null)
  const [error, setError] = useState('')

  const view = async (id) => {
    setError('')
    try { setOpen(await getAiReport(id)) }
    catch (e) { setError(e.message) }
  }

  const remove = async (id) => {
    setError('')
    try {
      await deleteAiReport(id)
      if (open?.id === id) setOpen(null)
      reload()
    } catch (e) { setError(e.message) }
  }

  if (loading) return <Card><EmptyState><Spinner />Loading…</EmptyState></Card>

  return (
    <>
      {error && <Notice>{error}</Notice>}

      <Card>
        <CardTitle>Saved reports</CardTitle>
        {reports.length === 0 ? (
          <EmptyState>Nothing saved yet. Generated reports are kept here automatically.</EmptyState>
        ) : (
          <div className="flex flex-col">
            {reports.map(r => (
              <div
                key={r.id}
                className="flex items-center gap-3 py-3"
                style={{ borderBottom: '1px solid var(--ink-10)' }}
              >
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => view(r.id)}
                    className="text-left text-[13.5px] font-medium border-0 bg-transparent p-0 cursor-pointer hover:underline"
                    style={{ color: 'var(--ink)' }}
                  >
                    {r.title}
                  </button>
                  <div className="text-[11px] mt-0.5" style={{ color: 'var(--ink-30)' }}>
                    {KIND_LABELS[r.kind] || r.kind}
                    {' · '}{new Date(r.created_at).toLocaleString()}
                    {r.generated_by ? ` · ${r.generated_by}` : ''}
                  </div>
                </div>
                {user?.role === 'admin' && (
                  <Btn size="sm" variant="danger" onClick={() => remove(r.id)}>Delete</Btn>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {open && (
        <Card>
          <CardTitle>
            <span>{open.title}</span>
            <div className="flex gap-2">
              <ResultActions content={open.content} filename={`report-${open.id}.md`} />
              <Btn size="sm" onClick={() => setOpen(null)}>Close</Btn>
            </div>
          </CardTitle>
          <Markdown text={open.content} />
        </Card>
      )}
    </>
  )
}

/* ══════════════════════════════════
   PAGE
══════════════════════════════════ */

export default function AIReports({ cows = [] }) {
  const [tab, setTab]           = useState('report')
  const [status, setStatus]     = useState(null)
  const [reports, setReports]   = useState([])
  const [loadingReports, setLoadingReports] = useState(true)

  const loadReports = useCallback(() => {
    setLoadingReports(true)
    listAiReports({ limit: 100 })
      .then(setReports)
      .catch(() => setReports([]))
      .finally(() => setLoadingReports(false))
  }, [])

  useEffect(() => {
    aiStatus().then(setStatus).catch(() => setStatus({ configured: false, can_generate: false }))
    loadReports()
  }, [loadReports])

  const canGenerate = Boolean(status?.configured && status?.can_generate)

  return (
    <>
      <PageHeader
        title="AI Reports"
        sub="Written from your live farm records by Claude"
      />

      {status && !status.configured && (
        <Notice kind="warn">
          AI features are not configured yet. Add <code>ANTHROPIC_API_KEY</code> to the backend
          <code> .env</code> file and restart the server.
        </Notice>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-5 flex-wrap">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => t.id === 'history' ? (loadReports(), setTab(t.id)) : setTab(t.id)}
            className={[
              'px-4 py-2 rounded-lg text-[13px] border-0 cursor-pointer transition-all duration-150',
              tab === t.id ? 'font-medium' : '',
            ].join(' ')}
            style={
              tab === t.id
                ? { background: 'var(--green-600)', color: '#fff' }
                : { background: 'var(--surface)', color: 'var(--ink-60)' }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'report'  && <PeriodReportTab canGenerate={canGenerate} onSaved={loadReports} />}
      {tab === 'ask'     && <AskTab />}
      {tab === 'cow'     && <CowSummaryTab cows={cows} canGenerate={canGenerate} onSaved={loadReports} />}
      {tab === 'history' && <HistoryTab reports={reports} loading={loadingReports} reload={loadReports} />}
    </>
  )
}
