import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import AppShell from '../components/AppShell'
import { CheckIcon, ShieldCheckIcon, CreditCardIcon, ClipboardCheckIcon, UsersIcon, ChevronLeftIcon } from '../components/icons'

const SERVICE_MENU = [
  'Exterior Wash', 'Interior Deep Clean', 'Full Detail', 'Wax & Seal',
  'Ceramic Coating', 'Pet Hair Removal', 'Engine Bay Clean', 'Headlight Restoration',
]
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const VEHICLES = ['Sedan', 'SUV', 'Truck', 'Coupe', 'Van']

const STEPS = ['Identity', 'Insurance', 'Profile', 'Services', 'Schedule', 'Payout']

// Blueprint screens 4.2–4.8 — detailer onboarding wizard.
// Stripe Identity / Connect calls are simulated until Phase 4 wiring.
export default function DetailerOnboarding() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [submitted, setSubmitted] = useState(false)

  // Step state
  const [idStatus, setIdStatus] = useState('idle') // idle | scanning | passed
  const [insurance, setInsurance] = useState(null) // premium | standard | none
  const [noInsuranceAck, setNoInsuranceAck] = useState(false)
  const [bio, setBio] = useState('')
  const [zip, setZip] = useState('')
  const [vehicles, setVehicles] = useState(['Sedan', 'SUV'])
  const [services, setServices] = useState({ 'Exterior Wash': 45, 'Full Detail': 175 })
  const [days, setDays] = useState(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])
  const [travel, setTravel] = useState(10)
  const [bank, setBank] = useState('')

  function runIdCheck() {
    setIdStatus('scanning')
    setTimeout(() => setIdStatus('passed'), 1800)
  }

  function toggle(list, setList, item) {
    setList(list.includes(item) ? list.filter((x) => x !== item) : [...list, item])
  }

  function toggleService(name) {
    setServices((s) => {
      const next = { ...s }
      if (name in next) delete next[name]
      else next[name] = 50
      return next
    })
  }

  const canContinue = [
    idStatus === 'passed',
    insurance === 'premium' || insurance === 'standard' || (insurance === 'none' && noInsuranceAck),
    bio.length > 0 && zip.length === 5 && vehicles.length > 0,
    Object.keys(services).length > 0,
    days.length > 0,
    bank.length >= 4,
  ][step]

  if (submitted) {
    return (
      <AppShell role="detailer">
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 12 }}
            className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-brand-600 text-white shadow-xl"
          >
            <ClipboardCheckIcon className="h-10 w-10" />
          </motion.span>
          <h1 className="mt-6 font-display text-3xl font-bold text-slate-900">
            Application submitted
          </h1>
          <p className="mt-2 text-slate-600">Here&apos;s what happens next:</p>
          <ol className="mt-6 space-y-3 text-left">
            {[
              ['Insurance docs reviewed', '1–2 business days'],
              ['ID verification processed', 'Done — passed'],
              ['Approval email sent', 'Then your first 5 jobs are quality-reviewed'],
            ].map(([title, sub], i) => (
              <motion.li
                key={title}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.15 }}
                className="card flex items-center gap-3 !p-4"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 font-display text-sm font-bold text-brand-700">
                  {i + 1}
                </span>
                <div>
                  <p className="font-semibold text-slate-900">{title}</p>
                  <p className="text-xs text-slate-500">{sub}</p>
                </div>
              </motion.li>
            ))}
          </ol>
          <button onClick={() => navigate('/detailer')} className="btn btn-cta mt-8 w-full">
            Demo: skip review → approved
          </button>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell role="detailer">
      <div className="mx-auto max-w-xl px-4 py-8 sm:px-6">
        <Link
          to="/detailer"
          className="mb-3 inline-flex items-center gap-1 rounded text-sm font-medium text-slate-600 transition-colors duration-200 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
        >
          <ChevronLeftIcon className="h-4 w-4" /> Dashboard
        </Link>
        <h1 className="font-display text-2xl font-bold text-slate-900">Detailer onboarding</h1>

        {/* Step rail */}
        <div className="mt-4 flex items-center gap-1.5" aria-label={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}>
          {STEPS.map((s, i) => (
            <motion.div
              key={s}
              animate={{ backgroundColor: i <= step ? '#7c3aed' : '#e9d5ff' }}
              className="h-1.5 flex-1 rounded-full"
            />
          ))}
        </div>
        <p className="mt-1.5 text-xs font-semibold text-brand-700">
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
              <div className="card text-center">
                <UsersIcon className="mx-auto h-10 w-10 text-brand-600" />
                <h2 className="mt-3 font-display text-lg font-semibold text-slate-900">
                  Verify your identity
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Government photo ID + selfie match, handled by Stripe Identity.
                </p>
                {idStatus === 'idle' && (
                  <button onClick={runIdCheck} className="btn btn-brand mt-5">
                    Upload ID & take selfie
                  </button>
                )}
                {idStatus === 'scanning' && (
                  <div className="mt-5" role="status" aria-label="Verifying">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                      className="mx-auto h-10 w-10 rounded-full border-4 border-brand-200 border-t-brand-600"
                    />
                    <p className="mt-3 text-sm text-slate-500">Matching selfie to ID…</p>
                  </div>
                )}
                {idStatus === 'passed' && (
                  <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mt-5">
                    <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-cta-700 text-white">
                      <CheckIcon className="h-6 w-6" />
                    </span>
                    <p className="mt-2 font-semibold text-cta-700">Verified</p>
                  </motion.div>
                )}
              </div>
            )}

            {step === 1 && (
              <div className="space-y-3" role="radiogroup" aria-label="Insurance level">
                {[
                  ['premium', 'Full business insurance', 'Gold badge · priority placement · instant payouts sooner'],
                  ['standard', 'Light insurance', 'Silver badge on your profile'],
                  ['none', 'No insurance', 'Red warning shown to customers; they must accept liability'],
                ].map(([value, title, sub]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={insurance === value}
                    onClick={() => setInsurance(value)}
                    className={`card flex w-full cursor-pointer items-start gap-3 !p-5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
                      insurance === value ? 'border-brand-600 ring-2 ring-brand-200' : 'hover:border-brand-300'
                    }`}
                  >
                    <ShieldCheckIcon className={`mt-0.5 h-5 w-5 shrink-0 ${value === 'none' ? 'text-red-500' : 'text-brand-600'}`} />
                    <div>
                      <p className="font-semibold text-slate-900">{title}</p>
                      <p className="text-sm text-slate-600">{sub}</p>
                    </div>
                  </button>
                ))}
                {(insurance === 'premium' || insurance === 'standard') && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="card !p-5">
                    <label className="label" htmlFor="cert">Certificate upload (provider, policy #, expiry)</label>
                    <input id="cert" type="file" className="text-sm text-slate-600 file:btn file:btn-outline file:mr-3 file:h-9 file:px-3 file:text-xs" />
                    <p className="mt-2 text-xs text-slate-400">Docs go to the admin review queue.</p>
                  </motion.div>
                )}
                {insurance === 'none' && (
                  <motion.label initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card flex cursor-pointer items-start gap-2 !p-5 text-sm text-slate-700">
                    <input type="checkbox" checked={noInsuranceAck} onChange={(e) => setNoInsuranceAck(e.target.checked)} className="mt-0.5 h-4 w-4 cursor-pointer accent-brand-600" />
                    I confirm I have no business insurance and understand customers see a warning before booking me.
                  </motion.label>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="card space-y-4">
                <div>
                  <label htmlFor="ob-bio" className="label">Bio ({250 - bio.length} left)</label>
                  <textarea id="ob-bio" maxLength={250} rows={3} value={bio} onChange={(e) => setBio(e.target.value)} className="input h-auto resize-none py-2" placeholder="What makes your detailing great?" />
                </div>
                <div>
                  <label htmlFor="ob-zip" className="label">Home zip code</label>
                  <input id="ob-zip" inputMode="numeric" maxLength={5} value={zip} onChange={(e) => setZip(e.target.value.replace(/\D/g, ''))} className="input w-32" placeholder="90026" />
                  <p className="mt-1 text-xs text-slate-400">
                    Used to place your map pin at a random spot in your zip — your exact address is never shown.
                  </p>
                </div>
                <div>
                  <p className="label">Vehicle types you accept</p>
                  <div className="flex flex-wrap gap-2">
                    {VEHICLES.map((v) => (
                      <button key={v} type="button" aria-pressed={vehicles.includes(v)} onClick={() => toggle(vehicles, setVehicles, v)}
                        className={`cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
                          vehicles.includes(v) ? 'bg-brand-600 text-white shadow-md' : 'bg-brand-50 text-slate-600 hover:bg-brand-100'
                        }`}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-2">
                {SERVICE_MENU.map((name) => {
                  const on = name in services
                  return (
                    <div key={name} className={`card flex items-center justify-between gap-3 !p-4 transition-colors duration-200 ${on ? 'border-brand-400' : ''}`}>
                      <button type="button" aria-pressed={on} onClick={() => toggleService(name)}
                        className="flex cursor-pointer items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600">
                        <motion.span animate={{ backgroundColor: on ? '#7c3aed' : '#e9d5ff' }} className="flex h-6 w-10 items-center rounded-full p-0.5">
                          <motion.span animate={{ x: on ? 16 : 0 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }} className="h-5 w-5 rounded-full bg-white shadow" />
                        </motion.span>
                        <span className={`font-medium ${on ? 'text-slate-900' : 'text-slate-500'}`}>{name}</span>
                      </button>
                      {on && (
                        <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-1">
                          <span className="text-slate-500">$</span>
                          <input type="number" min={10} aria-label={`${name} price`} value={services[name]}
                            onChange={(e) => setServices((s) => ({ ...s, [name]: Number(e.target.value) }))}
                            className="input h-9 w-20" />
                        </motion.div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {step === 4 && (
              <div className="card space-y-5">
                <div>
                  <p className="label">Service days</p>
                  <div className="flex flex-wrap gap-2">
                    {DAYS.map((day) => (
                      <button key={day} type="button" aria-pressed={days.includes(day)} onClick={() => toggle(days, setDays, day)}
                        className={`cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
                          days.includes(day) ? 'bg-brand-600 text-white shadow-md' : 'bg-brand-50 text-slate-600 hover:bg-brand-100'
                        }`}>
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label htmlFor="ob-travel" className="label">Free travel radius: {travel} miles</label>
                  <input id="ob-travel" type="range" min={1} max={30} value={travel} onChange={(e) => setTravel(Number(e.target.value))} className="w-full cursor-pointer accent-brand-600" />
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="card space-y-4">
                <div className="flex items-center gap-3">
                  <CreditCardIcon className="h-8 w-8 text-brand-600" />
                  <div>
                    <h2 className="font-display font-semibold text-slate-900">Payout setup</h2>
                    <p className="text-sm text-slate-600">Stripe Connect — bank + W-9 for 1099 reporting.</p>
                  </div>
                </div>
                <div>
                  <label htmlFor="ob-bank" className="label">Bank account (last 4 digits — demo)</label>
                  <input id="ob-bank" inputMode="numeric" maxLength={4} value={bank} onChange={(e) => setBank(e.target.value.replace(/\D/g, ''))} className="input w-32" placeholder="4242" />
                </div>
                <p className="text-xs text-slate-400">
                  Real flow collects legal name, address, and SSN/EIN through Stripe&apos;s hosted
                  onboarding — never stored on our servers. Simulated in demo.
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-6 flex gap-2">
          {step > 0 && (
            <button onClick={() => setStep(step - 1)} className="btn btn-outline">
              Back
            </button>
          )}
          <button
            onClick={() => (step === STEPS.length - 1 ? setSubmitted(true) : setStep(step + 1))}
            disabled={!canContinue}
            className="btn btn-brand flex-1"
          >
            {step === STEPS.length - 1 ? 'Submit application' : 'Continue'}
          </button>
        </div>
      </div>
    </AppShell>
  )
}
