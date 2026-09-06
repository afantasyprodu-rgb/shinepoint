// Per-page quick actions for the in-app detailer helper (DrewLauncher).
// Each action is a FIXED intent string sent as-is to supabase/functions/
// detailer-helper -- there is no free-text field, so nothing here is
// something a detailer "types" that an LLM has to interpret as a command.
// Keyed by pathname prefix; falls back to DEFAULT_ACTIONS for any detailer
// route not listed explicitly.

const DASHBOARD_ACTIONS = [
  { id: 'schedule_today', label: "Today's jobs" },
  { id: 'schedule_upcoming', label: 'Upcoming schedule' },
  { id: 'earnings_week', label: 'This week’s earnings' },
  { id: 'help_probation', label: 'Probation status' },
  { id: 'help_fees', label: 'How fees work' },
]

const EARNINGS_ACTIONS = [
  { id: 'earnings_week', label: 'This week’s earnings' },
  { id: 'earnings_next_payout', label: 'Payout status' },
  { id: 'help_payouts', label: 'How payouts work' },
  { id: 'help_fees', label: 'How fees work' },
  { id: 'schedule_upcoming', label: 'Upcoming schedule' },
]

const ANALYTICS_ACTIONS = [
  { id: 'analytics_rating', label: 'My rating' },
  { id: 'analytics_top_service', label: 'Top service' },
  { id: 'earnings_week', label: 'This week’s earnings' },
  { id: 'schedule_upcoming', label: 'Upcoming schedule' },
  { id: 'help_fees', label: 'How fees work' },
]

const REPORTS_ACTIONS = [
  { id: 'earnings_week', label: 'This week’s earnings' },
  { id: 'analytics_top_service', label: 'Top service' },
  { id: 'analytics_rating', label: 'My rating' },
  { id: 'schedule_today', label: "Today's jobs" },
  { id: 'help_fees', label: 'How fees work' },
]

// Job detail carries the bookingId along with the intent.
const JOB_ACTIONS = [
  { id: 'job_summary', label: 'Summarize this job' },
  { id: 'help_invoices', label: 'How invoices work' },
  { id: 'help_fees', label: 'How fees work' },
  { id: 'schedule_today', label: "Today's jobs" },
  { id: 'help_probation', label: 'Probation status' },
]

const DEFAULT_ACTIONS = DASHBOARD_ACTIONS

export function actionsForPath(pathname) {
  if (pathname.startsWith('/detailer/jobs/')) return JOB_ACTIONS
  if (pathname.startsWith('/detailer/earnings')) return EARNINGS_ACTIONS
  if (pathname.startsWith('/detailer/analytics')) return ANALYTICS_ACTIONS
  if (pathname.startsWith('/detailer/reports')) return REPORTS_ACTIONS
  return DEFAULT_ACTIONS
}

// A second rotation of actions for the same pages, shown when the detailer
// taps Drew again wanting different options instead of the first set.
const ALT = {
  dashboard: [
    { id: 'analytics_rating', label: 'My rating' },
    { id: 'earnings_next_payout', label: 'Payout status' },
    { id: 'help_invoices', label: 'How invoices work' },
    { id: 'help_payouts', label: 'How payouts work' },
    { id: 'analytics_top_service', label: 'Top service' },
  ],
}

export function altActionsForPath(pathname) {
  if (pathname.startsWith('/detailer/jobs/')) {
    return [
      { id: 'schedule_upcoming', label: 'Upcoming schedule' },
      { id: 'earnings_week', label: 'This week’s earnings' },
      { id: 'analytics_rating', label: 'My rating' },
      { id: 'help_payouts', label: 'How payouts work' },
      { id: 'help_invoices', label: 'How invoices work' },
    ]
  }
  if (pathname.startsWith('/detailer/earnings')) {
    return [
      { id: 'analytics_rating', label: 'My rating' },
      { id: 'analytics_top_service', label: 'Top service' },
      { id: 'help_probation', label: 'Probation status' },
      { id: 'schedule_today', label: "Today's jobs" },
      { id: 'help_invoices', label: 'How invoices work' },
    ]
  }
  if (pathname.startsWith('/detailer/analytics') || pathname.startsWith('/detailer/reports')) {
    return [
      { id: 'earnings_next_payout', label: 'Payout status' },
      { id: 'help_payouts', label: 'How payouts work' },
      { id: 'help_probation', label: 'Probation status' },
      { id: 'help_invoices', label: 'How invoices work' },
      { id: 'schedule_today', label: "Today's jobs" },
    ]
  }
  return ALT.dashboard
}
