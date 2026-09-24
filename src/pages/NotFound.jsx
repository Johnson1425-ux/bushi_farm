import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { Logo } from '../components/ui'

/**
 * Where a role lands from the 404 page.
 *
 * Kept in step with App's homeFor(): an attendant cannot read the farm
 * dashboard, so sending them there from a wrong turn would put a page they
 * are not allowed to see in front of them. They get the till instead.
 */
const HOME_FOR = {
  attendant: { to: '/till',      label: 'Go to the till' },
  admin:     { to: '/dashboard', label: 'Go to the dashboard' },
  manager:   { to: '/dashboard', label: 'Go to the dashboard' },
  veteran:   { to: '/dashboard', label: 'Go to the dashboard' },
}

/** The pages a signed-in role is allowed to reach, offered as a way out. */
const SUGGESTIONS = {
  admin:     [['/cows', 'Cows'], ['/records', 'Milk records'], ['/expenses', 'Expenses'], ['/users', 'Users']],
  manager:   [['/cows', 'Cows'], ['/records', 'Milk records'], ['/stock', 'Stock issuing'], ['/reports', 'Reports']],
  veteran:   [['/cows', 'Cows'], ['/calves', 'Calves'], ['/health', 'Health'], ['/health-records', 'Health records'], ['/pregnancies', 'Pregnancies']],
  attendant: [['/till', 'Till'], ['/branch', 'Branch stock'], ['/customers', 'Customers']],
}

const PUBLIC_LINKS = [['/', 'Home'], ['/products', 'Products'], ['/about-us', 'About us'], ['/contact', 'Contact']]

/**
 * The page for an address that does not exist.
 *
 * The catch-all route used to redirect to the landing page, which quietly
 * threw the address away: a mistyped or stale link dropped the visitor on
 * the home page with no sign that anything had gone wrong, and a signed-in
 * user was pushed out of the app entirely. This says what happened, shows
 * the address that missed, and offers the pages the visitor can actually
 * open — which, once signed in, depends on their role.
 */
export default function NotFound() {
  const { user }  = useAuth()
  const location  = useLocation()
  const navigate  = useNavigate()

  const home  = HOME_FOR[user?.role] || { to: '/', label: 'Back to the home page' }
  const links = user ? (SUGGESTIONS[user.role] || []) : PUBLIC_LINKS

  return (
    <div
      style={{
        minHeight: '100vh', background: 'var(--cream)', color: 'var(--ink)',
        fontFamily: "'Outfit', sans-serif",
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '48px 24px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 520, textAlign: 'center' }}>
        <Link to={home.to} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
          <Logo size={40} />
          <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--green-600)', letterSpacing: '-0.3px' }}>Milktrack</span>
        </Link>

        <div
          className="font-serif"
          style={{ fontSize: 'clamp(64px, 16vw, 104px)', lineHeight: 1, color: 'var(--green-600)', letterSpacing: '-2px' }}
        >
          404
        </div>

        <h1 className="font-serif" style={{ fontSize: 'clamp(22px, 4vw, 28px)', marginTop: 12, letterSpacing: '-0.3px' }}>
          This page isn't in the barn.
        </h1>

        <p style={{ fontSize: 15, color: 'var(--ink-60)', marginTop: 10, lineHeight: 1.6 }}>
          The address you followed doesn't match anything here. It may have been mistyped,
          or the page may have moved since the link was made.
        </p>

        {/* The address that missed, so a mistyped or stale link can be seen
            for what it is. Rendered as text — never as a link — so a
            crafted URL cannot be clicked back out of this page. */}
        <div
          className="font-mono"
          style={{
            marginTop: 18, padding: '9px 14px', borderRadius: 10,
            background: 'var(--cream-dark)', color: 'var(--ink-60)',
            fontSize: 12, wordBreak: 'break-all',
          }}
        >
          {location.pathname}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 28 }}>
          <Link
            to={home.to}
            style={{
              padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600,
              background: 'var(--green-600)', color: '#fff',
            }}
          >
            {home.label}
          </Link>
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600,
              border: '1.5px solid var(--ink-10)', background: 'transparent',
              color: 'var(--ink)', cursor: 'pointer', fontFamily: "'Outfit', sans-serif",
            }}
          >
            Go back
          </button>
        </div>

        {links.length > 0 && (
          <div style={{ marginTop: 40, paddingTop: 24, borderTop: '1px solid var(--ink-10)' }}>
            <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--ink-30)', fontWeight: 600 }}>
              {user ? 'Or pick up where you left off' : 'Have a look around'}
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 14 }}>
              {links.map(([to, label]) => (
                <Link
                  key={to}
                  to={to}
                  style={{
                    padding: '7px 14px', borderRadius: 999, fontSize: 13, fontWeight: 500,
                    border: '1px solid var(--ink-10)', color: 'var(--ink-60)',
                  }}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
        )}

        {!user && (
          <p style={{ fontSize: 13, color: 'var(--ink-30)', marginTop: 28 }}>
            Work here? <Link to="/login" style={{ color: 'var(--green-600)', fontWeight: 600 }}>Sign in</Link>
          </p>
        )}
      </div>
    </div>
  )
}
