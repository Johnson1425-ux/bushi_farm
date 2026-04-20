import React, { useState, useEffect } from 'react'
import { useAuth } from '../lib/AuthContext'
import { useTheme } from '../lib/ThemeContext'

const NAV = [
  { id: 'dashboard', icon: '◉', label: 'Dashboard' },
  { id: 'cows',      icon: '⊙', label: 'All Cows' },
  { id: 'compare',   icon: '⊜', label: 'Compare' },
  { id: 'records',   icon: '≡', label: 'Records' },
  { id: 'pregnancies',    icon: '↑', label: 'Pregnancies' },
  { id: 'health',    icon: '↑', label: 'Health Records'},
  { id: 'import',    icon: '↑', label: 'Import Data', adminOnly: false },
  { id: 'users',     icon: '⊛', label: 'Users',       adminOnly: true },
]

function NavItems({ navItems, page, onNav, dark, toggle }) {
  return (
    <>
      <nav className="px-3 py-4 flex-1">
        {navItems.map(n => {
          const active = page === n.id
          return (
            <button
              key={n.id}
              onClick={() => onNav(n.id)}
              className={[
                'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13.5px] mb-0.5',
                'transition-all duration-150 text-left cursor-pointer border-0',
                active
                  ? 'bg-green-600 text-white font-medium'
                  : 'text-white/60 hover:bg-white/8 hover:text-white font-normal',
              ].join(' ')}
            >
              <span className="text-base w-5 text-center leading-none">{n.icon}</span>
              {n.label}
            </button>
          )
        })}
      </nav>

      {/* Dark mode toggle */}
      <div className="px-4 pb-3">
        <button
          onClick={toggle}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] text-white/50 hover:text-white hover:bg-white/8 transition-all duration-150 border-0 cursor-pointer"
        >
          <span className="text-base w-5 text-center">{dark ? '☀' : '☾'}</span>
          {dark ? 'Light mode' : 'Dark mode'}
        </button>
      </div>
    </>
  )
}

function UserFooter({ user, logout, online, summary }) {
  const s = summary || {}
  return (
    <>
      {/* Status */}
      <div className="px-6 pb-3 text-[11px] text-white/40 flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${online ? 'bg-green-400' : 'bg-red'}`} />
        {online ? (
          <>
            <span className="text-white/70 font-medium">{parseInt(s.total_cows) || 0}</span>
            <span> cows · </span>
            <span className="text-white/70 font-medium">{parseInt(s.days_tracked) || 0}</span>
            <span> days</span>
          </>
        ) : 'Cannot reach server'}
      </div>

      {/* User + logout */}
      <div className="px-4 py-3 border-t border-white/10 flex items-center gap-2.5">
        <div className="w-[30px] h-[30px] rounded-full bg-green-600 text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0">
          {(user?.username?.[0] || '?').toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-medium text-white truncate">{user?.username}</div>
          <div className="text-[10px] text-white/40 uppercase tracking-wider">{user?.role}</div>
        </div>
        <button
          onClick={logout}
          title="Sign out"
          className="bg-transparent border-0 text-white/35 text-base p-1 leading-none transition-colors duration-150 hover:text-white/80 cursor-pointer"
        >
          ⏻
        </button>
      </div>
    </>
  )
}

export default function Sidebar({ page, setPage, summary, online }) {
  const { user, logout } = useAuth()
  const { dark, toggle } = useTheme()
  const [open, setOpen]  = useState(false)

  const navItems = NAV.filter(n => !n.adminOnly || user?.role === 'admin')

  const handleNav = (id) => {
    setPage(id)
    setOpen(false)
  }

  // Close on outside tap
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (!e.target.closest('#mob-sidebar') && !e.target.closest('#hamburger')) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [open])

  // Lock scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      {/* ═══════════════════════════════
          DESKTOP — always visible
      ═══════════════════════════════ */}
      <aside className="hidden md:flex w-[220px] min-h-screen bg-green-900 text-white flex-col fixed top-0 left-0 bottom-0 z-10">
        <div className="px-6 py-3 border-b border-white/10">
          <div className="font-serif text-[22px] text-white">🐄 Bushi Farm</div>
          <div className="text-[11px] text-white/45 mt-0.5 tracking-wide uppercase">Farm Analytics</div>
        </div>
        <NavItems navItems={navItems} page={page} onNav={handleNav} dark={dark} toggle={toggle} />
        <UserFooter user={user} logout={logout} online={online} summary={summary} />
      </aside>

      {/* ═══════════════════════════════
          MOBILE — top bar + drawer
      ═══════════════════════════════ */}
      <div className="md:hidden">

        {/* Top bar */}
        <div
          className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4"
          style={{ background: 'var(--green-900)', height: 56, borderBottom: '1px solid rgba(255,255,255,0.1)' }}
        >
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 20 }}>🐄</span>
            <span className="font-serif text-white text-[18px]">Bushi Farm</span>
          </div>
          <div className="flex items-center gap-1">
            {/* Dark mode toggle */}
            <button
              onClick={toggle}
              className="border-0 bg-transparent text-white/60 hover:text-white text-base cursor-pointer p-2 rounded-lg hover:bg-white/10 transition-all"
            >
              {dark ? '☀' : '☾'}
            </button>
            {/* Hamburger */}
            <button
              id="hamburger"
              onClick={() => setOpen(v => !v)}
              className="border-0 bg-transparent text-white cursor-pointer p-2 rounded-lg hover:bg-white/10 transition-all flex flex-col justify-center gap-[5px]"
              style={{ width: 36, height: 36 }}
            >
              <span className="block w-5 h-0.5 bg-white rounded transition-all" style={{ transform: open ? 'rotate(45deg) translate(3px, 4px)' : 'none' }} />
              <span className="block w-5 h-0.5 bg-white rounded transition-all" style={{ opacity: open ? 0 : 1 }} />
              <span className="block w-5 h-0.5 bg-white rounded transition-all" style={{ transform: open ? 'rotate(-45deg) translate(3px, -4px)' : 'none' }} />
            </button>
          </div>
        </div>

        {/* Backdrop */}
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 transition-all duration-300"
          style={{ background: 'rgba(0,0,0,0.5)', opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none' }}
        />

        {/* Drawer */}
        <aside
          id="mob-sidebar"
          className="fixed top-0 left-0 bottom-0 z-40 flex flex-col bg-green-900 text-white"
          style={{ width: 260, transform: open ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)' }}
        >
          {/* Logo + close */}
          <div className="px-6 py-6 border-b border-white/10 flex items-center justify-between">
            <div>
              <div className="font-serif text-[22px] text-white">🐄 Bushi Farm</div>
              <div className="text-[11px] text-white/45 mt-0.5 tracking-wide uppercase">Farm Analytics</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="border-0 bg-transparent text-white/50 hover:text-white text-[20px] leading-none cursor-pointer p-1 rounded hover:bg-white/10 transition-all"
            >
              ✕
            </button>
          </div>

          <NavItems navItems={navItems} page={page} onNav={handleNav} dark={dark} toggle={toggle} />
          <UserFooter user={user} logout={logout} online={online} summary={summary} />
        </aside>
      </div>
    </>
  )
}