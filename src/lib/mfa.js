import { supabase } from './supabase'

// True when the signed-in user has a verified TOTP factor and the current
// session hasn't stepped up to aal2 yet — i.e. login should pause for a code.
export async function needsMfaChallenge() {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (error) return false
  return data.currentLevel === 'aal1' && data.nextLevel === 'aal2'
}

export async function hasVerifiedFactor() {
  const { data } = await supabase.auth.mfa.listFactors()
  return (data?.totp ?? []).some((f) => f.status === 'verified')
}
