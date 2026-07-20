import React, { useState, useEffect, useCallback } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation, Outlet, useOutletContext } from 'react-router-dom'
import { useAuth } from './lib/AuthContext'
import { apiFetch } from './lib/api'
import { Analytics } from '@vercel/analytics/react'
import LandingPage    from './pages/LandingPage'
import Sidebar        from './components/Sidebar'
import Dashboard      from './pages/Dashboard'
import Cows           from './pages/Cows'
import Compare        from './pages/Compare'
import Records        from './pages/Records'
import DailyRecords   from './pages/DailyRecords'
import ImportData     from './pages/Import'
import Users          from './pages/Users'
import Login          from './pages/Login'
import Sales          from './pages/Sales'
import Inventory      from './pages/Inventory'
import Health         from './pages/Health'
import HealthRecords  from './pages/HealthRecords'
import Pregnancies    from './pages/Pregnancies'
import ProcessingUnit from './pages/ProcessingUnit'
import AboutUs       from './pages/AboutUs'
import ProductsPage   from './pages/ProductsPage'
import ContactPage    from './pages/ContactPage'
import CustomerLayout from './pages/CustomerLayout'
import { useAlerts, Toaster } from './lib/useAlerts'

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
  // useAlerts()
  const navigate = useNavigate()
  const location = useLocation()
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
      <Toaster />
      <Sidebar page={page} setPage={setPage} summary={summary} online={online} />
      <main className="flex-1 min-h-screen md:ml-[220px] pt-[56px] md:pt-0" style={{ padding: '56px 20px 32px' }}>
        <div className="md:p-[32px_36px] p-0 pt-4">
          <Outlet context={{ cows, summary, loadData, setPage }} />
        </div>
      </main>
    </div>
  )
}

// ── Page wrappers ─────────────────────────────────────────────────────────────

function DashboardPage()    { const { cows, summary, setPage } = useOutletContext(); return <Dashboard cows={cows} summary={summary} setPage={setPage} /> }
function CowsPage()         { const { cows } = useOutletContext(); return <Cows cows={cows} /> }
function ComparePage()      { const { cows } = useOutletContext(); return <Compare cows={cows} /> }
function RecordsPage()      { const { cows, summary } = useOutletContext(); return <Records cows={cows} summary={summary} /> }
function ImportPage()       { const { loadData } = useOutletContext(); return <ImportData onImported={loadData} /> }
function UsersPage()        { return <Users /> }
function SalesPage()        { return <Sales /> }
function InventoryPage()    { return <Inventory /> }
function HealthPage()       { return <Health /> }
function HealthRecordsPage(){ return <HealthRecords /> }
function PregPage()         { return <Pregnancies /> }
function ProcessingPage()   { return <ProcessingUnit /> }
function DailyRecordsPage() { return <DailyRecords /> }

// ── Root ──────────────────────────────────────────────────────────────────────

export default function App() {
  const { user, loading } = useAuth()
  if (loading) return <Loader />

  return (
    <>
      <Routes>
        {/* Public */}
        <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />

        {/* Protected */}
        <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
          <Route path="/dashboard"     element={<DashboardPage />} />
          <Route path="/cows"          element={<CowsPage />} />
          <Route path="/compare"       element={<ComparePage />} />
          <Route path="/records"       element={<RecordsPage />} />
          <Route path="/daily-records" element={<DailyRecordsPage />} />
          <Route path="/import"        element={<AdminRoute><ImportPage /></AdminRoute>} />
          <Route path="/sales"         element={<SalesPage />} />
          <Route path="/inventory"     element={<InventoryPage />} />
          <Route path="/health"        element={<HealthPage />} />
          <Route path="/health-records"element={<HealthRecordsPage />} />
          <Route path="/pregnancies"   element={<PregPage />} />
          <Route path="/processing"    element={<ProcessingPage />} />
          <Route path="/users"         element={<AdminRoute><UsersPage /></AdminRoute>} />
        </Route>

        <Route element={<CustomerLayout />}>
          <Route path="/"      element={user ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
          <Route path="/about-us"     element={<AboutUs />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/contact"  element={<ContactPage />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <Analytics />
    </>
  )
}