import React from 'react'
import { statusClass } from '../lib/api'

export function Btn({ children, variant = 'default', size = 'md', onClick, className = '', disabled }) {
  const base = [
    'inline-flex items-center justify-center font-medium rounded-lg border transition-all duration-150 cursor-pointer',
    size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm',
    disabled ? 'opacity-50 cursor-not-allowed' : '',
    variant === 'primary'
      ? 'bg-green-600 border-green-600 text-white hover:bg-green-800 hover:border-green-800'
      : variant === 'danger'
      ? 'border-red text-red hover:opacity-80'
      : 'border-ink-10 text-ink hover:bg-cream-dark',
    className,
  ].filter(Boolean).join(' ')

  return (
    <button className={base} style={{ background: variant === 'danger' ? 'transparent' : variant === 'default' ? 'var(--surface)' : undefined }} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}

export function Card({ children, className = '', noPad, style = {} }) {
  return (
    <div
      className={`rounded-lg border border-ink-10 ${noPad ? '' : 'p-6'} ${className}`}
      style={{ background: 'var(--surface)', marginBottom: 20, ...style }}
    >
      {children}
    </div>
  )
}

export function CardTitle({ children, className = '' }) {
  return (
    <div className={`text-sm font-semibold mb-4 flex items-center justify-between gap-3 ${className}`} style={{ color: 'var(--ink)' }}>
      {children}
    </div>
  )
}

export function MetricCard({ label, value, unit, note, accent }) {
  return (
    <div
      className="rounded-lg border"
      style={{
        padding: '20px 20px 16px',
        background: accent ? 'var(--green-900)' : 'var(--surface)',
        borderColor: accent ? 'var(--green-900)' : 'var(--ink-10)',
      }}
    >
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.6px', color: accent ? 'rgba(255,255,255,.5)' : 'var(--ink-60)', fontWeight: 500 }}>
        {label}
      </div>
      <div style={{ fontSize: 30, fontWeight: 600, color: accent ? '#fff' : 'var(--ink)', lineHeight: 1.1, margin: '6px 0 2px' }}>
        {value}
      </div>
      {unit && <div style={{ fontSize: 13, fontWeight: 300, color: accent ? 'rgba(255,255,255,.6)' : 'var(--ink-60)' }}>{unit}</div>}
      {note && <div style={{ fontSize: 11, color: accent ? 'rgba(255,255,255,.35)' : 'var(--ink-30)', marginTop: 4 }}>{note}</div>}
    </div>
  )
}

export function Badge({ cls }) {
  const styles = {
    high: { background: 'var(--green-100)', color: 'var(--green-800)' },
    mid:  { background: 'rgba(232,160,32,0.15)', color: 'var(--amber)' },
    low:  { background: 'rgba(217,64,64,0.1)',   color: 'var(--red)' },
  }
  const label = cls ? cls.charAt(0).toUpperCase() + cls.slice(1) : 'Mid'
  return (
    <span
      className="inline-block text-[11px] font-medium px-2.5 py-0.5 rounded-full"
      style={styles[cls] || styles.mid}
    >
      {label}
    </span>
  )
}

export function InlineBar({ litres, overall }) {
  const cls      = statusClass(litres, overall)
  const pct      = Math.min(100, Math.round((litres / (overall * 1.6 || 1)) * 100))
  const diff     = litres - overall
  const barColor = cls === 'high' ? 'var(--green-400)' : cls === 'low' ? 'var(--red)' : 'var(--amber)'

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden min-w-[80px]" style={{ background: 'var(--ink-10)' }}>
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: barColor }} />
      </div>
      <span className="text-[11px] min-w-[48px]" style={{ color: 'var(--ink-60)' }}>
        {(diff >= 0 ? '+' : '') + diff.toFixed(1)} L
      </span>
    </div>
  )
}

export function PageHeader({ title, sub, children }) {
  return (
    <div className="flex items-start justify-between mb-7 flex-wrap gap-3">
      <div>
        <h1 className="font-serif text-[28px] leading-tight" style={{ color: 'var(--ink)' }}>{title}</h1>
        {sub && <p className="text-sm mt-1 font-light" style={{ color: 'var(--ink-60)' }}>{sub}</p>}
      </div>
      {children && <div className="flex gap-2 flex-wrap">{children}</div>}
    </div>
  )
}

export function EmptyState({ children }) {
  return (
    <div className="text-center py-12 px-5 text-sm" style={{ color: 'var(--ink-60)' }}>
      {children}
    </div>
  )
}

export function Spinner() {
  return (
    <span
      className="inline-block w-3.5 h-3.5 rounded-full border-2 align-middle mr-1.5"
      style={{ borderColor: 'var(--ink-10)', borderTopColor: 'var(--green-400)', animation: 'spin .7s linear infinite' }}
    />
  )
}