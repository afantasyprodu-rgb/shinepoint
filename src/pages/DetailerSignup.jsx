import AuthCard from '../components/AuthCard'

// Detailer signup — same card, role="detailer" so the DB trigger creates
// a detailer_profiles row and the OTP/email paths pass role in metadata.
export default function DetailerSignup() {
  return <AuthCard defaultMode="signup" role="detailer" />
}
