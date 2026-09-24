// Step -> Driplee quick-help intents for the detailer setup wizard
// Decision-fatigue spine: Profile -> Services -> Schedule -> Insurance -> Stripe.
const STEP_INTENTS = {
  1: ['help_pricing_method', 'help_fees'], // stepServices
  3: ['help_insurance_onboarding'], // stepInsurance (second to last)
  4: ['help_id_onboarding', 'help_payouts', 'help_fees'], // stepIdentity (Stripe last)
}

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

const GREETING_KEYS = {
  0: 'greetingProfile',
  1: 'greetingServices',
  2: 'greetingSchedule',
  3: 'greetingInsurance',
  4: 'greetingIdentity',
}

export function greetingKeyForStep(step) {
  return GREETING_KEYS[step] ?? null
}
