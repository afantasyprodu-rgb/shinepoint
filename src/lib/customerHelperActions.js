// Quick actions for the in-app customer helper (CustomerHelper.jsx) --
// sibling of detailerHelperActions.js, same "fixed intent, no free-text
// field" shape (see customer-helper's header for why). Customers get one
// fixed set rather than detailerHelperActions' per-path lists since there's
// no equivalent of "this page" context to key off yet.

const LABELS = {
  cost_estimate: { en: 'How much should this cost me?', es: '¿Cuánto debería costarme?' },
  photo_estimate: { en: 'Take a photo → get an estimate', es: 'Tomar una foto → obtener un estimado' },
  help_how_it_works: { en: 'How ShinePoint works', es: 'Cómo funciona ShinePoint' },
  help_booking: { en: 'How booking works', es: 'Cómo funciona la reserva' },
}

function label(id, lang) {
  return LABELS[id]?.[lang] ?? LABELS[id]?.en ?? id
}

const DEFAULT_IDS = ['cost_estimate', 'photo_estimate', 'help_how_it_works', 'help_booking']

export function customerActions(lang = 'en') {
  return DEFAULT_IDS.map((id) => ({ id, label: label(id, lang) }))
}

// Static chrome around the chips (header, placeholders, aria-labels, and
// the one-time greeting shown right after onboarding finishes).
const PANEL_STRINGS = {
  askDriplee: { en: 'Ask Driplee', es: 'Preguntarle a Driplee' },
  close: { en: 'Close', es: 'Cerrar' },
  subtitle: { en: 'Your ShinePoint helper', es: 'Tu ayudante de ShinePoint' },
  checking: { en: 'Driplee is checking…', es: 'Driplee está revisando…' },
  scanning: { en: 'Driplee is looking at your photos…', es: 'Driplee está revisando tus fotos…' },
  noAnswer: { en: "I don't have an answer for that right now.", es: 'No tengo una respuesta para eso ahora mismo.' },
  somethingWrong: { en: 'Something went wrong', es: 'Algo salió mal' },
  greeting: {
    en: "Hi — I'm Driplee, your helper. Ask me anything!",
    es: '¡Hola! Soy Driplee, tu ayudante. ¡Pregúntame lo que sea!',
  },
  photosPending: {
    en: "I'll pass these photos along to whichever detailer you book, so they know what to expect.",
    es: 'Compartiré estas fotos con el detallista que reserves, para que sepa qué esperar.',
  },
}

export function panelStrings(lang = 'en') {
  return Object.fromEntries(Object.entries(PANEL_STRINGS).map(([key, v]) => [key, v[lang] ?? v.en]))
}
