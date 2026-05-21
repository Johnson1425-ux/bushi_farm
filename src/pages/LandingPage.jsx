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
  const navigate         = useNavigate()
  const { dark, toggle } = useTheme()
  const [stats, setStats] = useState(null)
  const [mobileMenu, setMobileMenu] = useState(false)

  useEffect(() => {
    const base = import.meta.env.VITE_API_URL || ''
    fetch(`${base}/api/public/stats`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setStats(d) })
      .catch(() => {})
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', color: 'var(--ink)', fontFamily: "'Outfit', sans-serif", overflowX: 'hidden' }}>

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

        <h1 style={{ fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: 800, lineHeight: 1.1, marginBottom: 20, color: 'var(--ink)', letterSpacing: '-1.5px' }}>
          Know your farm.<br />
          <span style={{ color: 'var(--green-600)' }}>Grow your yield.</span>
        </h1>

        <p style={{ fontSize: 18, color: 'var(--ink-60)', maxWidth: 540, margin: '0 auto 36px', lineHeight: 1.65 }}>
          Bushi Dairy Farm gives dairy farmers a complete picture — from daily milk logs to herd analytics — so every decision is backed by real data.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 52 }}>
          <button
            onClick={() => navigate('/login')}
            style={{
              background: 'var(--green-600)', color: '#fff', border: 'none',
              padding: '13px 28px', borderRadius: 10, fontSize: 16, fontWeight: 700,
              cursor: 'pointer', transition: 'all 0.2s',
              boxShadow: '0 4px 15px rgba(42,138,86,0.3)',
              fontFamily: "'Outfit', sans-serif",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--green-800)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--green-600)'; e.currentTarget.style.transform = 'translateY(0)' }}
          >
            Get Started →
          </button>
          <button
            onClick={() => navigate('/products')}
            style={{
              background: 'transparent', color: 'var(--green-600)',
              border: '1.5px solid var(--green-600)',
              padding: '13px 28px', borderRadius: 10, fontSize: 16, fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.2s',
              fontFamily: "'Outfit', sans-serif",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--green-50)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            View Products
          </button>
        </div>

        {/* ── Live stats card ── */}
        <div style={{
          background: 'var(--surface)', borderRadius: 16,
          border: '1px solid var(--ink-10)', padding: 24,
          boxShadow: '0 20px 60px rgba(0,0,0,0.07)',
          maxWidth: 560, margin: '0 auto',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Farm at a Glance</span>
            <span style={{ fontSize: 12, color: 'var(--ink-30)' }}>{stats ? 'Live data' : 'Loading…'}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total Cows',   value: stats ? stats.total_cows : '—' },
              { label: 'Avg / Cow',    value: stats ? parseFloat(stats.overall_avg).toFixed(1) + ' L' : '—' },
              { label: 'Days Tracked', value: stats ? stats.days_tracked : '—' },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--green-50)', borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--ink-60)', fontWeight: 500, marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)' }}>{s.value}</div>
              </div>
            ))}
          </div>
          <div style={{ background: 'var(--green-900)', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 500, marginBottom: 2 }}>Total Milk Collected</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#fff' }}>
                {stats
                  ? parseFloat(stats.total_litres) >= 1000
                    ? (parseFloat(stats.total_litres) / 1000).toFixed(1) + 'k L'
                    : parseFloat(stats.total_litres).toFixed(0) + ' L'
                  : '—'}
              </div>
            </div>
            <span style={{ fontSize: 36 }}>🥛</span>
          </div>
        </div>
      </section>

      {/* ── Customer section ── */}
      <section style={{ background: 'var(--cream-dark)', padding: '72px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', textAlign: 'center', marginBottom: 44 }}>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--green-600)', marginBottom: 10 }}>For Customers</p>
          <h2 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.5px', marginBottom: 12 }}>
            Fresh dairy, straight from our farm.
          </h2>
          <p style={{ fontSize: 15, color: 'var(--ink-60)', maxWidth: 500, margin: '0 auto' }}>
            Looking for fresh milk, yoghurt, or mtindi? Explore our products and get in touch to place an order.
          </p>
        </div>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
          {[
            { path: '/farm',     icon: '🏡', title: 'Our Farm',  desc: 'Learn about Bushi Dairy Farm — our story, location, and values.' },
            { path: '/products', icon: '🥛', title: 'Products',  desc: 'Browse our fresh milk, vanilla & strawberry yoghurt, and Mtindi Bonge.' },
            { path: '/contact',  icon: '📞', title: 'Contact Us', desc: 'Place an order or ask a question. We respond via WhatsApp.' },
          ].map(c => (
            <div
              key={c.path}
              onClick={() => navigate(c.path)}
              style={{
                background: 'var(--surface)', borderRadius: 14, padding: '24px 20px',
                border: '1px solid var(--ink-10)', cursor: 'pointer', transition: 'all 0.2s',
                textAlign: 'left',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = 'var(--green-400)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'var(--ink-10)'; e.currentTarget.style.boxShadow = 'none' }}
            >
              <span style={{ fontSize: 32, display: 'block', marginBottom: 14 }}>{c.icon}</span>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>{c.title}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-60)', lineHeight: 1.6, marginBottom: 16 }}>{c.desc}</div>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--green-600)' }}>Explore →</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '72px 24px', textAlign: 'center' }}>
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
              style={{ background: 'var(--surface)', border: '1.5px solid var(--ink-10)', borderRadius: 14, padding: 24, transition: 'all 0.25s ease' }}
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
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/login')}
            style={{
              background: 'var(--green-600)', color: '#fff',
              border: '2px solid rgba(255,255,255,0.2)',
              padding: '14px 32px', borderRadius: 10, fontSize: 16,
              fontWeight: 700, cursor: 'pointer', transition: 'background 0.2s',
              fontFamily: "'Outfit', sans-serif",
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--green-400)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--green-600)'}
          >
            Go to Dashboard →
          </button>
          <button
            onClick={() => navigate('/products')}
            style={{
              background: 'transparent', color: 'rgba(255,255,255,0.75)',
              border: '2px solid rgba(255,255,255,0.2)',
              padding: '14px 32px', borderRadius: 10, fontSize: 16,
              fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
              fontFamily: "'Outfit', sans-serif",
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.75)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)' }}
          >
            Our Products
          </button>
        </div>
      </section>
    </div>
  )
}