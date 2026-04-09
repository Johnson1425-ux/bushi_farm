import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTheme } from "../lib/ThemeContext"

const features = [
  { icon: "🐄", title: "Cow Management",      desc: "Track every cow — health records, lactation cycles, and production history in one place." },
  { icon: "📊", title: "Production Analytics", desc: "Visual charts and trends to understand your farm's performance at a glance." },
  { icon: "📋", title: "Daily Records",        desc: "Log morning and evening milk sessions quickly, with Excel import for bulk data." },
  { icon: "📈", title: "Smart Reports",        desc: "Export detailed reports to PDF or Excel for your records or veterinary visits." },
]

export default function LandingPage() {
  const navigate      = useNavigate()
  const { dark, toggle } = useTheme()
  const [stats, setStats] = useState(null)

  useEffect(() => {
    fetch('/api/public/stats')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setStats(d) })
      .catch(() => {})
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', color: 'var(--ink)', fontFamily: "'Outfit', sans-serif", overflowX: 'hidden' }}>

      {/* ── Navbar ── */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, backdropFilter: 'blur(12px)', background: 'var(--cream)', borderBottom: '1px solid var(--ink-10)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 22 }}>🐄</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--green-600)', letterSpacing: '-0.5px' }}>MilkTrack</span>
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Dark mode toggle */}
            <button
              onClick={toggle}
              title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
              style={{
                background: 'var(--cream-dark)', border: '1.5px solid var(--ink-10)',
                borderRadius: 8, width: 36, height: 36, display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer', fontSize: 16, transition: 'all 0.2s',
              }}
            >
              {dark ? '☀' : '☾'}
            </button>
            <button
              onClick={() => navigate('/login')}
              style={{
                background: 'transparent', border: '1.5px solid var(--green-600)',
                color: 'var(--green-600)', padding: '7px 18px', borderRadius: 8,
                fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--green-600)'; e.currentTarget.style.color = '#fff' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--green-600)' }}
            >
              Sign In
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ maxWidth: 900, margin: '0 auto', padding: '80px 24px 60px', textAlign: 'center' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'var(--green-50)', color: 'var(--green-600)',
          padding: '6px 14px', borderRadius: 100, fontSize: 13, fontWeight: 600,
          marginBottom: 28, border: '1px solid var(--green-100)',
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green-400)', display: 'inline-block' }} />
          Farm management made simple
        </div>

        <h1 style={{
          fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: 800, lineHeight: 1.1,
          marginBottom: 20, color: 'var(--ink)', letterSpacing: '-1.5px',
        }}>
          Know your farm.<br />
          <span style={{ color: 'var(--green-600)' }}>Grow your yield.</span>
        </h1>

        <p style={{ fontSize: 18, color: 'var(--ink-60)', maxWidth: 540, margin: '0 auto 36px', lineHeight: 1.65 }}>
          MilkTrack gives dairy farmers a complete picture — from daily milk logs to herd analytics — so every decision is backed by real data.
        </p>

        <button
          onClick={() => navigate('/login')}
          style={{
            background: 'var(--green-600)', color: '#fff', border: 'none',
            padding: '14px 32px', borderRadius: 10, fontSize: 16, fontWeight: 700,
            cursor: 'pointer', marginBottom: 52, transition: 'all 0.2s',
            boxShadow: '0 4px 15px rgba(42,138,86,0.3)',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--green-800)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--green-600)'; e.currentTarget.style.transform = 'translateY(0)' }}
        >
          Get Started →
        </button>

        {/* ── Live stats card ── */}
        <div style={{
          background: 'var(--surface)', borderRadius: 16,
          border: '1px solid var(--ink-10)', padding: 24,
          boxShadow: '0 20px 60px rgba(0,0,0,0.07)',
          maxWidth: 560, margin: '0 auto',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Farm at a Glance</span>
            <span style={{ fontSize: 12, color: 'var(--ink-30)' }}>
              {stats ? 'Live data' : 'Loading…'}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total Cows',    value: stats ? stats.total_cows        : '—' },
              { label: 'Avg / Cow',     value: stats ? parseFloat(stats.overall_avg).toFixed(1) + ' L' : '—' },
              { label: 'Days Tracked',  value: stats ? stats.days_tracked      : '—' },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--green-50)', borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--ink-60)', fontWeight: 500, marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)' }}>{s.value}</div>
              </div>
            ))}
          </div>
          {/* Total litres full-width */}
          <div style={{ background: 'var(--green-900)', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 500, marginBottom: 2 }}>Total Milk Collected</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#fff' }}>
                {stats
                  ? parseFloat(stats.total_litres) >= 1000
                    ? (parseFloat(stats.total_litres) / 1000).toFixed(1) + 'k L'
                    : parseFloat(stats.total_litres).toFixed(0) + ' L'
                  : '—'
                }
              </div>
            </div>
            <span style={{ fontSize: 36 }}>🥛</span>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '60px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--green-600)', marginBottom: 10 }}>
          What you get
        </p>
        <h2 style={{ fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 800, letterSpacing: '-1px', color: 'var(--ink)', marginBottom: 44 }}>
          Everything your farm needs
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, textAlign: 'left' }}>
          {features.map(f => (
            <div
              key={f.title}
              style={{
                background: 'var(--surface)', border: '1.5px solid var(--ink-10)',
                borderRadius: 14, padding: 24, transition: 'all 0.25s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--green-400)'; e.currentTarget.style.transform = 'translateY(-4px)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--ink-10)'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              <span style={{ fontSize: 28, display: 'block', marginBottom: 14 }}>{f.icon}</span>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: 'var(--ink-60)', lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section style={{ background: 'var(--green-900)', textAlign: 'center', padding: '70px 24px' }}>
        <h2 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 800, color: '#fff', marginBottom: 12, letterSpacing: '-0.5px' }}>
          Ready to take control of your farm?
        </h2>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.65)', marginBottom: 32 }}>
          Log in and see your herd's full story.
        </p>
        <button
          onClick={() => navigate('/login')}
          style={{
            background: 'var(--green-600)', color: '#fff',
            border: '2px solid rgba(255,255,255,0.2)',
            padding: '14px 32px', borderRadius: 10, fontSize: 16,
            fontWeight: 700, cursor: 'pointer', transition: 'background 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--green-400)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--green-600)'}
        >
          Go to Dashboard →
        </button>
      </section>

      {/* ── Footer ── */}
      <footer style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--ink-10)' }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--green-600)' }}>🐄 MilkTrack</span>
        <span style={{ fontSize: 13, color: 'var(--ink-30)' }}>Built for dairy farmers who mean business.</span>
      </footer>
    </div>
  )
}