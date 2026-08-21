import { useEffect } from 'react'
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import ProtectedRoute from './components/ProtectedRoute'
import TransitionOverlay from './components/TransitionOverlay'
import NativeBridge from './components/NativeBridge'
import CustomerHome from './pages/CustomerHome'
import Landing from './pages/Landing'
import Login from './pages/Login'
import CustomerSignup from './pages/CustomerSignup'
import DetailerSignup from './pages/DetailerSignup'
import CheckEmail from './pages/CheckEmail'
import AuthCallback from './pages/AuthCallback'
import ResetPassword from './pages/ResetPassword'
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
import DetailerAnalytics from './pages/DetailerAnalytics'
import DetailerTools from './pages/DetailerTools'
import DetailerProfileEditor from './pages/DetailerProfileEditor'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminPeople from './pages/admin/AdminPeople'
import AdminOps from './pages/admin/AdminOps'
import AdminFinance from './pages/admin/AdminFinance'
import AdminAnalytics from './pages/admin/AdminAnalytics'
import ProfileSetup from './pages/ProfileSetup'
import MfaSetup from './pages/MfaSetup'
import MfaChallenge from './pages/MfaChallenge'
import CustomerOnboarding from './pages/CustomerOnboarding'
import Feedback from './pages/Feedback'
import { Terms, Privacy } from './pages/Legal'
import PublicTracking from './pages/PublicTracking'

const guard = (role, el) => <ProtectedRoute role={role}>{el}</ProtectedRoute>

export default function App() {
  const location = useLocation()
  const navigate = useNavigate()

  // Safety net for the password-reset link: it's supposed to land on
  // /reset-password (see AuthCard's resetPasswordForEmail redirectTo), but
  // Supabase only honors that when the exact URL is in Authentication ->
  // URL Configuration -> Redirect URLs; otherwise it silently falls back to
  // the project's Site URL (the root). supabase-js still fires
  // PASSWORD_RECOVERY wherever the recovery tokens land (detectSessionInUrl
  // reads them off any page load), so catch it globally and route to the
  // real page instead of depending on that dashboard setting being correct.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' && location.pathname !== '/reset-password') {
        navigate('/reset-password', { replace: true })
      }
    })
    return () => subscription.unsubscribe()
  }, [location.pathname, navigate])

  // Keying Routes by pathname remounts pages on navigation so each page's
  // AnimatedPage entrance plays. (Route-level exit animations via
  // AnimatePresence proved wedge-prone with rapid history changes.)
  return (
    <TransitionOverlay>
      <NativeBridge />
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<CustomerSignup />} />
        <Route path="/signup/detailer" element={<DetailerSignup />} />
        <Route path="/check-email" element={<CheckEmail />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        {/* Public, no-login tracking link the en-route SMS points to (058) —
            deliberately outside ProtectedRoute; the booking id in the URL
            is the capability. */}
        <Route path="/track/:id" element={<PublicTracking />} />
        {/* Post-signup profile setup — any signed-in role, no role gate. */}
        <Route path="/welcome" element={<ProtectedRoute><ProfileSetup /></ProtectedRoute>} />
        {/* Optional 2FA enrollment prompt right after signup. */}
        <Route path="/mfa-setup" element={<ProtectedRoute><MfaSetup /></ProtectedRoute>} />
        {/* Login-time step-up for accounts with a verified TOTP factor. */}
        <Route path="/mfa-challenge" element={<ProtectedRoute><MfaChallenge /></ProtectedRoute>} />
        {/* Customer post-signup onboarding (vehicle + address). */}
        <Route path="/onboarding" element={<ProtectedRoute role="customer"><CustomerOnboarding /></ProtectedRoute>} />
        {/* Feedback board — shared by both roles, not admin. */}
        <Route path="/feedback" element={<ProtectedRoute role={['customer', 'detailer']}><Feedback /></ProtectedRoute>} />

        {/* Customer */}
        <Route path="/home" element={guard('customer', <CustomerHome />)} />
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
        <Route path="/detailer/analytics" element={guard('detailer', <DetailerAnalytics />)} />
        <Route path="/detailer/tools" element={guard('detailer', <DetailerTools />)} />
        <Route path="/detailer/profile" element={guard('detailer', <DetailerProfileEditor />)} />

        {/* Admin */}
        <Route path="/admin" element={guard('admin', <AdminDashboard />)} />
        <Route path="/admin/people" element={guard('admin', <AdminPeople />)} />
        <Route path="/admin/ops" element={guard('admin', <AdminOps />)} />
        <Route path="/admin/finance" element={guard('admin', <AdminFinance />)} />
        <Route path="/admin/analytics" element={guard('admin', <AdminAnalytics />)} />
      </Routes>
    </TransitionOverlay>
  )
}
