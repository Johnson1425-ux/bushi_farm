import { BASE, apiFetch } from './api'

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
export function streamAi(path, body, handlers = {}) {
  const controller = new AbortController()
  const token = localStorage.getItem('mt_token')

  const run = async () => {
    let res
    try {
      res = await fetch(BASE + path, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
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
        case 'done':    handlers.onDone?.(payload); break
        case 'error':   handlers.onError?.(payload); break
        default: break
      }
    }

    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
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
      if (err.name !== 'AbortError') {
        handlers.onError?.({ error: 'The connection dropped while generating' })
      }
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
