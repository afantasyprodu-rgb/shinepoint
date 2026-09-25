import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import QRCode from 'qrcode'
import AppShell from '../components/AppShell'
import { AnimatedPage } from '../components/ui/Motion'
import { useStore } from '../context/StoreContext'
import { PrinterIcon, ArrowRightIcon } from '../components/icons'

// US Letter at 96dpi — the flyer is laid out at real print size and scaled
// down to fit the screen, so the preview is exactly what prints.
const PAGE_W = 816
const PAGE_H = 1056
const TEAR_TABS = 8

// Printed paper outlives any deploy, so the QR always encodes the canonical
// domain, never a Vercel preview URL. Dev keeps the local origin so the code
// can be scanned against a local server.
const PUBLIC_ORIGIN = import.meta.env.DEV ? window.location.origin : 'https://shinepoint.app'

function bookUrl(slug) {
  return `${PUBLIC_ORIGIN}/d/${slug}`
}

function displayUrl(slug) {
  return `${PUBLIC_ORIGIN.replace(/^https?:\/\//, '')}/d/${slug}`
}

function Flyer({ detailer, qr, slug }) {
  const services = (detailer.services ?? []).filter((s) => !s.isAddon).slice(0, 4)
  const firstName = (detailer.name || 'Your detailer').split(' ')[0]
  return (
    <div id="flyer-print" className="flyer-page" style={{ width: PAGE_W, height: PAGE_H }}>
      <div className="flyer-hero">
        <div className="flyer-beads" aria-hidden="true">
          {Array.from({ length: 14 }).map((_, i) => <span key={i} />)}
        </div>
        <p className="flyer-kicker">Mobile car detailing · we come to you</p>
        <h1 className="flyer-headline">
          Showroom shine,<br />right in your driveway.
        </h1>
      </div>

      <div className="flyer-body">
        <div className="flyer-left">
          <div className="flyer-who">
            {detailer.photo ? (
              <img src={detailer.photo} alt="" className="flyer-avatar" crossOrigin="anonymous" />
            ) : (
              <div className="flyer-avatar flyer-avatar-fallback">{firstName[0]}</div>
            )}
            <div>
              <p className="flyer-name">{detailer.name}</p>
              <p className="flyer-meta">
                {(detailer.isRated ?? detailer.reviews > 0) && detailer.rating
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

export default function DetailerFlyer() {
  const { myDetailer } = useStore()
  const detailer = myDetailer ?? {}
  const slug = detailer.slug
  const [qr, setQr] = useState('')
  const [qrError, setQrError] = useState('')
  const [scale, setScale] = useState(0.5)
  const frameRef = useRef(null)

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    // H error correction: survives a smudged or partly torn printout.
    QRCode.toDataURL(bookUrl(slug), { errorCorrectionLevel: 'H', margin: 1, width: 900, color: { dark: '#1e0a2e', light: '#ffffff' } })
      .then((url) => { if (!cancelled) setQr(url) })
      .catch((e) => { if (!cancelled) setQrError(e.message) })
    return () => { cancelled = true }
  }, [slug])

  useLayoutEffect(() => {
    const el = frameRef.current
    if (!el) return
    const fit = () => setScale(Math.min(1, el.clientWidth / PAGE_W))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [slug])

  function downloadQr() {
    if (!qr) return
    const a = document.createElement('a')
    a.href = qr
    a.download = `shinepoint-${slug}-qr.png`
    a.click()
  }

  return (
    <AppShell role="detailer">
      <AnimatedPage className="mx-auto w-full max-w-3xl px-4 py-6">
        <div className="flex items-center gap-3">
          <Link to="/detailer/profile" className="btn btn-outline h-9 px-3 text-sm" aria-label="Back to profile">←</Link>
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">Your QR flyer</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Print it and post it anywhere. Customers scan the code and land on your booking page.
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
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" onClick={() => window.print()} disabled={!qr} className="btn btn-cta inline-flex items-center gap-2">
                <PrinterIcon className="h-4 w-4" /> Print / Save as PDF
              </button>
              <button type="button" onClick={downloadQr} disabled={!qr} className="btn btn-outline">
                Download QR image
              </button>
            </div>
            {qrError && <p role="alert" className="mt-3 text-sm text-red-600">Couldn’t make the QR code: {qrError}</p>}

            <div ref={frameRef} className="mt-5 w-full">
              <div
                className="flyer-preview overflow-hidden rounded-xl shadow-xl"
                style={{ width: PAGE_W * scale, height: PAGE_H * scale }}
              >
                <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                  <Flyer detailer={detailer} qr={qr} slug={slug} />
                </div>
              </div>
            </div>
          </>
        )}
      </AnimatedPage>
    </AppShell>
  )
}
