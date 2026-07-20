import { useState } from 'react'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useTheme } from '../lib/ThemeContext'
import { Milk } from 'lucide-react'

const NAV = [
  { path: '/',     label: 'Home' },
  { path: '/about-us',     label: 'About Us' },
  { path: '/products', label: 'Products' },
  { path: '/contact',  label: 'Contact' },
]

export default function CustomerLayout() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { dark, toggle } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)

  const navBtn = (label, onClick, variant = 'ghost') => {
    const base = {
      border: 'none', cursor: 'pointer', borderRadius: 8,
      fontSize: 14, fontWeight: 600, transition: 'all 0.2s',
      fontFamily: "'Outfit', sans-serif",
    }
    if (variant === 'ghost') return {
      ...base, background: 'transparent', color: 'var(--ink-60)',
      padding: '7px 14px',
    }
    if (variant === 'outline') return {
      ...base, background: 'transparent',
      border: '1.5px solid var(--green-600)',
      color: 'var(--green-600)', padding: '7px 16px',
    }
    if (variant === 'solid') return {
      ...base, background: 'var(--green-600)',
      color: '#fff', padding: '7px 16px',
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', color: 'var(--ink)', fontFamily: "'Outfit', sans-serif" }}>

      {/* ── Navbar ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        backdropFilter: 'blur(12px)',
        background: 'var(--cream)',
        borderBottom: '1px solid var(--ink-10)',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

          {/* Logo */}
          <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 26 }}>
              <Milk size={24} color="var(--green-600)" />
            </span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--green-600)', lineHeight: 1.2, letterSpacing: '-0.3px' }}>Bushi Dairy Farm</div>
              <div style={{ fontSize: 10, color: 'var(--ink-30)', textTransform: 'uppercase', letterSpacing: 1 }}>Mwanza, Tanzania</div>
            </div>
          </button>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1 flex-1 justify-center">
            {NAV.map(n => (
              <button
                key={n.path}
                onClick={() => navigate(n.path)}
                style={{
                  cursor: 'pointer',
                  padding: '7px 18px',
                  fontSize: 14,
                  fontWeight: 600,
                  color: location.pathname === n.path ? 'var(--green-600)' : 'var(--ink-60)',
                  background: 'transparent',
                  transition: 'color 0.15s, background 0.15s',
                }}
                onMouseEnter={e => {
                  if (location.pathname !== n.path) {
                    e.currentTarget.style.color = 'var(--green-600)';
                  }
                }}
                onMouseLeave={e => {
                  if (location.pathname !== n.path) {
                    e.currentTarget.style.color = 'var(--ink-60)';
                  }
                }}
              >
                <span style={{
                  borderBottom: location.pathname === n.path ? '2px solid var(--green-600)' : '2px solid transparent',
                  paddingBottom: 2,
                }}>
                  {n.label}
                </span>
              </button>
            ))}
          </div>

          {/* Right actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={toggle}
              style={{
                background: 'var(--cream-dark)', border: '1.5px solid var(--ink-10)',
                borderRadius: 8, width: 36, height: 36, display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer', fontSize: 16, transition: 'all 0.2s',
              }}
            >{dark ? '☀' : '☾'}
            </button>

            {/* <button
              className="hidden md:inline-flex"
              onClick={() => navigate('/login')}
              style={navBtn(null, null, 'outline')}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--green-600)'; e.currentTarget.style.color = '#fff' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--green-600)' }}
            >
              Staff Login
            </button> */}

            {/* Mobile hamburger */}
            <button
              className="md:hidden flex items-center justify-center"
              onClick={() => setMenuOpen(v => !v)}
              style={{ 
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 36, color: 'var(--ink-60)', padding: 4,
                width: 36, height: 36, transition: 'all 0.2s',
              }}
            >
              {menuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden" style={{ borderTop: '1px solid var(--ink-10)', background: 'var(--surface)', padding: '12px 16px' }}>
            {NAV.map(n => (
              <button
                key={n.path}
                onClick={() => { navigate(n.path); setMenuOpen(false) }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  background: location.pathname === n.path ? 'var(--green-100)' : 'none',
                  border: 'none', cursor: 'pointer', padding: '12px 16px',
                  borderRadius: 8, fontSize: 15, fontWeight: 500,
                  color: location.pathname === n.path ? 'var(--green-600)' : 'var(--ink)',
                  fontFamily: "'Outfit', sans-serif", marginBottom: 4,
                }}
                onMouseEnter={e => {
                  if (location.pathname !== n.path) {
                    e.currentTarget.style.background = 'var(--green-600)';
                    e.currentTarget.style.color = '#fff';
                  }
                }}
                onMouseLeave={e => {
                  if (location.pathname !== n.path) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--green-600)';
                  }
                }}
              >
                {n.label}
              </button>
            ))}
            {/* <div style={{ borderTop: '1px solid var(--ink-10)', marginTop: 8, paddingTop: 12 }}>
              <button
                onClick={() => { navigate('/login'); setMenuOpen(false) }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  background: 'none', border: '1.5px solid var(--green-600)',
                  cursor: 'pointer', padding: '12px 16px',
                  borderRadius: 8, fontSize: 15, fontWeight: 600,
                  color: 'var(--green-600)', fontFamily: "'Outfit', sans-serif",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--green-600)'; e.currentTarget.style.color = '#fff' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--green-600)' }}
              >
                Staff Login
              </button>
            </div> */}
          </div>
        )}
      </nav>

      {/* ── Page content ── */}
      <Outlet />

      {/* ── Footer ── */}
      <footer style={{ borderTop: '1px solid var(--ink-10)', marginTop: 80 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px', display: 'flex', flexWrap: 'wrap', gap: 24, justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>🐄</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--green-600)' }}>Bushi Dairy Farm</div>
              <div style={{ fontSize: 12, color: 'var(--ink-30)', marginTop: 2 }}>Mwanza, Maduka Tisa Stand</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            {NAV.map(n => (
              <button key={n.path} onClick={() => navigate(n.path)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--ink-60)', fontFamily: "'Outfit', sans-serif' " }}>
                {n.label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-30)' }}>© {new Date().getFullYear()} Bushi Dairy Farm</div>
        </div>
      </footer>
    </div>
  )
}