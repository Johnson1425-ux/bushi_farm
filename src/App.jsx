import React, { useState, useEffect, useCallback } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation, Outlet, useOutletContext } from 'react-router-dom'
import { useAuth } from './lib/AuthContext'
import { apiFetch } from './lib/api'
import LandingPage from './pages/LandingPage'
import Sidebar     from './components/Sidebar'
import Dashboard   from './pages/Dashboard'
import Cows        from './pages/Cows'
import Compare     from './pages/Compare'
import Records     from './pages/Records'
import ImportData  from './pages/Import'
import Users       from './pages/Users'
import Login       from './pages/Login'
import Inventory    from './pages/Inventory'
import Sales        from './pages/Sales'

// ── Guards ───────────────────────────────────────────────────────────────────

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Loader />
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  return children
}

function AdminRoute({ children }) {
  const { user } = useAuth()
  return user?.role === 'admin' ? children : <Navigate to="/dashboard" replace />
}

// ── Loader ────────────────────────────────────────────────────────────────────

function Loader() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--green-900)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 14 }}>Loading…</div>
    </div>
  )
}

// ── App shell ─────────────────────────────────────────────────────────────────

function AppShell() {
  const { user }  = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()
  const [cows,    setCows]    = useState([])
  const [summary, setSummary] = useState({})
  const [online,  setOnline]  = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([
        apiFetch('/analytics/summary'),
        apiFetch('/cows'),
      ])
      setSummary(s); setCows(c); setOnline(true)
    } catch {
      setOnline(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const page    = location.pathname.replace('/', '') || 'dashboard'
  const setPage = (p) => navigate(`/${p}`)

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar page={page} setPage={setPage} summary={summary} online={online} />
      {/*
        Desktop: marginLeft 220px (sidebar width)
        Mobile:  no marginLeft, but paddingTop 56px (top bar height)
      */}
      <main className="flex-1 min-h-screen md:ml-[220px] pt-[56px] md:pt-0" style={{ padding: '56px 20px 32px', }}>
        <div className="md:p-[32px_36px] p-0 pt-4">
          <Outlet context={{ cows, summary, loadData, setPage }} />
        </div>
      </main>
    </div>
  )
}

// ── Page wrappers ─────────────────────────────────────────────────────────────

function DashboardPage() {
  const { cows, summary, setPage } = useOutletContext()
  return <Dashboard cows={cows} summary={summary} setPage={setPage} />
}
function CowsPage()    { const { cows } = useOutletContext(); return <Cows cows={cows} /> }
function ComparePage() { const { cows } = useOutletContext(); return <Compare cows={cows} /> }
function RecordsPage() { const { cows, summary } = useOutletContext(); return <Records cows={cows} summary={summary} /> }
function ImportPage()  { const { loadData } = useOutletContext(); return <ImportData onImported={loadData} /> }
function UsersPage()   { return <Users /> }

// ── Root ──────────────────────────────────────────────────────────────────────

export default function App() {
  const { user, loading } = useAuth()
  if (loading) return <Loader />

  return (
    <Routes>
      <Route path="/"      element={user ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />

      <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/cows"      element={<CowsPage />} />
        <Route path="/compare"   element={<ComparePage />} />
        <Route path="/records"   element={<RecordsPage />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/sales"     element={<Sales />} />
        <Route path="/import"    element={<AdminRoute><ImportPage /></AdminRoute>} />
        <Route path="/users"     element={<AdminRoute><UsersPage /></AdminRoute>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}