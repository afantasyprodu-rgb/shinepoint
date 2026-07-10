import { lazy, Suspense } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import ArrivalTransition from './components/ArrivalTransition'
import NativeBridge from './components/NativeBridge'
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
import AdminSetup from './pages/AdminSetup'
import ProfileSetup from './pages/ProfileSetup'
import CustomerOnboarding from './pages/CustomerOnboarding'
import DemoLauncher from './pages/DemoLauncher'
import DemoEntry from './pages/DemoEntry'
import { Terms, Privacy } from './pages/Legal'

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
      <NativeBridge />
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<CustomerSignup />} />
        <Route path="/signup/detailer" element={<DetailerSignup />} />
        <Route path="/check-email" element={<CheckEmail />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/admin-access" element={<AdminSetup />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        {/* Two-screen simulation: launcher + one direct-entry URL per side. */}
        <Route path="/demo" element={<DemoLauncher />} />
        <Route path="/demo/customer" element={<DemoEntry role="customer" />} />
        <Route path="/demo/detailer" element={<DemoEntry role="detailer" />} />
        {/* Post-signup profile setup — any signed-in role, no role gate. */}
        <Route path="/welcome" element={<ProtectedRoute><ProfileSetup /></ProtectedRoute>} />
        {/* Customer post-signup onboarding (vehicle + address). */}
        <Route path="/onboarding" element={<ProtectedRoute role="customer"><CustomerOnboarding /></ProtectedRoute>} />

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
