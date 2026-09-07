// Per-page quick actions for the in-app detailer helper (DrewLauncher).
// Each action is a FIXED intent string sent as-is to supabase/functions/
// detailer-helper -- there is no free-text field, so nothing here is
// something a detailer "types" that an LLM has to interpret as a command.
// Keyed by pathname prefix; falls back to DEFAULT_ACTIONS for any detailer
// route not listed explicitly.

// One label per intent id, in both languages -- the same intent shows up
// across several pages' action lists, so this keeps the translation in one
// place instead of repeating (and risking drift) at every call site.
const LABELS = {
  schedule_today: { en: "Today's jobs", es: 'Trabajos de hoy' },
  schedule_upcoming: { en: 'Upcoming schedule', es: 'Próximos trabajos' },
  earnings_week: { en: 'This week’s earnings', es: 'Ganancias de esta semana' },
  earnings_next_payout: { en: 'Payout status', es: 'Estado de pago' },
  analytics_rating: { en: 'My rating', es: 'Mi calificación' },
  analytics_top_service: { en: 'Top service', es: 'Servicio más popular' },
  job_summary: { en: 'Summarize this job', es: 'Resumir este trabajo' },
  help_invoices: { en: 'How invoices work', es: 'Cómo funcionan las facturas' },
  help_payouts: { en: 'How payouts work', es: 'Cómo funcionan los pagos' },
  help_probation: { en: 'Probation status', es: 'Estado de prueba' },
  help_fees: { en: 'How fees work', es: 'Cómo funcionan las comisiones' },
}

function label(id, lang) {
  return LABELS[id]?.[lang] ?? LABELS[id]?.en ?? id
}

// Static chrome around the chips (header, placeholders, aria-labels) --
// kept alongside the chip labels since both drive the same panel.
const PANEL_STRINGS = {
  askDrew: { en: 'Ask Drewpli', es: 'Preguntarle a Drewpli' },
  moreOptions: { en: 'More options', es: 'Más opciones' },
  close: { en: 'Close', es: 'Cerrar' },
  subtitle: { en: 'Here to help with this page', es: 'Aquí para ayudarte con esta página' },
  checking: { en: 'Drewpli is checking…', es: 'Drewpli está revisando…' },
  showOtherOptions: { en: 'Show other options', es: 'Mostrar otras opciones' },
  noAnswer: { en: "I don't have an answer for that right now.", es: 'No tengo una respuesta para eso ahora mismo.' },
  somethingWrong: { en: 'Something went wrong', es: 'Algo salió mal' },
}

export function panelStrings(lang = 'en') {
  return Object.fromEntries(Object.entries(PANEL_STRINGS).map(([key, v]) => [key, v[lang] ?? v.en]))
}

function actions(ids, lang) {
  return ids.map((id) => ({ id, label: label(id, lang) }))
}

const DASHBOARD_IDS = ['schedule_today', 'schedule_upcoming', 'earnings_week', 'help_probation', 'help_fees']
const EARNINGS_IDS = ['earnings_week', 'earnings_next_payout', 'help_payouts', 'help_fees', 'schedule_upcoming']
const ANALYTICS_IDS = ['analytics_rating', 'analytics_top_service', 'earnings_week', 'schedule_upcoming', 'help_fees']
const REPORTS_IDS = ['earnings_week', 'analytics_top_service', 'analytics_rating', 'schedule_today', 'help_fees']
// Job detail carries the bookingId along with the intent.
const JOB_IDS = ['job_summary', 'help_invoices', 'help_fees', 'schedule_today', 'help_probation']

export function actionsForPath(pathname, lang = 'en') {
  if (pathname.startsWith('/detailer/jobs/')) return actions(JOB_IDS, lang)
  if (pathname.startsWith('/detailer/earnings')) return actions(EARNINGS_IDS, lang)
  if (pathname.startsWith('/detailer/analytics')) return actions(ANALYTICS_IDS, lang)
  if (pathname.startsWith('/detailer/reports')) return actions(REPORTS_IDS, lang)
  return actions(DASHBOARD_IDS, lang)
}

// A second rotation of actions for the same pages, shown when the detailer
// taps Drew again wanting different options instead of the first set.
const ALT_DASHBOARD_IDS = ['analytics_rating', 'earnings_next_payout', 'help_invoices', 'help_payouts', 'analytics_top_service']
const ALT_JOB_IDS = ['schedule_upcoming', 'earnings_week', 'analytics_rating', 'help_payouts', 'help_invoices']
const ALT_EARNINGS_IDS = ['analytics_rating', 'analytics_top_service', 'help_probation', 'schedule_today', 'help_invoices']
const ALT_ANALYTICS_IDS = ['earnings_next_payout', 'help_payouts', 'help_probation', 'help_invoices', 'schedule_today']

export function altActionsForPath(pathname, lang = 'en') {
  if (pathname.startsWith('/detailer/jobs/')) return actions(ALT_JOB_IDS, lang)
  if (pathname.startsWith('/detailer/earnings')) return actions(ALT_EARNINGS_IDS, lang)
  if (pathname.startsWith('/detailer/analytics') || pathname.startsWith('/detailer/reports')) {
    return actions(ALT_ANALYTICS_IDS, lang)
  }
  return actions(ALT_DASHBOARD_IDS, lang)
}
