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
const FADE_DUR = 380 // final fade for any wash the pop wave didn't clear

function buildSettings() {
  return { hue: randomHue() }
}

function BubbleOverlay({ onDone }) {
  const canvasRef = useRef(null)
  const [settings] = useState(buildSettings)
  const [fading, setFading] = useState(false)

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

    // Loose foam clusters rather than a uniform grid: scatter clump centers
    // across a jittered coarse grid (so clumps spread out roughly evenly
    // without looking mechanical), then pile a handful of bubbles of wildly
    // varying size around each center, plus stray fillers scattered
    // independently to break up any remaining pattern. Each bubble is drawn
    // as a rotated ellipse (not a perfect circle) for an organic, non-uniform
    // blob shape. The opaque base wash painted every fill-phase frame means
    // this field doesn't need to geometrically tile the screen — it's free
    // to be gappy and irregular, like real foam.
    const baseR = Math.max(14, Math.min(width, height) / 18)
    const clusterSpacing = baseR * 2.6
    const bubbles = []

    function addBubble(x, y, r) {
      bubbles.push({
        x,
        y,
        r,
        rx: r * randRange(0.8, 1.25),
        ry: r * randRange(0.8, 1.25),
        rot: Math.random() * Math.PI,
        fillDelay: randRange(0, FILL_DURATION * 0.55),
        popped: false,
      })
    }

    for (let gy = -clusterSpacing; gy < height + clusterSpacing; gy += clusterSpacing) {
      for (let gx = -clusterSpacing; gx < width + clusterSpacing; gx += clusterSpacing) {
        const centerX = gx + randRange(-clusterSpacing * 0.4, clusterSpacing * 0.4)
        const centerY = gy + randRange(-clusterSpacing * 0.4, clusterSpacing * 0.4)
        const clusterScale = baseR * randRange(0.55, 1.6) // some clumps run big, some tiny
        const count = Math.round(randRange(5, 11))
        for (let i = 0; i < count; i++) {
          const ang = Math.random() * Math.PI * 2
          const dist = randRange(0, clusterScale * 1.2)
          addBubble(
            centerX + Math.cos(ang) * dist,
            centerY + Math.sin(ang) * dist,
            clusterScale * randRange(0.45, 1.2)
          )
        }
      }
    }
    // Stray fillers scattered independently of any cluster, sized much more
    // freely (some tiny, some big outliers) to keep the field from ever
    // reading as a repeated stamp.
    const fillerCount = Math.round((width * height) / (baseR * baseR * 3.5))
    for (let i = 0; i < fillerCount; i++) {
      addBubble(randRange(0, width), randRange(0, height), baseR * randRange(0.2, 1.4))
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
    let finished = false

    // scale is the 0..1 grow-in progress; b.rx/b.ry are the bubble's settled
    // (irregular) radii, so the whole ellipse — not just a circle — scales
    // in together.
    function drawBubble(b, scale) {
      const rx = b.rx * scale
      const ry = b.ry * scale
      const rMax = Math.max(rx, ry)
      ctx.save()
      ctx.translate(b.x, b.y)
      ctx.rotate(b.rot)
      const grad = ctx.createRadialGradient(-rx * 0.3, -ry * 0.3, 0, 0, 0, rMax)
      grad.addColorStop(0, `hsla(${settings.hue}, 90%, 88%, 0.92)`)
      grad.addColorStop(0.6, `hsla(${settings.hue}, 85%, 76%, 0.88)`)
      grad.addColorStop(1, `hsla(${settings.hue}, 80%, 62%, 0.85)`)
      ctx.beginPath()
      ctx.ellipse(0, 0, Math.max(rx, 0.1), Math.max(ry, 0.1), 0, 0, Math.PI * 2)
      ctx.fillStyle = grad
      ctx.fill()
      ctx.lineWidth = 1.25
      ctx.strokeStyle = `hsla(${settings.hue}, 70%, 55%, 0.5)`
      ctx.stroke()
      // Specular highlight — the classic glossy-sphere cue that reads "wet."
      ctx.beginPath()
      ctx.ellipse(-rx * 0.32, -ry * 0.32, Math.max(rx * 0.22, 1), Math.max(ry * 0.22, 1), 0, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,255,255,0.75)'
      ctx.fill()
      ctx.restore()
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
          const scale = easeOutCubic(localT)
          if (scale > 0.02) drawBubble(b, scale)
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

        // Thin expanding ring flourish (matching the bubble's own ellipse
        // shape/rotation) so it reads as bursting, not blinking out.
        const growth = 1 + easeInCubic(popT) * 0.9
        ctx.save()
        ctx.translate(b.x, b.y)
        ctx.rotate(b.rot)
        ctx.beginPath()
        ctx.ellipse(0, 0, b.rx * growth, b.ry * growth, 0, 0, Math.PI * 2)
        ctx.lineWidth = 2
        ctx.strokeStyle = `hsla(${settings.hue}, 85%, 85%, ${(1 - popT) * 0.8})`
        ctx.stroke()
        ctx.restore()

        // Punch straight through the canvas, revealing the page beneath.
        const eraseGrowth = 0.55 + popT * 0.75
        ctx.save()
        ctx.translate(b.x, b.y)
        ctx.rotate(b.rot)
        ctx.globalCompositeOperation = 'destination-out'
        ctx.beginPath()
        ctx.ellipse(0, 0, b.rx * eraseGrowth, b.ry * eraseGrowth, 0, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(0,0,0,1)'
        ctx.fill()
        ctx.restore()

        if (popT >= 1) b.popped = true
      }

      if (allDone) {
        // Clustered/irregular placement doesn't geometrically tile the
        // screen the way a grid did, so a thin residual wash can survive
        // between clumps. Rather than snap-clear it, fade the whole canvas
        // out via CSS opacity — reads as the last bit of soap dissolving
        // instead of an abrupt cut.
        if (!finished) {
          finished = true
          setFading(true)
          setTimeout(onDone, FADE_DUR)
        }
        return
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [onDone, settings])

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ opacity: fading ? 0 : 1, transition: `opacity ${FADE_DUR}ms ease-out` }}
      />
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
