import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import AppShell from '../components/AppShell'
import Modal from '../components/ui/Modal'
import MarketingTip from '../components/MarketingTip'
import { useStore } from '../context/StoreContext'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { CheckIcon, ShieldCheckIcon, CreditCardIcon, ClipboardCheckIcon, UsersIcon, PlusIcon, XIcon, LightbulbIcon, ClockIcon, StarIcon, SparklesIcon, CameraIcon, FileTextIcon, TagIcon } from '../components/icons'
import { InfoPopover } from '../components/ui/bits'
import { startIdentityVerification, startConnectOnboarding, isStripeConfigured, stripePromise } from '../lib/stripe'
import { fetchMyPayoutStatus, extractFlyerPrices } from '../lib/db'
import { readServicesDraft, writeServicesDraft, clearServicesDraft } from '../lib/onboardingDraft'
import { useT } from '../i18n/useT'

// Maps the real detailer_profiles.identity_status ('unverified' | 'pending' |
// 'verified' | 'failed') to this screen's local idStatus vocabulary.
function idStatusFromProfile(status) {
  if (status === 'verified') return 'passed'
  if (status === 'pending') return 'pending'
  if (status === 'failed') return 'failed'
  return 'idle'
}

// Per-service coaching shown when a detailer's added one of these by name
// (from the example template, or by typing the same name manually).
const SERVICE_ADVICE_KEYS = {
  'Interior Deep Clean': 'adviceInteriorDeepClean',
  'Pet Hair Removal': 'advicePetHairRemoval',
  'Ceramic Coating': 'adviceCeramicCoating',
  'Full Detail': 'adviceFullDetail',
}
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const STEP_KEYS = ['stepIdentity', 'stepInsurance', 'stepProfile', 'stepSurvey', 'stepServices', 'stepSchedule', 'stepPayout']

const YEARS_EXPERIENCE_OPTIONS = ['0-1', '1-3', '3-5', '5+']
const CERT_OPTIONS = ['ida_certified', 'manufacturer_trained']
const REFERRAL_OPTIONS = ['referral', 'social_media', 'google', 'word_of_mouth', 'other']
const EXAMPLE_TEMPLATE = { 'Exterior Wash': 45, 'Full Detail': 175, 'Interior Deep Clean': 85, 'Wax & Seal': 60 }

// Blueprint screens 4.2–4.8 — detailer onboarding wizard.
// Stripe Identity / Connect calls are simulated until Phase 4 wiring.
export default function DetailerOnboarding() {
  const navigate = useNavigate()
  const { isDemo, saveOnboarding, detailerProfile } = useStore()
  const { session } = useAuth()
  const draftUserId = isDemo ? null : session?.user?.id
  const { theme } = useTheme()
  const t = useT('detailerOnboarding')
  const STEPS = STEP_KEYS.map((k) => t(k))
  const pipOff = theme === 'dark' ? '#3f2d6e' : '#e9d5ff'
  const [step, setStep] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Step state
  // idle | scanning | pending (submitted to Stripe, awaiting the async
  // webhook result) | passed | failed. Picks up wherever a real account left
  // off (e.g. they started verification in an earlier session).
  const [idStatus, setIdStatus] = useState(() =>
    isDemo ? 'idle' : idStatusFromProfile(detailerProfile?.identity_status)
  )
  const [idError, setIdError] = useState('')
  const [confirmSkipId, setConfirmSkipId] = useState(false)
  const [showIdDataInfo, setShowIdDataInfo] = useState(false)
  const [insurance, setInsurance] = useState(null) // insured | none
  const [noInsuranceAck, setNoInsuranceAck] = useState(false)
  const [bio, setBio] = useState('')
  const [zip, setZip] = useState('')
  const [vehicles] = useState(['Sedan', 'SUV'])
  // Services step — picking a pricing path (flyer / template / manual) is a
  // separate choice from the prices themselves, and both are restored from a
  // localStorage draft so backing out or closing the tab mid-setup doesn't
  // lose the work (the wizard has no save button until final submit).
  const initialServicesDraft = () => readServicesDraft(draftUserId)
  const [serviceMethod, setServiceMethod] = useState(() => initialServicesDraft()?.serviceMethod ?? null)
  const [services, setServices] = useState(() => initialServicesDraft()?.services ?? {})
  // Which enabled service gets the single "Best margin" highlight (Von
  // Restorff — only one thing should visually stand out, and it should be
  // the detailer's own call, not a hardcoded guess at their pricing).
  const [featuredService, setFeaturedService] = useState(() => initialServicesDraft()?.featuredService ?? null)
  const [customName, setCustomName] = useState('')
  const [customPrice, setCustomPrice] = useState('')
  const [days, setDays] = useState(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])
  const [travel, setTravel] = useState(10)
  const [chargePerMile, setChargePerMile] = useState(2)
  const [bank, setBank] = useState('')
  const [payoutStatus, setPayoutStatus] = useState(null)
  const [connectingBank, setConnectingBank] = useState(false)
  const [connectError, setConnectError] = useState('')

  // Quick-survey step — every field optional, none block continuing.
  const [yearsExperience, setYearsExperience] = useState(null)
  const [equipmentType, setEquipmentType] = useState(null)
  const [certifications, setCertifications] = useState([])
  const [teamSize, setTeamSize] = useState(null)
  const [referralSource, setReferralSource] = useState(null)

  const [flyerBusy, setFlyerBusy] = useState(false)
  const [flyerError, setFlyerError] = useState('')

  async function handleFlyerUpload(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { setFlyerError(t('flyerNotImage')); return }
    setFlyerError('')
    setFlyerBusy(true)
    try {
      const extracted = await extractFlyerPrices(file)
      setServices(Object.fromEntries(extracted.map((s) => [s.name, s.price])))
      setFeaturedService(null)
    } catch (err) {
      setFlyerError(err.message || t('flyerExtractFailed'))
    } finally {
      setFlyerBusy(false)
    }
  }

  function applyExampleTemplate() {
    setServices(EXAMPLE_TEMPLATE)
    setFeaturedService(null)
    setServiceMethod('template')
  }

  // Persist the pricing-path draft so it survives Back navigation and
  // closing the tab entirely, until onboarding is actually submitted.
  useEffect(() => {
    if (!draftUserId) return
    writeServicesDraft(draftUserId, { serviceMethod, services, featuredService })
  }, [draftUserId, serviceMethod, services, featuredService])

  useEffect(() => {
    if (isDemo) return
    fetchMyPayoutStatus().then(setPayoutStatus)
  }, [isDemo])

  async function handleConnectBank() {
    setConnectError('')
    setConnectingBank(true)
    try {
      const url = await startConnectOnboarding()
      window.location.assign(url)
    } catch (e) {
      setConnectingBank(false)
      setConnectError(e.message || t('idStartError'))
    }
  }

  function addCustomService() {
    const name = customName.trim()
    const price = Number(customPrice)
    if (!name || !price || price <= 0 || name in services) return
    setServices((s) => ({ ...s, [name]: price }))
    setCustomName('')
    setCustomPrice('')
  }

  function removeService(name) {
    setServices((s) => {
      const next = { ...s }
      delete next[name]
      return next
    })
    setFeaturedService((f) => (f === name ? null : f))
  }

  async function runIdCheck() {
    setIdError('')
    // Demo has no real Stripe/Supabase behind it — keep the fast simulated
    // pass so the blueprint walkthrough stays fully interactive.
    if (isDemo) {
      setIdStatus('scanning')
      setTimeout(() => setIdStatus('passed'), 1800)
      return
    }
    setIdStatus('scanning')
    try {
      const clientSecret = await startIdentityVerification()
      const stripe = await stripePromise
      const { error } = await stripe.verifyIdentity(clientSecret)
      if (error) {
        // User closed the modal or it errored client-side — Stripe hasn't
        // necessarily rejected them, just let them retry from idle.
        setIdStatus('idle')
        setIdError(error.message)
        return
      }
      // Submitted successfully — Stripe reviews async (usually seconds to a
      // couple minutes) and the real pass/fail lands via the stripe-webhook
      // function, which flips detailer_profiles.identity_status. Nothing
      // more to do here but wait; the wizard can proceed in the meantime.
      setIdStatus('pending')
    } catch (e) {
      setIdStatus('idle')
      setIdError(e.message || t('idStartError'))
    }
  }

  async function handleSubmit() {
    // Demo mode never touches the DB — just show the success screen.
    if (isDemo) {
      setSubmitted(true)
      return
    }
    setSaving(true)
    setSaveError('')
    try {
      await saveOnboarding({
        bio,
        zip,
        insurance,
        vehicles,
        services,
        freeTravelMiles: travel,
        chargePerMile,
        serviceDays: days,
        featuredService,
        yearsExperience,
        equipmentType,
        certifications,
        teamSize,
        referralSource,
      })
      clearServicesDraft(draftUserId)
      setSubmitted(true)
    } catch (e) {
      setSaveError(e?.message || t('saveApplicationError'))
    } finally {
      setSaving(false)
    }
  }

  function toggle(list, setList, item) {
    setList(list.includes(item) ? list.filter((x) => x !== item) : [...list, item])
  }

  const canContinue = [
    // Identity verification is skippable — Stripe Connect gates the actual
    // payout on it later, so it doesn't need to block the wizard too — but
    // Continue itself stays disabled until they've actually taken one of
    // the two explicit actions (Upload ID & selfie, or Skip for now).
    idStatus !== 'idle',
    insurance === 'insured' || (insurance === 'none' && noInsuranceAck),
    bio.length > 0 && zip.length === 5,
    true, // Survey step — every question is optional, never blocks.
    Object.keys(services).length > 0,
    days.length > 0,
    // Real payout connection is a redirect-away Stripe flow, not something
    // that can gate synchronous submission — the wizard doesn't send `bank`
    // to the backend at all (submit_detailer_onboarding never takes it).
    // Demo keeps the fake digits gate so the simulated flow still feels real.
    isDemo ? bank.length >= 4 : true,
  ][step]

  if (submitted) {
    return (
      <AppShell role="detailer" locked>
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 12 }}
            className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-brand-600 text-white shadow-xl"
          >
            <ClipboardCheckIcon className="h-10 w-10" />
          </motion.span>
          <h1 className="mt-6 font-display text-3xl font-bold text-slate-900 dark:text-slate-100">
            {t('submittedTitle')}
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">{t('whatsNext')}</p>
          <ol className="mt-6 space-y-3 text-left">
            {[
              [t('nextInsurance'), t('nextInsuranceSub')],
              [
                t('nextId'),
                idStatus === 'passed' ? t('nextIdDonePassed') : t('nextIdPending'),
              ],
              [t('nextApproval'), t('nextApprovalSub')],
            ].map(([title, sub], i) => (
              <motion.li
                key={title}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.15 }}
                className="card flex items-center gap-3 !p-4"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 font-display text-sm font-bold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                  {i + 1}
                </span>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{sub}</p>
                </div>
              </motion.li>
            ))}
          </ol>
          <button onClick={() => navigate('/detailer')} className="btn btn-cta mt-8 w-full">
            {isDemo ? t('demoSkipReview') : t('goToDashboard')}
          </button>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell role="detailer" locked>
      <div className="mx-auto max-w-xl px-4 py-8 sm:px-6">
        {/* No "back to dashboard" escape while onboarding is locked (see
            AppShell's `locked` doc comment) — a brand-new detailer finishes
            this before touching anything else. */}
        <h1 className="mt-3 font-display text-2xl font-bold text-slate-900 dark:text-slate-100">{t('title')}</h1>

        {/* Step rail */}
        <div className="mt-4 flex items-center gap-1.5" aria-label={t('stepAria', { n: step + 1, total: STEPS.length, step: STEPS[step] })}>
          {STEPS.map((s, i) => (
            <motion.div
              key={s}
              animate={{ backgroundColor: i <= step ? '#f40076' : pipOff }}
              className="h-1.5 flex-1 rounded-full"
            />
          ))}
        </div>
        <p className="mt-1.5 text-xs font-semibold text-brand-700 dark:text-brand-300">
          {step + 1}/{STEPS.length} · {STEPS[step]}
        </p>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="mt-6"
          >
            {step === 0 && (
              <div className="space-y-4">
                <MarketingTip title={t('tipVerifiedTitle')}>
                  {t('tipVerifiedBody')}
                </MarketingTip>
                <div className="card text-center">
                <UsersIcon className="mx-auto h-10 w-10 text-brand-600 dark:text-brand-300" />
                <h2 className="mt-3 flex items-center justify-center gap-1.5 font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {t('verifyIdentity')}
                  <InfoPopover label={t('whyIdLabel')}>
                    {t('whyIdBody')}
                  </InfoPopover>
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {t('idBlurb')}
                </p>
                {(idStatus === 'idle' || idStatus === 'failed') && (
                  <>
                    {!isDemo && !isStripeConfigured ? (
                      <p className="mt-5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                        {t('idNotConfigured')}
                      </p>
                    ) : (
                      <>
                        {idStatus === 'failed' && (
                          <p className="mt-5 text-sm font-medium text-red-600 dark:text-red-400">
                            {t('idFailedRetry')}
                          </p>
                        )}
                        <button onClick={runIdCheck} className="btn btn-brand mt-3">
                          {idStatus === 'failed' ? t('tryAgain') : t('uploadIdSelfie')}
                        </button>
                      </>
                    )}
                    {idError && (
                      <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{idError}</p>
                    )}
                    <button
                      onClick={() => setConfirmSkipId(true)}
                      className="mt-3 block w-full text-sm font-semibold text-slate-500 underline-offset-2 hover:underline dark:text-slate-400"
                    >
                      {t('skipIdForNow')}
                    </button>
                  </>
                )}
                {idStatus === 'scanning' && (
                  <div className="mt-5" role="status" aria-label={t('verifyingAria')}>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                      className="mx-auto h-10 w-10 rounded-full border-4 border-brand-200 border-t-brand-600 dark:border-brand-500/20 dark:border-t-brand-400"
                    />
                    <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{t('matchingSelfie')}</p>
                  </div>
                )}
                {idStatus === 'pending' && (
                  <div className="mt-5">
                    <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                      <ClockIcon className="h-6 w-6" />
                    </span>
                    <p className="mt-2 font-semibold text-amber-700 dark:text-amber-400">{t('submittedUnderReview')}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {t('stripeConfirming')}
                    </p>
                  </div>
                )}
                {idStatus === 'passed' && (
                  <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mt-5">
                    <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-cta-700 text-white">
                      <CheckIcon className="h-6 w-6" />
                    </span>
                    <p className="mt-2 font-semibold text-cta-700 dark:text-cta-400">{t('verified')}</p>
                  </motion.div>
                )}
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-3">
                <MarketingTip title={t('tipInsuranceTitle')}>
                  {t('tipInsuranceBody')}
                </MarketingTip>
                <div className="flex items-center gap-1.5 px-1">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('chooseCoverage')}</p>
                  <InfoPopover label={t('whyInsuranceLabel')}>
                    {t('whyInsuranceBody')}
                  </InfoPopover>
                </div>
                <div className="space-y-3" role="radiogroup" aria-label={t('insuranceLevelAria')}>
                {[
                  ['insured', t('insuranceYesTitle'), t('insuranceYesSub')],
                  ['none', t('insuranceNoneTitle'), t('insuranceNoneSub')],
                ].map(([value, title, sub]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={insurance === value}
                    onClick={() => setInsurance(value)}
                    className={`card flex w-full cursor-pointer items-start gap-3 !p-5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
                      insurance === value ? 'border-brand-600 ring-2 ring-brand-200 dark:ring-brand-500/20' : 'hover:border-brand-300'
                    }`}
                  >
                    <ShieldCheckIcon className={`mt-0.5 h-5 w-5 shrink-0 ${value === 'none' ? 'text-red-500 dark:text-red-400' : 'text-brand-600 dark:text-brand-300'}`} />
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{title}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{sub}</p>
                    </div>
                  </button>
                ))}
                </div>
                {insurance === 'insured' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="card !p-5">
                    <label className="label" htmlFor="cert">{t('certUploadLabel')}</label>
                    <input id="cert" type="file" className="text-sm text-slate-600 file:btn file:btn-outline file:mr-3 file:h-9 file:px-3 file:text-xs dark:text-slate-400" />
                    <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">{t('certUploadHint')}</p>
                  </motion.div>
                )}
                {insurance === 'none' && (
                  <motion.label initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card flex cursor-pointer items-start gap-2 !p-5 text-sm text-slate-700 dark:text-slate-300">
                    <input type="checkbox" checked={noInsuranceAck} onChange={(e) => setNoInsuranceAck(e.target.checked)} className="mt-0.5 h-4 w-4 cursor-pointer accent-brand-600" />
                    {t('noInsuranceAck')}
                  </motion.label>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <MarketingTip title={t('tipBioTitle')}>
                  {t('tipBioBody')}
                </MarketingTip>
                <div className="card space-y-4">
                <div>
                  <label htmlFor="ob-bio" className="label">{t('bioLabel', { count: 250 - bio.length })}</label>
                  <textarea id="ob-bio" maxLength={250} rows={3} value={bio} onChange={(e) => setBio(e.target.value)} className="input h-auto resize-none py-2" placeholder={t('bioPlaceholder')} />
                </div>
                <div>
                  <label htmlFor="ob-zip" className="label">{t('homeZipLabel')}</label>
                  <input id="ob-zip" inputMode="numeric" maxLength={5} value={zip} onChange={(e) => setZip(e.target.value.replace(/\D/g, ''))} className="input w-32" placeholder="90026" />
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    {t('zipHint')}
                  </p>
                </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <MarketingTip title={t('tipSurveyTitle')}>
                  {t('tipSurveyBody')}
                </MarketingTip>

                <div className="card space-y-5">
                  <div>
                    <p className="label">{t('yearsExperienceLabel')}</p>
                    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('yearsExperienceLabel')}>
                      {YEARS_EXPERIENCE_OPTIONS.map((v) => (
                        <button key={v} type="button" role="radio" aria-checked={yearsExperience === v}
                          onClick={() => setYearsExperience(yearsExperience === v ? null : v)}
                          className={`cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
                            yearsExperience === v ? 'bg-brand-600 text-white shadow-md' : 'bg-brand-50 text-slate-600 hover:bg-brand-100 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10'
                          }`}>
                          {t(`years_${v.replace('+', 'plus').replace('-', '_')}`)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="label">{t('equipmentLabel')}</p>
                    <div className="space-y-2" role="radiogroup" aria-label={t('equipmentLabel')}>
                      {['mobile_rig', 'customer_utilities'].map((v) => (
                        <button key={v} type="button" role="radio" aria-checked={equipmentType === v}
                          onClick={() => setEquipmentType(equipmentType === v ? null : v)}
                          className={`flex w-full cursor-pointer items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
                            equipmentType === v ? 'bg-brand-50 text-brand-800 ring-1 ring-brand-300 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-500/30' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10'
                          }`}>
                          {t(`equipment_${v}`)}
                          {equipmentType === v && <CheckIcon className="h-4 w-4 shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="label">{t('certificationsLabel')}</p>
                    <div className="flex flex-wrap gap-2">
                      {CERT_OPTIONS.map((v) => (
                        <button key={v} type="button" aria-pressed={certifications.includes(v)}
                          onClick={() => toggle(certifications, setCertifications, v)}
                          className={`cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
                            certifications.includes(v) ? 'bg-brand-600 text-white shadow-md' : 'bg-brand-50 text-slate-600 hover:bg-brand-100 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10'
                          }`}>
                          {t(`cert_${v}`)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="label">{t('teamSizeLabel')}</p>
                    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('teamSizeLabel')}>
                      {['solo', 'team'].map((v) => (
                        <button key={v} type="button" role="radio" aria-checked={teamSize === v}
                          onClick={() => setTeamSize(teamSize === v ? null : v)}
                          className={`cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
                            teamSize === v ? 'bg-brand-600 text-white shadow-md' : 'bg-brand-50 text-slate-600 hover:bg-brand-100 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10'
                          }`}>
                          {t(`teamSize_${v}`)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="ob-referral" className="label">{t('referralLabel')}</label>
                    <select id="ob-referral" value={referralSource ?? ''} onChange={(e) => setReferralSource(e.target.value || null)} className="input">
                      <option value="">{t('referralPlaceholder')}</option>
                      {REFERRAL_OPTIONS.map((v) => (
                        <option key={v} value={v}>{t(`referral_${v}`)}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-2">
                <MarketingTip title={t('tipPriceTitle')}>
                  {t('tipPriceBody')}
                </MarketingTip>

                {!serviceMethod ? (
                  <div className="space-y-3">
                    {[
                      ['flyer', CameraIcon, 'methodFlyerTitle', 'methodFlyerBody'],
                      ['template', FileTextIcon, 'methodTemplateTitle', 'methodTemplateBody'],
                      ['manual', TagIcon, 'methodManualTitle', 'methodManualBody'],
                    ].map(([method, Icon, titleKey, bodyKey]) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => (method === 'template' ? applyExampleTemplate() : setServiceMethod(method))}
                        className="card flex w-full cursor-pointer items-start gap-3 !p-5 text-left transition-all duration-200 hover:border-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                      >
                        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-600 dark:text-brand-300" />
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-slate-100">{t(titleKey)}</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">{t(bodyKey)}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <>
                    {serviceMethod === 'flyer' && (
                      <div className="card space-y-3 border-brand-300 !p-4 dark:border-brand-400/40">
                        <div className="flex items-start gap-2">
                          <SparklesIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand-600 dark:text-brand-300" />
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-slate-100">{t('flyerPromptTitle')}</p>
                            <p className="text-sm text-slate-600 dark:text-slate-400">{t('flyerPromptBody')}</p>
                          </div>
                        </div>
                        {flyerError && (
                          <p role="alert" className="text-sm text-red-600 dark:text-red-400">{flyerError}</p>
                        )}
                        <label className={`btn btn-brand inline-flex cursor-pointer ${flyerBusy ? 'pointer-events-none opacity-70' : ''}`}>
                          {flyerBusy
                            ? <span className="inline-flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />{t('flyerScanning')}</span>
                            : <span className="inline-flex items-center gap-2"><CameraIcon className="h-4 w-4" />{Object.keys(services).length > 0 ? t('flyerUploadAgainCta') : t('flyerUploadCta')}</span>}
                          <input type="file" accept="image/*" className="hidden" onChange={handleFlyerUpload} disabled={flyerBusy} />
                        </label>
                      </div>
                    )}

                    {Object.keys(services).length > 0 && (
                      <div className="space-y-2 pt-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                          {t('yourServices')}
                        </p>
                        <AnimatePresence>
                          {Object.keys(services).map((name) => {
                            const advice = SERVICE_ADVICE_KEYS[name] ? t(SERVICE_ADVICE_KEYS[name]) : null
                            const isBestMargin = name === featuredService
                            return (
                              <motion.div
                                key={name}
                                layout
                                initial={{ opacity: 0, y: -6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                                className={`card !p-4 transition-colors duration-200 ${isBestMargin ? 'ring-1 ring-amber-300 dark:ring-amber-500/30' : ''}`}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <span className="min-w-0 truncate font-medium text-slate-900 dark:text-slate-100">{name}</span>
                                  <div className="flex shrink-0 items-center gap-1">
                                    <span className="text-slate-500 dark:text-slate-400">$</span>
                                    <input type="number" min={1} aria-label={t('priceAria', { name })} value={services[name]}
                                      onChange={(e) => setServices((s) => ({ ...s, [name]: Number(e.target.value) }))}
                                      className="input h-9 w-20" />
                                    <button type="button" aria-label={t('removeService', { name })} onClick={() => removeService(name)}
                                      className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-400 transition-colors duration-200 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:hover:bg-red-500/10 dark:hover:text-red-400">
                                      <XIcon className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                                <div className="mt-2 flex items-center justify-between gap-3 border-t border-brand-100 pt-2 dark:border-white/10">
                                  {advice ? (
                                    <p className="flex gap-1.5 text-xs text-brand-700 dark:text-brand-300">
                                      <LightbulbIcon className="h-3.5 w-3.5 shrink-0" />
                                      {advice}
                                    </p>
                                  ) : <span />}
                                  <button
                                    type="button"
                                    onClick={() => setFeaturedService((f) => (f === name ? null : name))}
                                    aria-pressed={isBestMargin}
                                    title={isBestMargin ? t('unmarkBestMargin') : t('markBestMarginTitle')}
                                    className={`flex shrink-0 cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
                                      isBestMargin
                                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
                                        : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-white/5 dark:hover:text-slate-300'
                                    }`}
                                  >
                                    <StarIcon className="h-3.5 w-3.5" />
                                    {isBestMargin ? t('bestMargin') : t('markAsBestMargin')}
                                  </button>
                                </div>
                              </motion.div>
                            )
                          })}
                        </AnimatePresence>
                      </div>
                    )}

                    {/* Add a service */}
                    <div className="card !p-4">
                      <p className="label">{t('addOwnService')}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          aria-label={t('customServiceNameAria')}
                          value={customName}
                          onChange={(e) => setCustomName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomService())}
                          placeholder={t('customServiceNamePlaceholder')}
                          className="input h-10 min-w-0 flex-1"
                        />
                        <div className="flex items-center gap-1">
                          <span className="text-slate-500 dark:text-slate-400">$</span>
                          <input
                            type="number"
                            min={1}
                            aria-label={t('customServicePriceAria')}
                            value={customPrice}
                            onChange={(e) => setCustomPrice(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomService())}
                            placeholder="0"
                            className="input h-10 w-20"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={addCustomService}
                          disabled={!customName.trim() || !Number(customPrice)}
                          className="btn btn-brand h-10 px-4 text-sm"
                        >
                          <PlusIcon className="h-4 w-4" /> {t('add')}
                        </button>
                      </div>
                      <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                        {t('addServiceHint')}
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}

            {step === 5 && (
              <div className="space-y-4">
                <MarketingTip title={t('tipTravelTitle')}>
                  {t('tipTravelBody')}
                </MarketingTip>
                <div className="card space-y-5">
                <div>
                  <p className="label">{t('serviceDays')}</p>
                  <div className="flex flex-wrap gap-2">
                    {DAYS.map((day) => (
                      <button key={day} type="button" aria-pressed={days.includes(day)} onClick={() => toggle(days, setDays, day)}
                        className={`cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
                          days.includes(day) ? 'bg-brand-600 text-white shadow-md' : 'bg-brand-50 text-slate-600 hover:bg-brand-100 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10'
                        }`}>
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label htmlFor="ob-travel" className="label">{t('freeTravelRadius', { miles: travel })}</label>
                  <input id="ob-travel" type="range" min={1} max={30} value={travel} onChange={(e) => setTravel(Number(e.target.value))} className="w-full cursor-pointer accent-brand-600" />
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{t('freeTravelHint', { miles: travel })}</p>
                </div>
                <div>
                  <label htmlFor="ob-mile" className="label">{t('chargePerMile', { miles: travel })}</label>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500 dark:text-slate-400">$</span>
                    <input id="ob-mile" type="number" min={0} step={0.5} value={chargePerMile}
                      onChange={(e) => setChargePerMile(Number(e.target.value))} className="input h-10 w-24" />
                    <span className="text-sm text-slate-500 dark:text-slate-400">{t('perMile')}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    {t('chargePerMileHint')}
                  </p>
                </div>
                </div>
              </div>
            )}

            {step === 6 && (
              <div className="space-y-4">
                <MarketingTip title={t('tipPayoutTitle')}>
                  {t('tipPayoutBody')}
                </MarketingTip>
                <div className="card space-y-4">
                <div className="flex items-center gap-3">
                  <CreditCardIcon className="h-8 w-8 text-brand-600 dark:text-brand-300" />
                  <div>
                    <h2 className="flex items-center gap-1.5 font-display font-semibold text-slate-900 dark:text-slate-100">
                      {t('payoutSetup')}
                      <InfoPopover label={t('whyTaxInfoLabel')}>
                        {t('whyTaxInfoBody')}
                      </InfoPopover>
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{t('payoutSetupBlurb')}</p>
                  </div>
                </div>
                {isDemo ? (
                  <>
                    <div>
                      <label htmlFor="ob-bank" className="label">{t('bankLabel')}</label>
                      <input id="ob-bank" inputMode="numeric" maxLength={4} value={bank} onChange={(e) => setBank(e.target.value.replace(/\D/g, ''))} className="input w-32" placeholder="4242" />
                    </div>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {t('payoutRealFlow')}
                    </p>
                  </>
                ) : (
                  <>
                    {!isStripeConfigured ? (
                      <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                        {t('idNotConfigured')}
                      </p>
                    ) : payoutStatus?.stripe_charges_enabled ? (
                      <p className="flex items-center gap-2 text-sm font-medium text-cta-700 dark:text-cta-400">
                        <CheckIcon className="h-4 w-4" /> {t('bankConnected')}
                      </p>
                    ) : (
                      <>
                        <button type="button" onClick={handleConnectBank} disabled={connectingBank} className="btn btn-brand">
                          {connectingBank
                            ? <span className="inline-flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />{t('connecting')}</span>
                            : t('connectBank')}
                        </button>
                        {payoutStatus?.stripe_account_id && (
                          <p className="text-xs text-amber-600 dark:text-amber-400">{t('bankPending')}</p>
                        )}
                      </>
                    )}
                    {connectError && (
                      <p role="alert" className="text-sm text-red-600 dark:text-red-400">{connectError}</p>
                    )}
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {t('payoutRealFlow')}
                    </p>
                  </>
                )}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {saveError && (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
            {saveError}
          </p>
        )}

        <div className="mt-6 flex gap-2">
          {step > 0 && (
            <button
              onClick={() => (step === 4 && serviceMethod ? setServiceMethod(null) : setStep(step - 1))}
              disabled={saving}
              className="btn btn-outline"
            >
              {t('back')}
            </button>
          )}
          <button
            onClick={() => (step === STEPS.length - 1 ? handleSubmit() : setStep(step + 1))}
            disabled={!canContinue || saving}
            className="btn btn-brand flex-1"
          >
            {step === STEPS.length - 1
              ? saving
                ? t('submitting')
                : t('submitApplication')
              : t('continue')}
          </button>
        </div>
      </div>

      <Modal open={confirmSkipId} onClose={() => setConfirmSkipId(false)} labelledBy="skip-id-title">
        <div className="p-5 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
            <ClockIcon className="h-6 w-6" />
          </span>
          <h2 id="skip-id-title" className="mt-3 font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
            {t('skipIdModalTitle')}
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{t('skipIdNote')}</p>
          <button
            type="button"
            onClick={() => setShowIdDataInfo((s) => !s)}
            aria-expanded={showIdDataInfo}
            className="mt-3 text-xs font-semibold text-brand-600 underline-offset-2 hover:underline dark:text-brand-300"
          >
            {t('skipIdDataLabel')}
          </button>
          {showIdDataInfo && (
            <p className="mt-2 rounded-lg bg-brand-50 px-3 py-2 text-left text-xs leading-relaxed text-slate-600 dark:bg-white/5 dark:text-slate-300">
              {t('skipIdDataBody')}
            </p>
          )}
          <div className="mt-5 flex gap-2">
            <button onClick={() => setConfirmSkipId(false)} className="btn btn-outline flex-1">
              {t('skipIdGoBack')}
            </button>
            <button
              onClick={() => {
                setConfirmSkipId(false)
                setStep(1)
              }}
              className="btn btn-brand flex-1"
            >
              {t('skipIdConfirm')}
            </button>
          </div>
        </div>
      </Modal>
    </AppShell>
  )
}
