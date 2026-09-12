// Step -> Driplee quick-help intents for the detailer setup wizard
// (src/components/OnboardingHelper.jsx). Mirrors detailerHelperActions.js's
// shape but deliberately smaller: onboarding has no schedule/earnings/jobs
// to ask about yet, so this only covers the steps where a detailer is
// actually likely to pause and wonder "why does this app need this" --
// identity, insurance, pricing method, and the new deposit setting. Steps
// with no entry (profile, survey, schedule) render no helper chip at all;
// they're already covered by the step's own MarketingTip copy.
//
// Intent ids match supabase/functions/detailer-helper's HELP_TEXT keys
// exactly -- these are canned, static answers server-side, not free text,
// so there's nothing here for a detailer to "type" that needs interpreting.
const STEP_INTENTS = {
  0: ['help_id_onboarding'], // stepIdentity
  1: ['help_insurance_onboarding'], // stepInsurance
  4: ['help_pricing_method', 'help_fees'], // stepServices
  6: ['help_deposit_onboarding', 'help_payouts', 'help_fees'], // stepPayout
}

// Chip labels live under the detailerOnboarding i18n namespace (added
// alongside the deposit field strings) since that's the only namespace
// OnboardingHelper's caller has loaded via useT.
const LABEL_KEYS = {
  help_id_onboarding: 'helpIdLabel',
  help_insurance_onboarding: 'helpInsuranceLabel',
  help_pricing_method: 'helpPricingLabel',
  help_deposit_onboarding: 'helpDepositLabel',
  help_payouts: 'helpPayoutsLabel',
  help_fees: 'helpFeesLabel',
}

export function intentsForStep(step) {
  return STEP_INTENTS[step] ?? []
}

export function labelKeyFor(intentId) {
  return LABEL_KEYS[intentId] ?? intentId
}

// Step-aware greeting: "I see you're on step N, here's what to do" -- shown
// the moment Driplee opens, before any chip is picked, on every step
// (unlike the help chips above, which only exist on the four steps that
// warrant one). Local strings, not a backend call -- it has to render
// instantly and never depend on being online.
const GREETING_KEYS = {
  0: 'greetingIdentity',
  1: 'greetingInsurance',
  2: 'greetingProfile',
  3: 'greetingSurvey',
  4: 'greetingServices',
  5: 'greetingSchedule',
  6: 'greetingPayout',
}

export function greetingKeyForStep(step) {
  return GREETING_KEYS[step] ?? null
}
