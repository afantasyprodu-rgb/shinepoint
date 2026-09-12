/**
 * Bo's face — public-site soap-bubble concierge (Landing). Eyes + tuxedo ride
 * inside the sphere (.nx-bo-bubble). Tuxedo is a bottom-quarter wrap only —
 * still a circle, not a human body: soft black jacket mass at the south pole,
 * rounded shirt V, brand bow. `muted`: past chat message — hide eyes/suit,
 * desaturate via CSS. Live Bo gets tiny decorative sparkles; muted stays quiet.
 * When followPointer is on, eyes track finger/cursor (phone-first).
 */
import { useEffect, useRef } from 'react'

const LOOK_MAX = 0.15 // fraction of --bo-size
const IDLE_MS = 600

export default function BoBlob({
  size = 44,
  muted = false,
  followPointer = true,
  className = '',
}) {
  const wrapRef = useRef(null)
  const idleTimerRef = useRef(null)
  const lookingRef = useRef(false)

  useEffect(() => {
    if (!followPointer || muted) return
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const el = wrapRef.current
    if (!el) return

    const setLook = (xPx, yPx, looking) => {
      el.style.setProperty('--bo-look-x', `${xPx}px`)
      el.style.setProperty('--bo-look-y', `${yPx}px`)
      const bubble = el.querySelector('.nx-bo-bubble')
      if (!bubble) return
      if (looking) {
        if (!lookingRef.current) {
          bubble.classList.add('nx-bo-looking')
          lookingRef.current = true
        }
      } else if (lookingRef.current) {
        bubble.classList.remove('nx-bo-looking')
        lookingRef.current = false
      }
    }

    const easeToZero = () => {
      setLook(0, 0, true)
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      idleTimerRef.current = setTimeout(() => setLook(0, 0, false), 120)
    }

    const scheduleIdle = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      idleTimerRef.current = setTimeout(easeToZero, IDLE_MS)
    }

    const onPointer = (e) => {
      if (document.hidden) return
      let clientX
      let clientY
      if (e.touches && e.touches.length) {
        clientX = e.touches[0].clientX
        clientY = e.touches[0].clientY
      } else if (e.clientX != null) {
        clientX = e.clientX
        clientY = e.clientY
      } else {
        return
      }

      const rect = el.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const halfW = Math.max(window.innerWidth / 2, 1)
      const halfH = Math.max(window.innerHeight / 2, 1)
      const nx = Math.max(-1, Math.min(1, (clientX - cx) / halfW))
      const ny = Math.max(-1, Math.min(1, (clientY - cy) / halfH))
      const maxPx = size * LOOK_MAX
      setLook(nx * maxPx, ny * maxPx, true)
      scheduleIdle()
    }

    const onVisibility = () => {
      if (document.hidden) easeToZero()
    }

    const onBlur = () => {
      scheduleIdle()
    }

    const opts = { passive: true }
    window.addEventListener('pointermove', onPointer, opts)
    window.addEventListener('touchmove', onPointer, opts)
    window.addEventListener('pointerdown', onPointer, opts)
    window.addEventListener('touchstart', onPointer, opts)
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      window.removeEventListener('pointermove', onPointer, opts)
      window.removeEventListener('touchmove', onPointer, opts)
      window.removeEventListener('pointerdown', onPointer, opts)
      window.removeEventListener('touchstart', onPointer, opts)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVisibility)
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      lookingRef.current = false
    }
  }, [followPointer, muted, size])

  return (
    <div
      ref={wrapRef}
      className={`nx-bo-float ${className}`}
      style={{
        width: size,
        height: size,
        '--bo-size': `${size}px`,
        '--bo-look-x': '0px',
        '--bo-look-y': '0px',
      }}
      aria-hidden="true"
    >
      <div className={`nx-bo-bubble nx-bo-idle relative h-full w-full ${muted ? 'nx-bo-bubble-muted' : ''}`}>
        {!muted && (
          <>
            <span className="bo-sparkle bo-sparkle-tr" />
            <span className="bo-sparkle bo-sparkle-tl" />
            <span className="bo-sparkle bo-sparkle-mr" />
            <span className="bo-sparkle bo-sparkle-bl" />
            <span className="bo-sparkle bo-sparkle-tm" />
            <div className="bo-eyes">
              <span className="bo-eye-look"><span className="bo-eye" /></span>
              <span className="bo-eye-look"><span className="bo-eye" /></span>
            </div>
            <div className="bo-suit">
              <span className="bo-tux-body" />
              <span className="bo-tux-lapel bo-tux-lapel-left" />
              <span className="bo-tux-lapel bo-tux-lapel-right" />
              <span className="bo-tux-shirt" />
              <span className="bo-bowtie">
                <span className="bo-bowtie-wing bo-bowtie-wing-left" />
                <span className="bo-bowtie-knot" />
                <span className="bo-bowtie-wing bo-bowtie-wing-right" />
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}