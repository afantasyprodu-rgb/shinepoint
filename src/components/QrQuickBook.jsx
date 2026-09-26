import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import BoBlob from './ui/BoBlob'
import DetailerCard3D from './DetailerCard3D'
import AddressAutocomplete from './ui/AddressAutocomplete'
import Turnstile, { isTurnstileConfigured } from './ui/Turnstile'
import { supabase } from '../lib/supabase'
import { normalizePhone } from '../lib/detailerClients'
import { useAuth } from '../context/AuthContext'
import { useStore } from '../context/StoreContext'
import { useT } from '../i18n/useT'

// QR-flyer quick book (/d/:slug). A first-time visitor never sees a signup
// screen: Bo walks them through services → address → name/email → a 6-digit
// email code. signInWithOtp(shouldCreateUser) makes them a real customer
// behind the scenes (or signs a returning one in), so payment, tracking,
// receipts and reminders all run through the normal customer paths — no
// accountless booking rows, no changes to the booking guards.
const STEPS = ['services', 'where', 'you', 'code']
const FAQ = {
  card: ['qHome', 'qPay'],
  services: ['qHome', 'qPay', 'qAccount'],
  where: ['qFar', 'qHome', 'qRain'],
  you: ['qAccount', 'qPay'],
  code: ['qAccount'],
}
const FAQ_ANSWER = { qHome: 'aHome', qPay: 'aPay', qRain: 'aRain', qAccount: 'aAccount', qFar: 'aFar' }
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function BoSays({ text }) {
  return (
    <div className="flex items-end gap-3">
      <div className="shrink-0">
        <BoBlob size={60} />
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={text}
          initial={{ opacity: 0, y: 8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.22 }}
          className="relative mb-2 rounded-2xl rounded-bl-md bg-white px-4 py-3 text-[15px] font-medium leading-snug text-slate-800 shadow-md dark:bg-[#241c36] dark:text-slate-100"
        >
          {text}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

export default function QrQuickBook({ detailer }) {
  const t = useT('qrQuickBook')
  const tSms = useT('customerSettings')
  const navigate = useNavigate()
  const { session, profile } = useAuth()
  const { customer, customerProfileLoaded, updateCustomer } = useStore()

  // "Marco's Mobile Shine" → "Marco": first word of a business name, minus
  // a trailing possessive, reads naturally in Bo's lines ("with Marco").
  const first = (detailer.name || 'your detailer').split(' ')[0].replace(/['’]s$/i, '')
  const services = Array.isArray(detailer.services) ? detailer.services : []
  const signedInCustomer = Boolean(session) && profile?.role === 'customer'

  // Every visit opens on the detailer's animated card, which Bo presents.
  const [step, setStep] = useState('card')
  const [selected, setSelected] = useState([])
  const [address, setAddress] = useState('')
  const [zip, setZip] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [smsOptIn, setSmsOptIn] = useState(false)
  const [code, setCode] = useState('')
  const [captchaToken, setCaptchaToken] = useState(null)
  const captchaRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [faq, setFaq] = useState(null)

  const total = services.filter((s) => selected.includes(s.id)).reduce((sum, s) => sum + Number(s.price || 0), 0)

  const visibleSteps = signedInCustomer ? ['services', 'where'] : STEPS
  const stepIndex = Math.max(0, visibleSteps.indexOf(step))

  function go(next) {
    setError('')
    setFaq(null)
    // Turnstile tokens are single-use and the widget remounts on the
    // "you" step, so never carry an old (possibly spent) token back into it.
    if (next === 'you') setCaptchaToken(null)
    setStep(next)
  }

  function finishToWizard() {
    navigate(`/book/${detailer.id}?source=direct`, { state: { preselectedServiceIds: selected } })
  }

  // After the email code verifies, the auth session + customer profile load
  // asynchronously. Save address/phone/consent through the normal
  // updateCustomer path once they're in, then hand off to the wizard.
  const pending = useRef(null)
  useEffect(() => {
    if (step !== 'finishing' || !pending.current) return
    if (!profile?.id || !customerProfileLoaded) return
    const patch = pending.current
    pending.current = null
    if (profile.role !== 'customer') {
      setError(t('errWrongAccount'))
      setStep('you')
      supabase.auth.signOut()
      return
    }
    updateCustomer(patch)
      .then(finishToWizard)
      .catch((e) => { setError(e?.message || t('errSlow')); setStep('code') })
    // finishToWizard only reads stable props/state for this pass.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, profile?.id, profile?.role, customerProfileLoaded])

  useEffect(() => {
    if (step !== 'finishing') return
    const timer = setTimeout(() => setError(t('errSlow')), 15000)
    return () => clearTimeout(timer)
  }, [step, t])

  function toggle(id) {
    setError('')
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function nextFromServices() {
    if (!selected.length) return setError(t('errPickService'))
    // A signed-in customer with a saved address skips straight to the wizard.
    if (signedInCustomer && customer?.address && customer?.zip) return finishToWizard()
    if (signedInCustomer) {
      setAddress(customer?.address || '')
      setZip(customer?.zip || '')
    }
    go('where')
  }

  async function nextFromWhere() {
    if (!address.trim()) return setError(t('errAddress'))
    if (!/^\d{5}$/.test(zip)) return setError(t('errZip'))
    if (signedInCustomer) {
      setBusy(true)
      try {
        await updateCustomer({ address: address.trim(), zip })
        finishToWizard()
      } catch (e) {
        setError(e?.message || t('errSlow'))
      } finally {
        setBusy(false)
      }
      return
    }
    go('you')
  }

  async function sendCode() {
    const digits = phone.replace(/\D/g, '')
    if (!name.trim()) return setError(t('errName'))
    if (!EMAIL_RE.test(email.trim())) return setError(t('errEmail'))
    if (digits && digits.length < 10) return setError(t('errPhone'))
    if (smsOptIn && !digits) return setError(t('errPhoneForSms'))
    if (isTurnstileConfigured && !captchaToken) return setError(t('errCaptcha'))
    setBusy(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: true,
        data: { full_name: name.trim(), role: 'customer', ...(digits ? { phone: normalizePhone(phone) } : {}) },
        captchaToken: captchaToken ?? undefined,
      },
    })
    setBusy(false)
    captchaRef.current?.reset()
    setCaptchaToken(null)
    if (err) return setError(err.message)
    go('code')
  }

  async function verifyCode() {
    if (!/^\d{6}$/.test(code)) return setError(t('errCode'))
    setBusy(true)
    setError('')
    const { error: err } = await supabase.auth.verifyOtp({ email: email.trim(), token: code, type: 'email' })
    setBusy(false)
    if (err) { setCode(''); return setError(err.message) }
    const digits = phone.replace(/\D/g, '')
    // Unchecked means "didn't opt in here", not "opt out" — never clear an
    // existing customer's consent just because they skipped the box.
    pending.current = {
      address: address.trim(),
      zip,
      ...(digits ? { phone: normalizePhone(phone) } : {}),
      ...(smsOptIn ? { smsOptIn: true } : {}),
    }
    setStep('finishing')
  }

  const boLine = {
    card: t('boCard', { name: detailer.name || first }),
    services: selected.length
      ? t('boPicked', { total: String(Math.round(total)), first })
      : signedInCustomer ? t('boWelcomeBack', { first }) : t('boServicesAsk'),
    where: t('boWhere', { first }),
    you: t('boYou'),
    code: t('boCode', { email: email.trim() }),
    finishing: t('boFinishing', { first }),
  }[step]

  return (
    <div className="min-h-dvh bg-gradient-to-b from-brand-50 via-white to-white px-4 pb-10 pt-[max(env(safe-area-inset-top),1.5rem)] dark:from-[#1a1330] dark:via-[#141026] dark:to-[#141026]">
      <div className="mx-auto w-full max-w-md">
        {/* Who they're booking — the card itself covers this on the first step */}
        {step !== 'card' && (
        <div className="flex items-center gap-3">
          {detailer.photo ? (
            <img src={detailer.photo} alt="" className="h-12 w-12 rounded-full object-cover ring-2 ring-brand-500" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-2xl dark:bg-brand-500/15">{detailer.vehicle_emoji || '✨'}</div>
          )}
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-bold text-slate-900 dark:text-slate-100">{detailer.name}</p>
            {detailer.zip && <p className="text-xs text-slate-500 dark:text-slate-400">Mobile detailing · {detailer.zip}</p>}
          </div>
        </div>
        )}

        {/* Progress */}
        {step !== 'finishing' && step !== 'card' && (
          <div className="mt-5 flex gap-1.5" aria-hidden="true">
            {visibleSteps.map((s, i) => (
              <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= stepIndex ? 'bg-brand-600' : 'bg-brand-100 dark:bg-white/10'}`} />
            ))}
          </div>
        )}

        {step === 'card' && (
          <div className="mt-2">
            <DetailerCard3D detailer={detailer} first={first} />
          </div>
        )}

        <div className="mt-6">
          <BoSays text={boLine} />
        </div>

        {/* Bo's quick answers */}
        {FAQ[step] && (
          <div className="mt-3 pl-[72px]">
            <div className="flex flex-wrap gap-1.5">
              {FAQ[step].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setFaq(faq === q ? null : q)}
                  aria-expanded={faq === q}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    faq === q
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-brand-200 bg-white text-brand-700 hover:border-brand-400 dark:border-white/10 dark:bg-white/5 dark:text-brand-300'
                  }`}
                >
                  {t(q)}
                </button>
              ))}
            </div>
            <AnimatePresence>
              {faq && (
                <motion.p
                  key={faq}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-2 overflow-hidden rounded-xl bg-brand-50 px-3 py-2 text-sm text-slate-700 dark:bg-white/5 dark:text-slate-300"
                >
                  {t(FAQ_ANSWER[faq], { first })}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        )}

        <div className="mt-6">
          {step === 'services' && (
            <div className="space-y-2">
              {services.map((s) => {
                const on = selected.includes(s.id)
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggle(s.id)}
                    aria-pressed={on}
                    className={`card flex w-full items-center justify-between gap-3 !p-4 text-left transition-all ${on ? 'ring-2 ring-brand-600' : 'hover:ring-1 hover:ring-brand-200'}`}
                  >
                    <span className="min-w-0">
                      <span className="block font-semibold text-slate-900 dark:text-slate-100">{s.name}</span>
                      {s.description && <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{s.description}</span>}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="font-display font-bold text-brand-600 dark:text-brand-300">${Number(s.price).toFixed(0)}</span>
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs font-bold ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 dark:border-slate-600'}`}>{on ? '✓' : ''}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {step === 'where' && (
            <div className="card space-y-3 !p-4">
              <div>
                <label htmlFor="qr-addr" className="label">{t('addressLabel')}</label>
                <AddressAutocomplete
                  inputId="qr-addr"
                  value={address}
                  onChange={setAddress}
                  onSelect={(d) => { if (d.zip) setZip(d.zip) }}
                />
              </div>
              <div>
                <label htmlFor="qr-zip" className="label">{t('zipLabel')}</label>
                <input id="qr-zip" inputMode="numeric" autoComplete="postal-code" maxLength={5} value={zip}
                  onChange={(e) => setZip(e.target.value.replace(/\D/g, ''))} className="input" placeholder="90026" />
              </div>
            </div>
          )}

          {step === 'you' && (
            <div className="card space-y-3 !p-4">
              <div>
                <label htmlFor="qr-name" className="label">{t('nameLabel')}</label>
                <input id="qr-name" autoComplete="name" value={name} onChange={(e) => { setName(e.target.value); setError('') }} className="input" />
              </div>
              <div>
                <label htmlFor="qr-email" className="label">{t('emailLabel')}</label>
                <input id="qr-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setError('') }} className="input" />
              </div>
              <div>
                <label htmlFor="qr-phone" className="label">{t('phoneLabel')}</label>
                <input id="qr-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setError('') }} className="input" placeholder="(555) 555-5555" />
              </div>
              <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-600 dark:text-slate-400">
                <input type="checkbox" checked={smsOptIn} onChange={(e) => { setSmsOptIn(e.target.checked); setError('') }}
                  className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-brand-600" />
                {tSms('smsOptInLabel')}
              </label>
              {/* Carrier-required disclaimers must sit right next to the
                  checkbox — same copy as CustomerSettings. */}
              <p className="pl-[1.625rem] text-xs text-slate-400 dark:text-slate-500">
                {tSms('smsDisclaimer')}{' '}
                <Link to="/terms" className="underline">{tSms('smsDisclaimerTerms')}</Link>
                {' · '}
                <Link to="/privacy" className="underline">{tSms('smsDisclaimerPrivacy')}</Link>
              </p>
              {isTurnstileConfigured && <Turnstile ref={captchaRef} onToken={setCaptchaToken} />}
            </div>
          )}

          {step === 'code' && (
            <div className="card space-y-3 !p-4">
              <label htmlFor="qr-code" className="label">{t('codeLabel')}</label>
              <input id="qr-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="input text-center font-mono text-2xl tracking-[0.4em]" placeholder="••••••" />
              <button type="button" onClick={() => { setCode(''); go('you') }} className="text-xs font-semibold text-brand-600 dark:text-brand-300">
                {t('changeEmail')}
              </button>
            </div>
          )}

          {step === 'finishing' && !error && (
            <div className="flex justify-center py-6" role="status">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">{error}</p>
        )}

        {step !== 'finishing' && (
          <div className="mt-6 flex gap-2">
            {step !== 'services' && step !== 'card' && (
              <button type="button" onClick={() => go(visibleSteps[stepIndex - 1])} disabled={busy} className="btn btn-outline">
                {t('back')}
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={{ card: () => go('services'), services: nextFromServices, where: nextFromWhere, you: sendCode, code: verifyCode }[step]}
              className="btn btn-cta flex-1"
            >
              {busy
                ? (step === 'code' ? t('verifying') : t('sending'))
                : { card: t('cardBook', { first }), services: selected.length ? `${t('next')} · $${Math.round(total)}` : t('next'), where: t('next'), you: t('sendCode'), code: t('verify') }[step]}
            </button>
          </div>
        )}

        <p className="mt-8 text-center text-xs text-slate-400">
          <Link to="/" className="hover:underline">{t('poweredBy')}</Link>
        </p>
      </div>
    </div>
  )
}
