import { lazy, Suspense } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import ArrivalTransition from './components/ArrivalTransition'
import { loadCustomerHome } from './lib/preload'
import Landing from './pages/Landing'
import Login from './pages/Login'
import CustomerSignup from './pages/CustomerSignup'
import DetailerSignup from './pages/DetailerSignup'
import CheckEmail from './pages/CheckEmail'
import AuthCallback from './pages/AuthCallback'
import DetailerProfile from './pages/DetailerProfile'
import BookingWizard from './pages/BookingWizard'
import Bookings from './pages/Bookings'
import BookingDetail from './pages/BookingDetail'
import Rewards from './pages/Rewards'
import CustomerSettings from './pages/CustomerSettings'
import DetailerDashboard from './pages/DetailerDashboard'
import DetailerJob from './pages/DetailerJob'
import DetailerOnboarding from './pages/DetailerOnboarding'
import DetailerEarnings from './pages/DetailerEarnings'
import DetailerProfileEditor from './pages/DetailerProfileEditor'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminPeople from './pages/admin/AdminPeople'
import AdminOps from './pages/admin/AdminOps'
import AdminFinance from './pages/admin/AdminFinance'

// Lazy: keeps mapbox-gl (~1.6 MB) out of the initial bundle. Same loader is
// reused by the login transition's preload so the page is warm on arrival.
const CustomerHome = lazy(loadCustomerHome)

function PageLoader() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="flex min-h-screen items-center justify-center"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
    </div>
  )
}

const guard = (role, el) => <ProtectedRoute role={role}>{el}</ProtectedRoute>

export default function App() {
  const location = useLocation()

  // Keying Routes by pathname remounts pages on navigation so each page's
  // AnimatedPage entrance plays. (Route-level exit animations via
  // AnimatePresence proved wedge-prone with rapid history changes.)
  return (
    <ArrivalTransition>
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<CustomerSignup />} />
        <Route path="/signup/detailer" element={<DetailerSignup />} />
        <Route path="/check-email" element={<CheckEmail />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* Customer */}
        <Route
          path="/home"
          element={guard(
            'customer',
            <Suspense fallback={<PageLoader />}>
              <CustomerHome />
            </Suspense>
          )}
        />
        <Route path="/detailers/:id" element={guard('customer', <DetailerProfile />)} />
        <Route path="/book/:id" element={guard('customer', <BookingWizard />)} />
        <Route path="/bookings" element={guard('customer', <Bookings />)} />
        <Route path="/bookings/:id" element={guard('customer', <BookingDetail />)} />
        <Route path="/rewards" element={guard('customer', <Rewards />)} />
        <Route path="/settings" element={guard('customer', <CustomerSettings />)} />

        {/* Detailer */}
        <Route path="/detailer" element={guard('detailer', <DetailerDashboard />)} />
        <Route path="/detailer/jobs/:id" element={guard('detailer', <DetailerJob />)} />
        <Route path="/detailer/onboarding" element={guard('detailer', <DetailerOnboarding />)} />
        <Route path="/detailer/earnings" element={guard('detailer', <DetailerEarnings />)} />
        <Route path="/detailer/profile" element={guard('detailer', <DetailerProfileEditor />)} />

        {/* Admin */}
        <Route path="/admin" element={guard('admin', <AdminDashboard />)} />
        <Route path="/admin/people" element={guard('admin', <AdminPeople />)} />
        <Route path="/admin/ops" element={guard('admin', <AdminOps />)} />
        <Route path="/admin/finance" element={guard('admin', <AdminFinance />)} />
      </Routes>
    </ArrivalTransition>
  )
}
