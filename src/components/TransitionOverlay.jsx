import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useReducedMotion } from 'motion/react'
import { consumeArrival } from '../lib/transition'

// Post-login arrival transition: the destination page is already mounted
// underneath (React Router already swapped it in) — this overlay instantly
// tiles the whole viewport in soap bubbles so none of it is visible, holds
// for a beat, then bursts every bubble in a staggered wave rippling out from
// the center, each pop punching a hole straight through the canvas. Once the
// last bubble has burst the page reads as fully "loaded" underneath.
//
// Every run randomizes hue + bubble sizing/timing so no two logins look
// identical. Bounded purple->pink->blue arc (same soap-sheen band used
// elsewhere) rather than a full rainbow.
const HUE_STOPS = [322, 262, 208] // pink -> purple -> blue, in wheel order

function randomHue() {
  const span = HUE_STOPS.length - 1
  const pos = Math.random() * span
  const i = Math.min(Math.floor(pos), span - 1)
  const f = pos - i
  return HUE_STOPS[i] + (HUE_STOPS[i + 1] - HUE_STOPS[i]) * f
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3)
}
function easeInCubic(t) {
  return t * t * t
}
function randRange(min, max) {
  return min + Math.random() * (max - min)
}

const FILL_DURATION = 480 // bubbles growing in to full coverage
const HOLD = 220 // beat at full coverage before the pop wave starts
const POP_SPREAD = 620 // total time for the pop wave to radiate out
const POP_DUR = 260 // how long a single bubble's burst takes

function buildSettings() {
  return { hue: randomHue() }
}

function BubbleOverlay({ onDone }) {
  const canvasRef = useRef(null)
  const [settings] = useState(buildSettings)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let width = window.innerWidth
    let height = window.innerHeight

    function resize() {
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    // Hex-packed bubble field, spaced tighter than 2x radius so neighbors
    // overlap even at the smallest jittered size — guarantees full coverage
    // with no visible gaps down to the page beneath.
    const baseR = Math.max(22, Math.min(width, height) / 11)
    const spacing = baseR * 1.42
    const rowH = spacing * 0.87
    const bubbles = []
    let row = 0
    for (let y = -baseR; y < height + baseR; y += rowH) {
      const xOffset = row % 2 === 0 ? 0 : spacing / 2
      for (let x = -baseR + xOffset; x < width + baseR; x += spacing) {
        bubbles.push({
          x: x + randRange(-4, 4),
          y: y + randRange(-4, 4),
          r: baseR * randRange(0.78, 1.18),
          fillDelay: randRange(0, FILL_DURATION * 0.55),
          popped: false,
        })
      }
      row++
    }
    // Pop wave radiates outward from the viewport center, with jitter so it
    // reads as organic bursting rather than a perfect ripple.
    const cx = width / 2
    const cy = height / 2
    const maxDist = Math.hypot(cx, cy) || 1
    for (const b of bubbles) {
      const dist = Math.hypot(b.x - cx, b.y - cy) / maxDist
      b.popDelay = Math.max(0, dist * POP_SPREAD + randRange(-60, 60))
    }

    const start = performance.now()
    let raf
    let filling = true

    function drawBubble(x, y, r) {
      const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r)
      grad.addColorStop(0, `hsla(${settings.hue}, 90%, 88%, 0.92)`)
      grad.addColorStop(0.6, `hsla(${settings.hue}, 85%, 76%, 0.88)`)
      grad.addColorStop(1, `hsla(${settings.hue}, 80%, 62%, 0.85)`)
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fillStyle = grad
      ctx.fill()
      ctx.lineWidth = 1.25
      ctx.strokeStyle = `hsla(${settings.hue}, 70%, 55%, 0.5)`
      ctx.stroke()
      // Specular highlight — the classic glossy-sphere cue that reads "wet."
      ctx.beginPath()
      ctx.arc(x - r * 0.32, y - r * 0.32, Math.max(r * 0.22, 1), 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,255,255,0.75)'
      ctx.fill()
    }

    function tick(now) {
      const elapsed = now - start

      if (filling) {
        // Redraw from scratch every frame while bubbles are still growing —
        // an opaque base wash first so the page underneath is never visible,
        // even before a given bubble's stagger has kicked in.
        ctx.clearRect(0, 0, width, height)
        ctx.fillStyle = `hsl(${settings.hue} 75% 82%)`
        ctx.fillRect(0, 0, width, height)
        for (const b of bubbles) {
          const localT = Math.min(Math.max((elapsed - b.fillDelay) / (FILL_DURATION * 0.6), 0), 1)
          const r = b.r * easeOutCubic(localT)
          if (r > 0.5) drawBubble(b.x, b.y, r)
        }
        if (elapsed >= FILL_DURATION + HOLD) filling = false
        raf = requestAnimationFrame(tick)
        return
      }

      // Pop phase — no more clearing: everything drawn during fill stays put
      // except where a burst bubble explicitly punches a hole through it.
      const popElapsed = elapsed - FILL_DURATION - HOLD
      let allDone = true
      for (const b of bubbles) {
        if (b.popped) continue
        if (popElapsed < b.popDelay) {
          allDone = false
          continue
        }
        const popT = Math.min((popElapsed - b.popDelay) / POP_DUR, 1)
        if (popT < 1) allDone = false

        // Thin expanding ring flourish so it reads as bursting, not blinking out.
        const ringR = b.r * (1 + easeInCubic(popT) * 0.9)
        ctx.beginPath()
        ctx.arc(b.x, b.y, ringR, 0, Math.PI * 2)
        ctx.lineWidth = 2
        ctx.strokeStyle = `hsla(${settings.hue}, 85%, 85%, ${(1 - popT) * 0.8})`
        ctx.stroke()

        // Punch straight through the canvas, revealing the page beneath.
        ctx.save()
        ctx.globalCompositeOperation = 'destination-out'
        ctx.beginPath()
        ctx.arc(b.x, b.y, b.r * (0.55 + popT * 0.75), 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(0,0,0,1)'
        ctx.fill()
        ctx.restore()

        if (popT >= 1) b.popped = true
      }

      if (!allDone) {
        raf = requestAnimationFrame(tick)
      } else {
        onDone()
      }
    }

    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [onDone, settings])

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  )
}

// Wraps the app's routes. After login (flag set by the OAuth callback, the
// email/password auth card, or the desktop fly-through) the freshly-navigated
// page mounts underneath, then this overlay bursts open over it with the
// bubble field above. No-op on normal nav / reduced-motion.
export default function TransitionOverlay({ children }) {
  const location = useLocation()
  const reduce = useReducedMotion()
  const [playing, setPlaying] = useState(false)

  useLayoutEffect(() => {
    const role = consumeArrival()
    if (!role || reduce) return
    setPlaying(true)
  }, [location.pathname, reduce])

  return (
    <>
      {children}
      {playing && <BubbleOverlay onDone={() => setPlaying(false)} />}
    </>
  )
}
