import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import AppShell from '../components/AppShell'
import AccountDangerZone from '../components/AccountDangerZone'
import ChangePassword from '../components/ChangePassword'
import AvatarUpload from '../components/AvatarUpload'
import CarPhotoUpload from '../components/CarPhotoUpload'
import Combobox from '../components/ui/Combobox'
import AddressAutocomplete from '../components/ui/AddressAutocomplete'
import { AnimatedPage } from '../components/ui/Motion'
import { CheckIcon, MapPinIcon, PlusIcon, TrashIcon, LightbulbIcon, ArrowRightIcon, InfoIcon } from '../components/icons'
import { useStore } from '../context/StoreContext'
import { usePaint, PAINTS } from '../context/PaintContext'
import { CA_ZIP_CENTROIDS, closestDetailer } from '../lib/fuzzyPin'
import { CAR_MAKES, CAR_MODELS, MODEL_TO_TYPE } from '../lib/vehicleData'
import { extractVehiclePhoto } from '../lib/db'
import { useTiltShadow } from '../hooks/useTiltShadow'
import { useT } from '../i18n/useT'
import { TILES } from '../components/DetailerMap'

// Mini open-source map for the Home address card — same Leaflet + Carto tiles
// we already use in DetailerMap (Voyager nolabels = OpenStreetMap + CARTO).
//
// The mini-map should show the customer's actual home, not a generic pin. We
// geocode the full street address via Nominatim (OSM's free geocoder, same
// open-source stack as the tiles) so "700 W Convention Way, Anaheim" lands on
// that exact point. Resolution order, each a fallback for the last:
//   1. geocoded street address (exact point, zoom 15)
//   2. CA_ZIP_CENTROIDS entry (city-level, zoom 12)
//   3. no marker (never fall back to a wrong city like downtown LA)
function HomeMiniMap({ zip, address }) {
  const ref = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const tileRef = useRef(null)
  const [center, setCenter] = useState(null)
  const [zoom, setZoom] = useState(12)

  // Geocode the street address (or fall back to the ZIP centroid). Runs once
  // on mount/when the address changes; the result is stale-safe because the
  // effect below only recenters once a center resolves.
  useEffect(() => {
    let cancelled = false
    const query = address?.trim().length > 8 ? address.trim() : null
    const base = zip?.length === 5 ? CA_ZIP_CENTROIDS[zip] : null
    if (base) { setCenter([base.lat, base.lng]); setZoom(12) }
    if (!query) return
    ;(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&q=${encodeURIComponent(query)}`
        const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
        if (!res.ok) return
        const data = await res.json()
        if (cancelled || !data || !data.length) return
        const lat = Number(data[0].lat), lng = Number(data[0].lon)
        if (Number.isFinite(lat) && Number.isFinite(lng)) { setCenter([lat, lng]); setZoom(15) }
      } catch { /* network/parse — keep the fallback */ }
    })()
    return () => { cancelled = true }
  }, [address, zip])

  useEffect(() => {
    if (!ref.current || mapRef.current) return
    const map = L.map(ref.current, { center: center ?? [34.05, -118.24], zoom: zoom || 12, zoomControl: false, attributionControl: true, dragging: true, scrollWheelZoom: false })
    tileRef.current = L.tileLayer(TILES.light.url, { attribution: TILES.light.attribution, maxZoom: 19 }).addTo(map)
    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (!mapRef.current || !center) return
    mapRef.current.setView(center, zoom || 12)
    if (markerRef.current) { markerRef.current.setLatLng(center) } else {
      markerRef.current = L.marker(center, { icon: L.divIcon({ className: '', html: '<span class="nx-map-pin" style="--pin:#0ea5e9"></span>', iconSize: [24,24], iconAnchor:[12,12] }) }).addTo(mapRef.current)
    }
  }, [center, zoom])
  return <div ref={ref} className="h-36 w-full rounded-xl overflow-hidden ring-1 ring-slate-200 dark:ring-white/10" />
}

const ALL_MODELS = Object.values(CAR_MODELS).flat()

const VEHICLE_TYPES = ['Sedan', 'SUV', 'Truck', 'Van', 'Coupe', 'EV']

// "Your garage" — the paint accent is sampled from the customer's car photo
// (on-device in production); the swatches are the manual override. Only these
// personal surfaces read --accent — never the app chrome.
function GarageCard({ make, model, type, t }) {
  const { accent, setAccent } = usePaint()
  const current = PAINTS.find((p) => p.hex.toLowerCase() === accent.toLowerCase())

  const title = [make, model].filter(Boolean).join(' ') || type || t('yourVehicle')
  const hasVehicle = Boolean(make || model || type)

  return (
    <div className="card mt-4">
      <h2 className="font-display font-semibold text-slate-900 dark:text-slate-100">{t('yourGarage')}</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {t('garageBlurb')}
      </p>

      <div className="paint-surface mt-4 rounded-2xl p-5">
        <p className="font-display text-lg font-bold">{title}</p>
        <p className="mt-0.5 text-sm text-white/85">
          {hasVehicle ? current?.name ?? t('customPaint') : t('addVehicleHint')}
        </p>
        {hasVehicle && (
          <span className="mt-3 inline-block rounded-full border border-white/35 bg-white/20 px-3 py-1 text-xs font-semibold">
            {t('accentSampled')}
          </span>
        )}
      </div>

      <p className="mt-4 mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {t('tryAnotherPaint')}
      </p>
      <div className="flex flex-wrap gap-3">
        {PAINTS.map((p) => {
          const selected = p.hex.toLowerCase() === accent.toLowerCase()
          return (
            <button
              key={p.hex}
              type="button"
              onClick={() => setAccent(p.hex)}
              aria-label={`Paint: ${p.name}`}
              aria-pressed={selected}
              className={`press-spring h-10 w-10 cursor-pointer rounded-full border-[3px] border-white shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:border-white/20 ${
                selected ? 'paint-accent-ring' : ''
              }`}
              style={{ background: p.hex }}
            />
          )
        })}
      </div>
    </div>
  )
}

export default function CustomerSettings() {
  const { customer, uploadImage, updateCustomer, detailers, isDemo } = useStore()
  const tiltRef = useTiltShadow()
  const t = useT('customerSettings')
  const { accent } = usePaint()

  const [photo, setPhoto] = useState(customer.photo ?? null)
  const [name, setName] = useState(customer.name)
  const [bio, setBio] = useState(customer.bio ?? '')
  const [phone, setPhone] = useState(customer.phone ?? '')
  const [smsOptIn, setSmsOptIn] = useState(customer.smsOptIn ?? false)
  const [vehMake, setVehMake] = useState(customer.vehicle?.make ?? '')
  const [vehModel, setVehModel] = useState(customer.vehicle?.model ?? '')
  const [vehType, setVehType] = useState(customer.vehicle?.type ?? '')
  const [vehPhoto, setVehPhoto] = useState(customer.vehicle?.photo ?? null)
  const [vehYear, setVehYear] = useState(customer.vehicle?.year ? String(customer.vehicle.year) : '')
  const [vehicles, setVehicles] = useState(customer.vehicles ?? [])
  const [address, setAddress] = useState(customer.address)
  const [zip, setZip] = useState(customer.zip)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  const knownZip = zip.length === 5 && zip in CA_ZIP_CENTROIDS
  const nearest = zip.length === 5 && !knownZip ? closestDetailer(zip, detailers) : null

  // Persist photo immediately so the avatar updates everywhere without a save.
  async function changePhoto(url) {
    setPhoto(url)
    await updateCustomer({ photo: url })
  }

  function addVehicle() {
    setVehicles((vs) => [...vs, { id: `veh-${Date.now()}`, make: '', model: '', type: '', photo: null }])
  }
  function patchVehicle(id, patch) {
    setVehicles((vs) => vs.map((v) => (v.id === id ? { ...v, ...patch } : v)))
  }
  function removeVehicle(id) {
    setVehicles((vs) => vs.filter((v) => v.id !== id))
    setVehicleScanError((m) => { const next = { ...m }; delete next[id]; return next })
  }

  // Same photo-scan the primary vehicle uses (extractVehiclePhoto), just
  // without the paint-accent side effect — "Your garage" is one device-wide
  // accent tied to your main car, not something a second/third car in the
  // list should keep re-theming the app to. Runs alongside the actual photo
  // upload (uploadImage, wired below), not instead of it.
  const [scanningVehicleId, setScanningVehicleId] = useState(null)
  const [vehicleScanError, setVehicleScanError] = useState({})
  async function scanExtraVehicle(id, file) {
    if (isDemo) return
    setScanningVehicleId(id)
    setVehicleScanError((m) => { const next = { ...m }; delete next[id]; return next })
    try {
      const detected = await extractVehiclePhoto(file)
      const patch = {}
      if (detected.make) patch.make = detected.make
      if (detected.model) patch.model = detected.model
      if (detected.type) patch.type = detected.type
      if (Object.keys(patch).length) patchVehicle(id, patch)
    } catch (e) {
      setVehicleScanError((m) => ({ ...m, [id]: e.message || t('scanFailed') }))
    } finally {
      setScanningVehicleId((cur) => (cur === id ? null : cur))
    }
  }

  // Stored/sent in E.164 (+1XXXXXXXXXX) — what Twilio requires. A bare
  // 10-digit US number typed in is normalized; anything already starting
  // with + is trusted as-is.
  function normalizePhone(raw) {
    const digits = raw.replace(/\D/g, '')
    if (raw.trim().startsWith('+')) return `+${digits}`
    if (digits.length === 10) return `+1${digits}`
    return digits ? `+${digits}` : ''
  }

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await updateCustomer({
        name,
        bio,
        phone: normalizePhone(phone),
        smsOptIn,
        vehicle: { make: vehMake, model: vehModel, type: vehType, photo: vehPhoto, year: vehYear ? Number(vehYear) : null },
        vehicles,
        address,
        zip,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppShell role="customer">
      <AnimatedPage className="mx-auto max-w-xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">{t('account')}</h1>

        {/* Identity card — avatar straddles a notch carved into the card's
            top edge, same treatment as the detailer profile editor. */}
        <div ref={tiltRef} className="relative mt-16">
          <div className="nx-card-notch-shadow absolute inset-0 rounded-[2rem]" aria-hidden="true" />
          <div
            className="nx-card-notch-bg absolute inset-0 rounded-[2rem]"
            style={{ '--notch-r': '50px' }}
            aria-hidden="true"
          />
          <div className="relative flex flex-col items-center gap-3 px-8 pb-8 pt-4 text-center">
            <div className="-mt-20">
              <AvatarUpload
                photo={photo}
                name={name}
                size="xl"
                onFile={(file) => uploadImage(file, 'avatars')}
                onChange={changePhoto}
              />
            </div>
            <div>
              <p className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">{name}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {customer.points} {customer.points !== 1 ? t('loyaltyPoints') : t('loyaltyPoint')} · ${customer.referralCredits} {t('referralCredit')}
              </p>
            </div>
          </div>
        </div>

        <GarageCard make={vehMake} model={vehModel} type={vehType} t={t} />

        <form onSubmit={save} className="mt-4 space-y-4">
          {/* Basics */}
          <div className="card space-y-4">
            <h2 className="font-display font-semibold text-slate-900 dark:text-slate-100">{t('profile')}</h2>
            <div>
              <label htmlFor="name" className="label">{t('displayName')}</label>
              <input
                id="name" type="text" autoComplete="name" value={name}
                onChange={(e) => setName(e.target.value)} className="input" placeholder={t('displayNamePlaceholder')}
              />
            </div>
            <div>
              <label htmlFor="bio" className="label">
                {t('aboutYou')} <span className="font-normal text-slate-400">({250 - bio.length} {t('left')})</span>
              </label>
              <textarea
                id="bio" rows={3} maxLength={250} value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="input h-auto resize-none py-2"
                placeholder={t('aboutYouPlaceholder')}
              />
            </div>
            <div>
              <label htmlFor="phone" className="label">{t('phoneLabel')}</label>
              <input
                id="phone" type="tel" inputMode="tel" autoComplete="tel" value={phone}
                onChange={(e) => setPhone(e.target.value)} className="input" placeholder="(555) 555-5555"
              />
            </div>
            <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-600 dark:text-slate-400">
              <input
                type="checkbox" checked={smsOptIn}
                onChange={(e) => setSmsOptIn(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-brand-600"
              />
              {t('smsOptInLabel')}
            </label>
            {/* Carrier-required disclaimers (frequency, rates, HELP/STOP,
                Terms/Privacy) — must sit right next to the checkbox, not
                buried elsewhere, for toll-free/A2P consent review. */}
            <p className="pl-[1.625rem] text-xs text-slate-400 dark:text-slate-500">
              {t('smsDisclaimer')}{' '}
              <Link to="/terms" className="underline hover:text-slate-600 dark:hover:text-slate-300">{t('smsDisclaimerTerms')}</Link>
              {' · '}
              <Link to="/privacy" className="underline hover:text-slate-600 dark:hover:text-slate-300">{t('smsDisclaimerPrivacy')}</Link>
            </p>
          </div>

          {/* Primary vehicle */}
          <div className="card space-y-3">
            <h2 className="font-display font-semibold text-slate-900 dark:text-slate-100">{t('primaryVehicle')}</h2>
            <p className="-mt-1 text-sm text-slate-500 dark:text-slate-400">{t('primaryVehicleBlurb')}</p>
            <div className="grid grid-cols-2 gap-2">
              <Combobox
                value={vehMake}
                onChange={setVehMake}
                options={CAR_MAKES}
                placeholder="Make (Toyota)"
              />
              <Combobox
                value={vehModel}
                onChange={(m) => {
                  setVehModel(m)
                  // Auto-detect vehicle type from model
                  const detectedType = MODEL_TO_TYPE[m]
                  if (detectedType) setVehType(detectedType)
                }}
                options={CAR_MODELS[vehMake] ?? ALL_MODELS}
                placeholder="Model (RAV4)"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {VEHICLE_TYPES.map((vt) => (
                <button
                  key={vt} type="button"
                  onClick={() => setVehType(vehType === vt ? '' : vt)}
                  className={`cursor-pointer rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    vehType === vt ? 'bg-brand-600 text-white shadow-sm' : 'bg-brand-50 text-slate-600 hover:bg-brand-100'
                  }`}
                >
                  {vt}
                </button>
              ))}
            </div>
            <input
              type="number"
              inputMode="numeric"
              value={vehYear}
              onChange={(e) => setVehYear(e.target.value)}
              placeholder="Year (2021)"
              aria-label="Vehicle year"
              className="input"
            />
            <div className="flex flex-col items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Vehicle Photo (optional)</p>
              <CarPhotoUpload
                photo={vehPhoto}
                paintHex={accent}
                onChange={setVehPhoto}
                onFile={async (file) => {
                  const reader = new FileReader()
                  reader.onload = (e) => setVehPhoto(e.target.result)
                  reader.readAsDataURL(file)
                }}
              />
            </div>
          </div>

          {/* Additional vehicles — same fields as the primary one plus a
              photo, since a garage can hold more than one car. */}
          <div className="card space-y-4">
            <div>
              <h2 className="font-display font-semibold text-slate-900 dark:text-slate-100">{t('otherVehicles')}</h2>
              <p className="-mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                {t('otherVehiclesBlurb')}
              </p>
            </div>

            {vehicles.map((v) => (
              <div key={v.id} className="flex gap-3 rounded-2xl bg-brand-50/60 p-3 dark:bg-white/5">
                <CarPhotoUpload
                  photo={v.photo}
                  onFile={(file) => { uploadImage(file, 'vehicles'); scanExtraVehicle(v.id, file) }}
                  onChange={(url) => patchVehicle(v.id, { photo: url })}
                />
                <div className="min-w-0 flex-1 space-y-2">
                  {scanningVehicleId === v.id && (
                    <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
                      {t('scanning')}
                    </p>
                  )}
                  {vehicleScanError[v.id] && (
                    <p role="alert" className="text-xs text-red-600 dark:text-red-400">{vehicleScanError[v.id]}</p>
                  )}
                  <Combobox
                    value={v.make}
                    onChange={(val) => patchVehicle(v.id, { make: val })}
                    options={CAR_MAKES}
                    placeholder="Make"
                    inputClassName="input h-10"
                  />
                  <Combobox
                    value={v.model}
                    onChange={(val) => patchVehicle(v.id, { model: val })}
                    options={CAR_MODELS[v.make] ?? ALL_MODELS}
                    placeholder="Model"
                    inputClassName="input h-10"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {VEHICLE_TYPES.map((vt) => (
                      <button
                        key={vt} type="button"
                        onClick={() => patchVehicle(v.id, { type: v.type === vt ? '' : vt })}
                        className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                          v.type === vt
                            ? 'bg-brand-600 text-white shadow-sm'
                            : 'bg-white text-slate-600 hover:bg-brand-100 dark:bg-white/10 dark:text-slate-400 dark:hover:bg-white/15'
                        }`}
                      >
                        {vt}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeVehicle(v.id)}
                  aria-label={t('removeVehicle')}
                  className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center self-start rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={addVehicle}
              className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-brand-200 py-2.5 text-sm font-medium text-brand-700 transition-colors duration-200 hover:border-brand-400 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:border-brand-500/30 dark:text-brand-300 dark:hover:bg-brand-500/10"
            >
              <PlusIcon className="h-4 w-4" /> {t('addAnotherCar')}
            </button>
          </div>

          {/* Home address — now with open-source mini map (Leaflet + Carto) */}
          <div className="card space-y-4">
            <h2 className="font-display font-semibold text-slate-900 dark:text-slate-100">{t('homeAddress')}</h2>
            <p className="-mt-2 text-sm text-slate-500 dark:text-slate-400">{t('homeAddressBlurb')}</p>
            <div>
              <label htmlFor="addr" className="label">{t('streetAddressLabel')}</label>
              <AddressAutocomplete
                inputId="addr"
                value={address}
                onChange={setAddress}
                onSelect={(details) => {
                  if (details.zip) setZip(details.zip)
                }}
              />
            </div>
            <div>
              <label htmlFor="zip" className="label">{t('zipLabel')}</label>
              <input
                id="zip" inputMode="numeric" autoComplete="postal-code" maxLength={5} value={zip}
                onChange={(e) => setZip(e.target.value.replace(/\D/g, ''))} className="input w-32" placeholder="90026"
              />
              {zip.length === 5 && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-cta-700">
                  <MapPinIcon className="h-3.5 w-3.5" />
                  {knownZip
                    ? t('inServiceArea')
                    : nearest
                      ? t('closestDetailer', { name: nearest.detailer.name, miles: Math.round(nearest.miles) })
                      : t('outsideServiceArea')}
                </p>
              )}
            </div>
            <HomeMiniMap zip={zip} address={address} />
            <p className="text-[11px] text-slate-400 dark:text-slate-500">OpenStreetMap via CARTO Voyager — same open-source stack as the discovery map.</p>
          </div>

          <div className="relative">
            <button type="submit" disabled={busy || zip.length !== 5} className="btn btn-cta w-full">
              {busy ? t('saving') : t('saveChanges')}
            </button>
            <AnimatePresence>
              {saved && (
                <motion.p
                  role="status"
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="absolute -top-9 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-cta-700 px-4 py-1.5 text-sm font-semibold text-white shadow-lg"
                >
                  <CheckIcon className="h-4 w-4" /> {t('saved')}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </form>

        <Link
          to="/faq"
          className="card card-hover mt-4 flex items-center gap-4 !p-4"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-300">
            <InfoIcon className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-slate-900 dark:text-slate-100">{t('faqTitle')}</span>
            <span className="block text-sm text-slate-500 dark:text-slate-400">{t('faqBody')}</span>
          </span>
          <ArrowRightIcon className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
        </Link>

        <Link
          to="/feedback"
          className="card card-hover mt-3 flex items-center gap-4 !p-4"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-300">
            <LightbulbIcon className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-slate-900 dark:text-slate-100">{t('feedbackTitle')}</span>
            <span className="block text-sm text-slate-500 dark:text-slate-400">{t('feedbackBody')}</span>
          </span>
          <ArrowRightIcon className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
        </Link>

        <ChangePassword />

        <div className="mt-6">
          <AccountDangerZone />
        </div>
      </AnimatedPage>
    </AppShell>
  )
}
