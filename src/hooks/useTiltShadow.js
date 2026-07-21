import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'motion/react'

const MAX_DEG = 20 // orientation delta (degrees) that maps to the full offset
const LERP = 0.15 // smoothing factor per animation frame

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n))
}

// Tilts a card's drop shadow with the phone's orientation, so it reads as a
// physical object catching light rather than a flat CSS shadow. Sets
// --tilt-x/--tilt-y (px) as custom properties on the returned ref's element;
// consuming CSS reads them with a `var(--tilt-x, 0px)` fallback so desktop
// (no orientation sensor) just gets the static shadow.
//
// Calibrates against whatever orientation the phone is in on first reading
// instead of an assumed "holding it upright" angle, so the effect is a
// *delta* from wherever the user already had the phone.
export function useTiltShadow({ maxOffset = 14 } = {}) {
  const ref = useRef(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    if (reduce) return
    if (typeof window === 'undefined' || !window.DeviceOrientationEvent) return
    const el = ref.current
    if (!el) return

    let baseline = null
    const target = { x: 0, y: 0 }
    const current = { x: 0, y: 0 }
    let rafId = null
    let listening = false

    function onOrientation(e) {
      if (e.beta == null && e.gamma == null) return
      if (!baseline) baseline = { beta: e.beta ?? 0, gamma: e.gamma ?? 0 }
      const dGamma = (e.gamma ?? 0) - baseline.gamma
      const dBeta = (e.beta ?? 0) - baseline.beta
      target.x = (clamp(dGamma, -MAX_DEG, MAX_DEG) / MAX_DEG) * maxOffset
      target.y = (clamp(dBeta, -MAX_DEG, MAX_DEG) / MAX_DEG) * maxOffset
    }

    function loop() {
      current.x += (target.x - current.x) * LERP
      current.y += (target.y - current.y) * LERP
      el.style.setProperty('--tilt-x', `${current.x.toFixed(2)}px`)
      el.style.setProperty('--tilt-y', `${current.y.toFixed(2)}px`)
      rafId = requestAnimationFrame(loop)
    }

    function start() {
      if (listening) return
      listening = true
      window.addEventListener('deviceorientation', onOrientation)
      rafId = requestAnimationFrame(loop)
    }

    function stop() {
      listening = false
      window.removeEventListener('deviceorientation', onOrientation)
      if (rafId) cancelAnimationFrame(rafId)
      el.style.removeProperty('--tilt-x')
      el.style.removeProperty('--tilt-y')
    }

    // iOS 13+ gates orientation events behind a permission prompt that must
    // be triggered from a user gesture — there's no way to ask for it
    // up front, so wait for the first tap anywhere on the page.
    const needsPermission = typeof window.DeviceOrientationEvent.requestPermission === 'function'
    if (needsPermission) {
      const grant = () => {
        window.DeviceOrientationEvent.requestPermission()
          .then((state) => { if (state === 'granted') start() })
          .catch(() => {})
      }
      window.addEventListener('click', grant, { once: true })
      window.addEventListener('touchend', grant, { once: true })
      return () => {
        window.removeEventListener('click', grant)
        window.removeEventListener('touchend', grant)
        stop()
      }
    }

    start()
    return stop
  }, [reduce, maxOffset])

  return ref
}
