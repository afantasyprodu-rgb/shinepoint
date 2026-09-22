import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import ProtectedRoute from './components/ProtectedRoute'
import TransitionOverlay from './components/TransitionOverlay'
import NativeBridge from './components/NativeBridge'
import IosInstallPrompt from './components/IosInstallPrompt'
import ErrorBoundary from './components/ErrorBoundary'

// Route-level code splitting: every page loads on demand. Before this, the
// entry bundle carried all 33 pages — including the 1.2MB of wizard/admin/
// analytics code, the full demo seed (75KB) and i18n strings (148KB) — for
// every visitor regardless of destination. The shell (providers, route
// guards, transition overlay) stays eager; only page bodies are split.
const Landing = lazy(() => import('./pages/Landing'))
const Login = lazy(() => import('./pages/Login'))
const CustomerHome = lazy(() => import('./pages/CustomerHome'))
const CustomerSignup = lazy(() => import('./pages/CustomerSignup'))
const DetailerSignup = lazy(() => import('./pages/DetailerSignup'))
const CheckEmail = lazy(() => import('./pages/CheckEmail'))
const AuthCallback = lazy(() => import('./pages/AuthCallback'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const DetailerProfile = lazy(() => import('./pages/DetailerProfile'))
const BookingWizard = lazy(() => import('./pages/BookingWizard'))
const Bookings = lazy(() => import('./pages/Bookings'))
const BookingDetail = lazy(() => import('./pages/BookingDetail'))
const Rewards = lazy(() => import('./pages/Rewards'))
const CustomerSettings = lazy(() => import('./pages/CustomerSettings'))
const DetailerDashboard = lazy(() => import('./pages/DetailerDashboard'))
const DetailerJob = lazy(() => import('./pages/DetailerJob'))
const DetailerOnboarding = lazy(() => import('./pages/DetailerOnboarding'))
const DetailerEarnings = lazy(() => import('./pages/DetailerEarnings'))
const DetailerReports = lazy(() => import('./pages/DetailerReports'))
const DetailerTools = lazy(() => import('./pages/DetailerTools'))
const DetailerProfileEditor = lazy(() => import('./pages/DetailerProfileEditor'))
const DetailerClients = lazy(() => import('./pages/DetailerClients'))
const DetailerClientDetail = lazy(() => import('./pages/DetailerClientDetail'))
const DetailerClientAdd = lazy(() => import('./pages/DetailerClientAdd'))
const DetailerClientImport = lazy(() => import('./pages/DetailerClientImport'))
const DetailerClientRequestPayment = lazy(() => import('./pages/DetailerClientRequestPayment'))
const DetailerClientRemind = lazy(() => import('./pages/DetailerClientRemind'))
const DetailerClientAutopilot = lazy(() => import('./pages/DetailerClientAutopilot'))
const DetailerTimeRequests = lazy(() => import('./pages/DetailerTimeRequests'))
const DetailerTimeRequestRespond = lazy(() => import('./pages/DetailerTimeRequests').then((m) => ({ default: m.DetailerTimeRequestRespond })))
const PayCharge = lazy(() => import('./pages/PayCharge'))
const DetailerPublicBook = lazy(() => import('./pages/DetailerPublicBook'))
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const AdminPeople = lazy(() => import('./pages/admin/AdminPeople'))
const AdminOps = lazy(() => import('./pages/admin/AdminOps'))
const AdminFinance = lazy(() => import('./pages/admin/AdminFinance'))
const AdminAnalytics = lazy(() => import('./pages/admin/AdminAnalytics'))
const AdminVisionCompare = lazy(() => import('./pages/admin/AdminVisionCompare'))
const ProfileSetup = lazy(() => import('./pages/ProfileSetup'))
const MfaSetup = lazy(() => import('./pages/MfaSetup'))
const MfaChallenge = lazy(() => import('./pages/MfaChallenge'))
const CustomerOnboarding = lazy(() => import('./pages/CustomerOnboarding'))
const Feedback = lazy(() => import('./pages/Feedback'))
const Legal = lazy(() => import('./pages/Legal').then((m) => ({ default: m.Terms })))
// Terms and Privacy share one module; two named exports need distinct lazy
// wrappers so each route gets its own chunk reference.
const PrivacyLazy = lazy(() => import('./pages/Legal').then((m) => ({ default: m.Privacy })))
const PublicTracking = lazy(() => import('./pages/PublicTracking'))
const ManageReschedule = lazy(() => import('./pages/ManageReschedule'))
const Faq = lazy(() => import('./pages/Faq'))
const AssistantChat = lazy(() => import('./pages/AssistantChat'))
const JobMockups = lazy(() => import('./components/JobMockups'))
const DevInvoicePreview = lazy(() => import('./components/JobMockups').then((m) => ({ default: m.DevInvoicePreview })))
const DarkTokens = lazy(() => import('./components/DarkTokens'))

function PageFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <span
        className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600 dark:border-brand-900 dark:border-t-brand-400"
        role="status" aria-label="Loading"
      />
    </div>
  )
}

// Route-level error isolation: a crash in one page shows the recoverable
// fallback inside its own route slot instead of unmounting the entire shell
// (before this, the ONLY boundary sat above BrowserRouter, so any page
// throw blanked the whole app). Each guarded/public element gets its own
// boundary; the root boundary in main.jsx remains as the last resort.
const guard = (role, el) => (
  <ProtectedRoute role={role}>
    <ErrorBoundary>{el}</ErrorBoundary>
  </ProtectedRoute>
)
const safe = (el) => <ErrorBoundary>{el}</ErrorBoundary>

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
      <IosInstallPrompt />
      {/* Suspense wraps the whole route table: navigating to any lazy page
          suspends until its chunk lands and shows the spinner fallback. */}
      <Suspense fallback={<PageFallback />}>
      <Routes location={location}>
        <Route path="/" element={safe(<Landing />)} />
        <Route path="/login" element={safe(<Login />)} />
        <Route path="/signup" element={safe(<CustomerSignup />)} />
        <Route path="/signup/detailer" element={safe(<DetailerSignup />)} />
        <Route path="/check-email" element={safe(<CheckEmail />)} />
        <Route path="/auth/callback" element={safe(<AuthCallback />)} />
        <Route path="/reset-password" element={safe(<ResetPassword />)} />
        <Route path="/terms" element={safe(<Legal />)} />
        <Route path="/privacy" element={safe(<PrivacyLazy />)} />
        <Route path="/faq" element={safe(<Faq />)} />
        {/* Public, no-login tracking link the en-route SMS points to (058) —
            deliberately outside ProtectedRoute; the booking id in the URL
            is the capability. */}
        <Route path="/track/:id" element={safe(<PublicTracking />)} />
        <Route path="/pay/:chargeId" element={safe(<PayCharge />)} />
        <Route path="/d/:slug" element={safe(<DetailerPublicBook />)} />
        <Route path="/reschedule/:token" element={safe(<ManageReschedule />)} />
        {/* Post-signup profile setup — any signed-in role, no role gate. */}
        <Route path="/welcome" element={<ProtectedRoute><ErrorBoundary><ProfileSetup /></ErrorBoundary></ProtectedRoute>} />
        {/* Optional 2FA enrollment prompt right after signup. */}
        <Route path="/mfa-setup" element={<ProtectedRoute><ErrorBoundary><MfaSetup /></ErrorBoundary></ProtectedRoute>} />
        {/* Login-time step-up for accounts with a verified TOTP factor. */}
        <Route path="/mfa-challenge" element={<ProtectedRoute><ErrorBoundary><MfaChallenge /></ErrorBoundary></ProtectedRoute>} />
        {/* Customer post-signup onboarding (vehicle + address). */}
        <Route path="/onboarding" element={<ProtectedRoute role="customer"><ErrorBoundary><CustomerOnboarding /></ErrorBoundary></ProtectedRoute>} />
        {/* Feedback board — shared by both roles, not admin. */}
        <Route path="/feedback" element={<ProtectedRoute role={['customer', 'detailer']}><ErrorBoundary><Feedback /></ErrorBoundary></ProtectedRoute>} />

        {/* Customer */}
        <Route path="/home" element={guard('customer', <CustomerHome />)} />
        <Route path="/detailers/:id" element={guard('customer', <DetailerProfile />)} />
        <Route path="/book/:id" element={guard('customer', <BookingWizard />)} />
        <Route path="/bookings" element={guard('customer', <Bookings />)} />
        <Route path="/bookings/:id" element={guard('customer', <BookingDetail />)} />
        <Route path="/rewards" element={guard('customer', <Rewards />)} />
        <Route path="/settings" element={guard('customer', <CustomerSettings />)} />
        <Route path="/assistant" element={guard('customer', <AssistantChat role="customer" />)} />

        {/* Detailer */}
        <Route path="/detailer" element={guard('detailer', <DetailerDashboard />)} />
        <Route path="/detailer/jobs/:id" element={guard('detailer', <DetailerJob />)} />
        <Route path="/detailer/onboarding" element={guard('detailer', <DetailerOnboarding />)} />
        <Route path="/detailer/earnings" element={guard('detailer', <DetailerEarnings />)} />
        <Route path="/detailer/analytics" element={<Navigate to="/detailer/earnings?tab=trends" replace />} />
        <Route path="/detailer/reports" element={guard('detailer', <DetailerReports />)} />
        <Route path="/detailer/tools" element={guard('detailer', <DetailerTools />)} />
        <Route path="/detailer/profile" element={guard('detailer', <DetailerProfileEditor />)} />
        <Route path="/detailer/clients" element={guard('detailer', <DetailerClients />)} />
        <Route path="/detailer/clients/add" element={guard('detailer', <DetailerClientAdd />)} />
        <Route path="/detailer/clients/import" element={guard('detailer', <DetailerClientImport />)} />
        <Route path="/detailer/clients/autopilot" element={guard('detailer', <DetailerClientAutopilot />)} />
        <Route path="/detailer/clients/:id/request-payment" element={guard('detailer', <DetailerClientRequestPayment />)} />
        <Route path="/detailer/clients/:id/remind" element={guard('detailer', <DetailerClientRemind />)} />
        <Route path="/detailer/time-requests" element={guard('detailer', <DetailerTimeRequests />)} />
        <Route path="/detailer/time-requests/:id" element={guard('detailer', <DetailerTimeRequestRespond />)} />
        <Route path="/detailer/clients/:id" element={guard('detailer', <DetailerClientDetail />)} />
        <Route path="/detailer/assistant" element={guard('detailer', <AssistantChat role="detailer" />)} />

        {/* Admin */}
        <Route path="/admin" element={guard('admin', <AdminDashboard />)} />
        <Route path="/admin/people" element={guard('admin', <AdminPeople />)} />
        <Route path="/admin/ops" element={guard('admin', <AdminOps />)} />
        <Route path="/admin/finance" element={guard('admin', <AdminFinance />)} />
        <Route path="/admin/analytics" element={guard('admin', <AdminAnalytics />)} />
        <Route path="/admin/vision-compare" element={guard('admin', <AdminVisionCompare />)} />
        <Route path="/admin/assistant" element={guard('admin', <AssistantChat role="admin" />)} />
        {/* DEV-only job-flow redesign gallery — renders null in production. */}
        <Route path="/dev/job-mockups" element={import.meta.env.DEV ? safe(<JobMockups />) : <Navigate to="/" replace />} />
        <Route path="/dev/invoice" element={import.meta.env.DEV ? safe(<DevInvoicePreview />) : <Navigate to="/" replace />} />
        <Route path="/dev/dark-tokens" element={import.meta.env.DEV ? safe(<DarkTokens />) : <Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </TransitionOverlay>
  )
}
