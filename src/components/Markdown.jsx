import React from 'react'

/**
 * Small Markdown renderer for AI-generated reports.
 *
 * Deliberately narrow: it handles the subset the report prompts actually
 * produce — headings, paragraphs, bullet and numbered lists, tables, rules,
 * and inline bold / italic / code. Everything is built as React elements, so
 * there is no dangerouslySetInnerHTML and no HTML injection path.
 */

/* ── inline: **bold**, *italic*, _italic_, `code` ─────────── */

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*|_[^_\n]+_)/g

function renderInline(text, keyPrefix = 'i') {
  if (!text) return null
  return text.split(INLINE).filter(Boolean).map((part, i) => {
    const key = `${keyPrefix}-${i}`
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={key} style={{ fontWeight: 600 }}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={key}
          className="text-[12.5px] px-1 py-0.5 rounded"
          style={{ background: 'var(--cream-dark)', fontFamily: 'var(--font-mono)' }}
        >
          {part.slice(1, -1)}
        </code>
      )
    }
    if ((part.startsWith('*') && part.endsWith('*') && part.length > 2) ||
        (part.startsWith('_') && part.endsWith('_') && part.length > 2)) {
      return <em key={key}>{part.slice(1, -1)}</em>
    }
    return <span key={key}>{part}</span>
  })
}

/* ── tables ──────────────────────────────────────────────── */

const isTableRow  = (l) => l.trim().startsWith('|') && l.trim().endsWith('|')
const isDivider   = (l) => /^\|[\s:|-]+\|$/.test(l.trim())
const splitCells  = (l) => l.trim().slice(1, -1).split('|').map(c => c.trim())

function Table({ rows, keyPrefix }) {
  const [head, ...body] = rows
  return (
    // Wide tables scroll inside their own box rather than pushing the page sideways.
    <div className="overflow-x-auto my-4" key={keyPrefix}>
      <table className="w-full text-[13px] border-collapse">
        <thead>
          <tr>
            {head.map((c, i) => (
              <th
                key={i}
                className="text-left font-semibold px-3 py-2 whitespace-nowrap"
                style={{ borderBottom: '1px solid var(--ink-10)', color: 'var(--ink-60)' }}
              >
                {renderInline(c, `${keyPrefix}-h${i}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, r) => (
            <tr key={r}>
              {row.map((c, i) => (
                <td
                  key={i}
                  className="px-3 py-2 align-top"
                  style={{ borderBottom: '1px solid var(--ink-10)', color: 'var(--ink)' }}
                >
                  {renderInline(c, `${keyPrefix}-c${r}-${i}`)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ── block parser ────────────────────────────────────────── */

export default function Markdown({ text = '', className = '' }) {
  const lines  = String(text).replace(/\r\n/g, '\n').split('\n')
  const blocks = []
  let i = 0

  const flushParagraph = (buf, key) => {
    if (!buf.length) return
    blocks.push(
      <p key={key} className="text-[14px] leading-[1.7] my-3" style={{ color: 'var(--ink)' }}>
        {renderInline(buf.join(' '), key)}
      </p>
    )
  }

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) { i++; continue }

    // Horizontal rule
    if (/^(-{3,}|_{3,}|\*{3,})$/.test(trimmed)) {
      blocks.push(<hr key={`hr-${i}`} className="my-5" style={{ borderColor: 'var(--ink-10)' }} />)
      i++
      continue
    }

    // Headings
    const heading = trimmed.match(/^(#{1,4})\s+(.*)$/)
    if (heading) {
      const level = heading[1].length
      const body  = heading[2]
      const key   = `h-${i}`
      if (level <= 2) {
        blocks.push(
          <h2
            key={key}
            className="font-serif text-[19px] mt-7 mb-2 first:mt-0"
            style={{ color: 'var(--ink)' }}
          >
            {renderInline(body, key)}
          </h2>
        )
      } else {
        blocks.push(
          <h3
            key={key}
            className="text-[13px] font-semibold uppercase tracking-wider mt-5 mb-1.5"
            style={{ color: 'var(--ink-60)' }}
          >
            {renderInline(body, key)}
          </h3>
        )
      }
      i++
      continue
    }

    // Table
    if (isTableRow(line) && isTableRow(lines[i + 1] || '') && isDivider(lines[i + 1])) {
      const rows = [splitCells(line)]
      i += 2
      while (i < lines.length && isTableRow(lines[i])) {
        rows.push(splitCells(lines[i]))
        i++
      }
      blocks.push(<Table key={`t-${i}`} keyPrefix={`t-${i}`} rows={rows} />)
      continue
    }

    // Lists — a run of consecutive bullet or numbered items
    if (/^[-*+]\s+/.test(trimmed) || /^\d+[.)]\s+/.test(trimmed)) {
      const ordered = /^\d+[.)]\s+/.test(trimmed)
      const items = []
      while (i < lines.length) {
        const t = lines[i].trim()
        const m = ordered ? t.match(/^\d+[.)]\s+(.*)$/) : t.match(/^[-*+]\s+(.*)$/)
        if (!m) break
        items.push(m[1])
        i++
        // Fold wrapped continuation lines into the item above.
        while (
          i < lines.length &&
          lines[i].trim() &&
          !/^[-*+]\s+/.test(lines[i].trim()) &&
          !/^\d+[.)]\s+/.test(lines[i].trim()) &&
          !/^#{1,4}\s/.test(lines[i].trim()) &&
          !isTableRow(lines[i])
        ) {
          items[items.length - 1] += ' ' + lines[i].trim()
          i++
        }
      }
      const Tag = ordered ? 'ol' : 'ul'
      blocks.push(
        <Tag
          key={`l-${i}`}
          className={`my-3 pl-5 space-y-1.5 ${ordered ? 'list-decimal' : 'list-disc'}`}
          style={{ color: 'var(--ink)' }}
        >
          {items.map((item, n) => (
            <li key={n} className="text-[14px] leading-[1.65] pl-1">
              {renderInline(item, `l-${i}-${n}`)}
            </li>
          ))}
        </Tag>
      )
      continue
    }

    // Paragraph — accumulate until a blank line or a new block starts
    const buf = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^#{1,4}\s/.test(lines[i].trim()) &&
      !/^[-*+]\s+/.test(lines[i].trim()) &&
      !/^\d+[.)]\s+/.test(lines[i].trim()) &&
      !isTableRow(lines[i]) &&
      !/^(-{3,}|_{3,}|\*{3,})$/.test(lines[i].trim())
    ) {
      buf.push(lines[i].trim())
      i++
    }
    flushParagraph(buf, `p-${i}`)
  }

  return <div className={className}>{blocks}</div>
}
