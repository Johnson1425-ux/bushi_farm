import { BASE, apiFetch } from './api'
import { authHeaders } from './session'

/**
 * Consume a Server-Sent Events response from an /api/ai endpoint.
 *
 * EventSource cannot send an Authorization header or issue a POST, so the
 * stream is read off fetch() and the SSE frames are parsed by hand.
 *
 * Handlers: onDelta(text), onTool({name, input}), onWarning({message}),
 *           onDone({reportId, model, usage}), onError({error})
 * Returns an abort function.
 */
/* The server writes a keep-alive line every 15 seconds while it works, so
   this long with nothing at all means the connection is gone even though the
   browser has not noticed. */
const STALL_MS = 60000

export function streamAi(path, body, handlers = {}) {
  const controller = new AbortController()
  let stalled = false
  let finished = false     // a done or error event has been delivered

  const run = async () => {
    let res
    try {
      /* Renewed before the stream opens rather than read from storage: a
         report can run for a minute or more, and starting one on a token
         that expires halfway through would drop the connection mid-answer.
         The token is only checked when the request is received, so a fresh
         one lasts the whole stream. */
      res = await fetch(BASE + path, {
        method: 'POST',
        signal: controller.signal,
        headers: await authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body || {}),
      })
    } catch (err) {
      if (err.name !== 'AbortError') handlers.onError?.({ error: 'Could not reach the server' })
      return
    }

    // Errors before the stream opens come back as ordinary JSON.
    if (!res.ok) {
      const e = await res.json().catch(() => ({}))
      handlers.onError?.({ error: e.error || `Request failed (${res.status})` })
      return
    }
    if (!res.body) {
      handlers.onError?.({ error: 'Streaming is not supported by this browser' })
      return
    }

    const reader  = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    const dispatch = (frame) => {
      let event = 'message'
      const dataLines = []
      for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim()
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart())
      }
      if (!dataLines.length) return

      let payload
      try { payload = JSON.parse(dataLines.join('\n')) } catch { return }

      switch (event) {
        case 'delta':   handlers.onDelta?.(payload.text || ''); break
        case 'tool':    handlers.onTool?.(payload); break
        case 'warning': handlers.onWarning?.(payload); break
        case 'done':    finished = true; handlers.onDone?.(payload); break
        case 'error':   finished = true; handlers.onError?.(payload); break
        default: break
      }
    }

    let watchdog
    const arm = () => {
      clearTimeout(watchdog)
      watchdog = setTimeout(() => { stalled = true; controller.abort() }, STALL_MS)
    }

    try {
      arm()
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        arm()
        buffer += decoder.decode(value, { stream: true })

        let split
        while ((split = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, split)
          buffer = buffer.slice(split + 2)
          if (frame.trim()) dispatch(frame)
        }
      }
      if (buffer.trim()) dispatch(buffer)
    } catch (err) {
      if (err.name !== 'AbortError' || stalled) {
        finished = true
        handlers.onError?.({
          error: stalled
            ? 'The server stopped responding. Try again, or ask a narrower question.'
            : 'The connection dropped while generating',
        })
      }
    } finally {
      clearTimeout(watchdog)
    }

    /* The stream closed without saying it was done — the host cut the
       function off, or a proxy closed the connection. Without this the page
       would sit in its busy state with nothing left to wake it. */
    if (!finished && !controller.signal.aborted) {
      handlers.onError?.({ error: 'The answer was cut off before it finished. Try again.' })
    }
  }

  run()
  return () => controller.abort()
}

/* ── plain JSON endpoints ────────────────────────────────── */

export const aiStatus       = ()            => apiFetch('/ai/status')
export const listAiReports  = (params = {}) => {
  const q = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ).toString()
  return apiFetch(`/ai/reports${q ? `?${q}` : ''}`)
}
export const getAiReport    = (id) => apiFetch(`/ai/reports/${id}`)
export const deleteAiReport = (id) => apiFetch(`/ai/reports/${id}`, { method: 'DELETE' })

/** Today's cached briefing, or null when none has been generated yet. */
export async function getBriefing() {
  try {
    return await apiFetch('/ai/briefing')
  } catch {
    return null
  }
}

/** Latest saved summary for a cow, or null. */
export async function getCowSummary(cowId) {
  try {
    return await apiFetch(`/ai/cows/${cowId}/summary`)
  } catch {
    return null
  }
}
