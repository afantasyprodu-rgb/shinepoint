import { Link } from 'react-router-dom'
import { AnimatedPage } from '../components/ui/Motion'
import { ChevronLeftIcon } from '../components/icons'
import Logo from '../components/Logo'

const UPDATED = 'June 2026'

function LegalShell({ title, children }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-cta-50/40">
      <AnimatedPage className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <div className="mb-8 flex items-center justify-between">
          <Link to="/" className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600">
            <Logo />
          </Link>
          <Link
            to="/"
            className="flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-700"
          >
            <ChevronLeftIcon className="h-4 w-4" /> Back
          </Link>
        </div>

        <div className="card">
          <h1 className="font-display text-2xl font-bold text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-400">Last updated {UPDATED}</p>
          <div className="legal-body mt-6 space-y-5 text-sm leading-relaxed text-slate-600">
            {children}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          ShinePoint · Los Angeles, CA ·{' '}
          <Link to="/terms" className="underline hover:text-slate-600">Terms</Link>
          {' · '}
          <Link to="/privacy" className="underline hover:text-slate-600">Privacy</Link>
        </p>
      </AnimatedPage>
    </div>
  )
}

function H({ children }) {
  return <h2 className="font-display text-base font-semibold text-slate-900">{children}</h2>
}

export function Terms() {
  return (
    <LegalShell title="Terms of Service">
      <p>
        Welcome to ShinePoint. By creating an account or booking a detail you agree to these terms.
        Please read them carefully. This is a starting template — have a lawyer review it before
        you launch publicly.
      </p>

      <H>1. The marketplace</H>
      <p>
        ShinePoint connects vehicle owners (“customers”) with independent mobile detailers
        (“detailers”). We are a marketplace, not the provider of detailing services. Detailers are
        independent contractors, not employees of ShinePoint.
      </p>

      <H>2. Accounts</H>
      <p>
        You must provide accurate information and keep your login secure. You’re responsible for
        activity under your account. You must be at least 18 to use ShinePoint.
      </p>

      <H>3. Bookings & payments</H>
      <p>
        Prices are set by detailers. Payment is processed securely through Stripe; ShinePoint
        retains a platform fee from each completed booking. Tips go to the detailer. Cancellations
        and refunds follow the policy shown at booking time.
      </p>

      <H>4. Conduct</H>
      <p>
        Don’t arrange payment off-platform, harass other users, or misrepresent damage. We may
        suspend accounts that violate these terms, file false disputes, or repeatedly no-show.
      </p>

      <H>5. Damage & disputes</H>
      <p>
        Detailers document vehicle condition before work begins. If you disagree with an outcome,
        open a dispute in the app and our team will review the photo evidence from both sides.
      </p>

      <H>6. Liability</H>
      <p>
        ShinePoint provides the platform “as is.” To the extent permitted by law, we are not liable
        for the acts of independent detailers or customers. Insured detailers carry their own
        coverage; insurance status is shown on each profile.
      </p>

      <H>7. Changes</H>
      <p>
        We may update these terms; we’ll note the date above. Continued use after changes means you
        accept them.
      </p>

      <H>8. Contact</H>
      <p>Questions: support@shinepoint.app</p>
    </LegalShell>
  )
}

export function Privacy() {
  return (
    <LegalShell title="Privacy Policy">
      <p>
        This policy explains what ShinePoint collects, why, and your choices. This is a starting
        template — have a lawyer review it before you launch publicly.
      </p>

      <H>What we collect</H>
      <p>
        Account details (name, email, phone), profile info you add (photo, bio, vehicle), booking
        details (address, service, schedule), photos taken during jobs (before/after and damage
        documentation), messages sent in-app, and payment metadata handled by Stripe. We never see
        or store full card numbers.
      </p>

      <H>How we use it</H>
      <p>
        To run the marketplace — match you with detailers, show your location on the map, process
        payments, document jobs, resolve disputes, and send service notifications. We do not sell
        your personal data.
      </p>

      <H>Who can see it</H>
      <p>
        Your detailer sees what’s needed to do the job (name, address at arrival, vehicle, photos).
        Admins can review bookings, photos, and disputes for safety and support. Service providers
        like Supabase (hosting/storage), Stripe (payments), and Mapbox (maps) process data on our
        behalf.
      </p>

      <H>Photos & storage</H>
      <p>
        Profile and job photos are stored in our hosting provider’s storage. Job photos are tied to
        the booking and visible to that booking’s parties and admins.
      </p>

      <H>Your choices</H>
      <p>
        You can edit or remove your profile photo and details in Account settings, and request
        deletion of your account by contacting us. Location is used only while you use the app.
      </p>

      <H>Security</H>
      <p>
        We use industry-standard measures and access controls. No system is perfectly secure, but
        we work to protect your data.
      </p>

      <H>Contact</H>
      <p>Privacy questions: privacy@shinepoint.app</p>
    </LegalShell>
  )
}
