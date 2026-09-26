import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import QRCode from 'qrcode'
import AppShell from '../components/AppShell'
import { AnimatedPage } from '../components/ui/Motion'
import { useStore } from '../context/StoreContext'
import WaterFill from '../components/ui/WaterFill'
import { PrinterIcon, ArrowRightIcon, CameraIcon, CheckIcon } from '../components/icons'

// US Letter at 96dpi — the flyer is laid out at real print size and scaled
// down to fit the screen, so the preview is exactly what prints.
const PAGE_W = 816
const PAGE_H = 1056
const TEAR_TABS = 8
const STORAGE_KEY = 'shinepoint:flyer'

// Printed paper outlives any deploy, so the QR always encodes the canonical
// domain, never a Vercel preview URL. Dev keeps the local origin so the code
// can be scanned against a local server.
const PUBLIC_ORIGIN = import.meta.env.DEV ? window.location.origin : 'https://shinepoint.app'

// Every template shares the same markup; each one is a `flyer-t-<id>` class
// in index.css that restyles colors, type, decoration and the QR card.
const TEMPLATES = [
  { id: 'gloss', name: 'Midnight Gloss', kicker: 'Mobile car detailing · we come to you', headline: ['Showroom shine,', 'right in your driveway.'] },
  { id: 'suds', name: 'Fresh Suds', kicker: 'Hand wash · interior · wax', headline: ['Squeaky clean,', 'zero hassle.'] },
  { id: 'race', name: 'Race Day', kicker: 'Pro detailing · on your schedule', headline: ['Make it', 'look fast.'] },
  { id: 'photo', name: 'Photo Hero', kicker: 'Mobile car detailing', headline: ['Your car,', 'at its best.'] },
  { id: 'pro', name: 'Clean Pro', kicker: 'Professional mobile detailing', headline: ['Detailing that', 'comes to you.'] },
]

function bookUrl(slug) {
  return `${PUBLIC_ORIGIN}/d/${slug}`
}

function displayUrl(slug) {
  return `${PUBLIC_ORIGIN.replace(/^https?:\/\//, '')}/d/${slug}`
}

function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return {
      template: TEMPLATES.some((t) => t.id === p.template) ? p.template : 'gloss',
      photo: typeof p.photo === 'string' ? p.photo : '',
    }
  } catch {
    return { template: 'gloss', photo: '' }
  }
}

function Flyer({ detailer, qr, slug, template, photo, printable = false }) {
  const tpl = TEMPLATES.find((t) => t.id === template) ?? TEMPLATES[0]
  const services = (detailer.services ?? []).filter((s) => !s.isAddon).slice(0, 4)
  const firstName = (detailer.name || 'Your detailer').split(' ')[0]
  const rated = (detailer.isRated ?? detailer.reviews > 0) && detailer.rating
  return (
    <div
      id={printable ? 'flyer-print' : undefined}
      className={`flyer-page flyer-t-${tpl.id}`}
      style={{ width: PAGE_W, height: PAGE_H }}
    >
      <div
        className={`flyer-hero${photo ? ' has-photo' : ''}`}
        style={photo ? { '--fl-photo': `url("${photo}")` } : undefined}
      >
        <div className="flyer-deco" aria-hidden="true">
          {Array.from({ length: 14 }).map((_, i) => <span key={i} />)}
        </div>
        <p className="flyer-kicker">{tpl.kicker}</p>
        <h1 className="flyer-headline">
          {tpl.headline[0]}<br />{tpl.headline[1]}
        </h1>
      </div>

      <div className="flyer-body">
        <div className="flyer-left">
          <div className="flyer-who">
            {detailer.photo ? (
              <img src={detailer.photo} alt="" className="flyer-avatar" />
            ) : (
              <div className="flyer-avatar flyer-avatar-fallback">{firstName[0]}</div>
            )}
            <div>
              <p className="flyer-name">{detailer.name}</p>
              <p className="flyer-meta">
                {rated
                  ? `★ ${Number(detailer.rating).toFixed(1)} · ${detailer.reviews} review${detailer.reviews === 1 ? '' : 's'}`
                  : 'Verified ShinePoint detailer'}
              </p>
            </div>
          </div>

          {services.length > 0 && (
            <ul className="flyer-services">
              {services.map((s) => (
                <li key={s.id ?? s.name}>
                  <span>{s.name}</span>
                  <span className="flyer-dots" aria-hidden="true" />
                  <strong>${Math.round(s.price)}</strong>
                </li>
              ))}
            </ul>
          )}

          <ul className="flyer-perks">
            <li>Book in under a minute</li>
            <li>Pay securely in the app</li>
            <li>Insured &amp; background-checked</li>
          </ul>
        </div>

        <div className="flyer-qr-card">
          <p className="flyer-qr-label">Scan to book</p>
          {qr ? <img src={qr} alt={`QR code to book ${detailer.name}`} className="flyer-qr" /> : <div className="flyer-qr" />}
          <p className="flyer-url">{displayUrl(slug)}</p>
        </div>
      </div>

      <ol className="flyer-steps">
        <li><strong>1</strong>Scan the code</li>
        <li><strong>2</strong>Pick your service &amp; time</li>
        <li><strong>3</strong>We come to you &amp; make it shine</li>
      </ol>

      <div className="flyer-tabs">
        {Array.from({ length: TEAR_TABS }).map((_, i) => (
          <div key={i} className="flyer-tab">
            <strong>{detailer.name}</strong>
            <span>{displayUrl(slug)}</span>
          </div>
        ))}
      </div>
      <p className="flyer-footer">Booked through ShinePoint</p>
    </div>
  )
}

// Fits a real-size flyer into whatever width its container has.
function ScaledFlyer({ className = '', ...props }) {
  const ref = useRef(null)
  const [scale, setScale] = useState(0.2)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = () => setScale(Math.min(1, el.clientWidth / PAGE_W))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={ref} className="w-full">
      <div className={`flyer-preview overflow-hidden ${className}`} style={{ width: PAGE_W * scale, height: PAGE_H * scale }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          <Flyer {...props} />
        </div>
      </div>
    </div>
  )
}

export default function DetailerFlyer() {
  const { myDetailer, uploadImage } = useStore()
  const detailer = myDetailer ?? {}
  const slug = detailer.slug
  const [qr, setQr] = useState('')
  const [qrError, setQrError] = useState('')
  const [prefs, setPrefs] = useState(loadPrefs)
  const [uploading, setUploading] = useState(false)
  const [uploadDone, setUploadDone] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileRef = useRef(null)

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)) } catch { /* private mode */ }
  }, [prefs])

  // Lexend + Fredoka are flyer-only faces — loaded on this page rather than
  // app-wide so every other screen doesn't pay for them.
  useEffect(() => {
    const id = 'flyer-fonts'
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = 'https://fonts.googleapis.com/css2?family=Fredoka:wght@600;700&family=Lexend:wght@700;800&display=swap'
    document.head.appendChild(link)
  }, [])

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    // H error correction: survives a smudged or partly torn printout.
    QRCode.toDataURL(bookUrl(slug), { errorCorrectionLevel: 'H', margin: 1, width: 900, color: { dark: '#111018', light: '#ffffff' } })
      .then((url) => { if (!cancelled) setQr(url) })
      .catch((e) => { if (!cancelled) setQrError(e.message) })
    return () => { cancelled = true }
  }, [slug])

  async function onPhotoPicked(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { setUploadError('Pick an image file.'); return }
    setUploadError('')
    setUploading(true)
    try {
      const url = await uploadImage(file, 'gallery')
      setPrefs((p) => ({ ...p, photo: url }))
      setUploadDone(true)
      setTimeout(() => setUploadDone(false), 1100)
    } catch (err) {
      setUploadError(err?.message || 'Upload failed — try again.')
    } finally {
      setUploading(false)
    }
  }

  function downloadQr() {
    if (!qr) return
    const a = document.createElement('a')
    a.href = qr
    a.download = `shinepoint-${slug}-qr.png`
    a.click()
  }

  const flyerProps = { detailer, qr, slug, photo: prefs.photo }

  return (
    <AppShell role="detailer">
      <AnimatedPage className="mx-auto w-full max-w-3xl px-4 py-6">
        <div className="flex items-center gap-3">
          <Link to="/detailer/profile" className="btn btn-outline h-9 px-3 text-sm" aria-label="Back to profile">←</Link>
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">Your QR flyer</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Pick a design, add a photo, then print it and post it anywhere.
            </p>
          </div>
        </div>

        {!slug ? (
          <div className="card mt-6 text-center">
            <p className="font-semibold text-slate-900 dark:text-slate-100">Set your book-me link first</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              The QR code points to your personal booking page, so it needs a link name.
            </p>
            <Link to="/detailer/profile" className="btn btn-brand mt-4 inline-flex items-center gap-2">
              Set my link <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <>
            <h2 className="mt-6 text-sm font-semibold text-slate-700 dark:text-slate-300 print:hidden">Design</h2>
            <div className="mt-2 grid grid-cols-3 gap-3 sm:grid-cols-5 print:hidden" role="radiogroup" aria-label="Flyer design">
              {TEMPLATES.map((t) => {
                const active = prefs.template === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setPrefs((p) => ({ ...p, template: t.id }))}
                    className="group cursor-pointer text-left focus-visible:outline-none"
                  >
                    <div className={`relative rounded-lg ring-2 transition-all ${active ? 'ring-brand-600' : 'ring-transparent group-hover:ring-brand-200 group-focus-visible:ring-brand-400'}`}>
                      <ScaledFlyer {...flyerProps} template={t.id} className="rounded-lg shadow-md" />
                      {active && (
                        <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white shadow">
                          <CheckIcon className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                    <p className={`mt-1.5 text-xs font-semibold ${active ? 'text-brand-700 dark:text-brand-300' : 'text-slate-600 dark:text-slate-400'}`}>{t.name}</p>
                  </button>
                )
              })}
            </div>

            <div className="card mt-5 flex flex-wrap items-center gap-3 !p-4 print:hidden">
              <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg">
                {prefs.photo ? (
                  <img src={prefs.photo} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-brand-50 text-brand-600 dark:bg-white/5 dark:text-brand-300">
                    <CameraIcon className="h-6 w-6" />
                  </div>
                )}
                <WaterFill active={uploading} done={uploadDone} className="rounded-lg" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Flyer photo</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Your best before/after, your rig, or a freshly shined car. It becomes the top banner.
                </p>
              </div>
              <div className="flex gap-2">
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhotoPicked} />
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="btn btn-outline h-9 px-3 text-sm">
                  {uploading ? 'Uploading…' : prefs.photo ? 'Change' : 'Upload photo'}
                </button>
                {prefs.photo && !uploading && (
                  <button type="button" onClick={() => setPrefs((p) => ({ ...p, photo: '' }))} className="btn h-9 px-3 text-sm text-slate-500">
                    Remove
                  </button>
                )}
              </div>
              {uploadError && <p role="alert" className="w-full text-xs text-red-600 dark:text-red-400">{uploadError}</p>}
            </div>

            <div className="mt-5 flex flex-wrap gap-2 print:hidden">
              <button type="button" onClick={() => window.print()} disabled={!qr} className="btn btn-cta inline-flex items-center gap-2">
                <PrinterIcon className="h-4 w-4" /> Print / Save as PDF
              </button>
              <button type="button" onClick={downloadQr} disabled={!qr} className="btn btn-outline">
                Download QR image
              </button>
            </div>
            {qrError && <p role="alert" className="mt-3 text-sm text-red-600">Couldn’t make the QR code: {qrError}</p>}

            <div className="mt-5">
              <ScaledFlyer {...flyerProps} template={prefs.template} printable className="flyer-preview-main rounded-xl shadow-xl" />
            </div>
          </>
        )}
      </AnimatedPage>
    </AppShell>
  )
}
