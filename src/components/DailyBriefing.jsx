import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../lib/AuthContext'
import { Card, CardTitle, Btn, Spinner } from './ui'
import Markdown from './Markdown'
import { getBriefing, aiStatus, streamAi } from '../lib/aiApi'

const CAN_GENERATE = ['admin', 'manager', 'veteran']

/**
 * Today's AI briefing on the dashboard.
 *
 * Renders nothing at all until we know AI is configured, so farms that have
 * not set an API key never see a broken panel. Once generated, the briefing is
 * cached server-side for the day — reopening the dashboard costs no tokens.
 */
export default function DailyBriefing() {
  const { user } = useAuth()
  const [configured, setConfigured] = useState(null)
  const [briefing, setBriefing]     = useState(null)
  const [text, setText]             = useState('')
  const [busy, setBusy]             = useState(false)
  const [error, setError]           = useState('')
  const abortRef = useRef(null)

  const canGenerate = CAN_GENERATE.includes(user?.role)

  useEffect(() => {
    let stale = false
    aiStatus()
      .then(s => {
        if (stale) return
        setConfigured(s.configured)
        if (s.configured) getBriefing().then(b => { if (!stale) setBriefing(b) })
      })
      .catch(() => { if (!stale) setConfigured(false) })
    return () => { stale = true; abortRef.current?.() }
  }, [])

  if (configured !== true) return null

  const generate = () => {
    setText(''); setError(''); setBusy(true); setBriefing(null)
    abortRef.current = streamAi('/ai/briefing', {}, {
      onDelta: (t) => setText(prev => prev + t),
      onError: (e) => { setError(e.error); setBusy(false) },
      onDone:  () => setBusy(false),
    })
  }

  const shown = text || briefing?.content || ''

  return (
    <Card>
      <CardTitle>
        <span>✨ Today's briefing</span>
        {canGenerate && (
          <Btn size="sm" onClick={generate} disabled={busy}>
            {busy ? <><Spinner />Writing…</> : shown ? 'Refresh' : 'Generate'}
          </Btn>
        )}
      </CardTitle>

      {error && (
        <div
          className="rounded-lg px-4 py-3 text-[13px]"
          style={{ background: 'rgba(217,64,64,0.1)', color: 'var(--red)' }}
        >
          {error}
        </div>
      )}

      {!shown && !busy && !error && (
        <div className="text-[13px] py-2" style={{ color: 'var(--ink-60)' }}>
          {canGenerate
            ? 'No briefing yet today. Generate one to see what needs attention.'
            : 'No briefing has been generated today.'}
        </div>
      )}

      {shown && <Markdown text={shown} />}

      {busy && !shown && (
        <div className="text-[13px] flex items-center gap-1.5 py-2" style={{ color: 'var(--ink-60)' }}>
          <Spinner />Reading today's records…
        </div>
      )}

      {briefing && !text && !busy && (
        <div className="text-[11px] mt-3" style={{ color: 'var(--ink-30)' }}>
          Generated {new Date(briefing.created_at).toLocaleTimeString()}
        </div>
      )}
    </Card>
  )
}
