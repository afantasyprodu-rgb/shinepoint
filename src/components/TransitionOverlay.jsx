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
    const baseR = Math.max(18, Math.min(width, height) / 14)
    const clusterSpacing = baseR * 3.1
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
        const count = Math.round(randRange(4, 8))
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
    const fillerCount = Math.round((width * height) / (baseR * baseR * 5.5))
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

// ── Shine overlay: a bright glare sweeps diagonally across the screen,
// sparkles twinkling just ahead of it, wiping the wash away as it passes —
// like a detailer's cloth catching the light while buffing a car to a shine.
// Unlike the bubble burst's radial reveal, this one wipes in a single
// direction, so the two transitions read as genuinely different moments.
const SHINE_FILL_HOLD = 260 // opaque wash + ambient sparkle twinkle before the wipe starts
const SHINE_WIPE_DUR = 780 // time for the glare band to cross the whole diagonal
const SHINE_FADE_DUR = 320 // final fade for any sliver the wipe didn't quite clear

function buildShineSettings() {
  // The sweep direction is just an angle — rotating it by another 180°
  // reverses which corner the wipe starts from, so "reverse" doesn't need
  // separate handling anywhere else, it's baked into this one number.
  const baseAngle = randRange(-35, -15) * (Math.PI / 180)
  const flipped = Math.random() < 0.5 ? Math.PI : 0
  return {
    hue: randomHue(),
    angle: baseAngle + flipped,
  }
}

function ShineOverlay({ onDone }) {
  const canvasRef = useRef(null)
  const [settings] = useState(buildShineSettings)
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

    const diag = Math.hypot(width, height)
    const cos = Math.cos(settings.angle)
    const sin = Math.sin(settings.angle)
    // Every point's position along the sweep axis, so the wipe/sparkle logic
    // never has to touch pixels directly — just compare this one number
    // against the band's current position.
    function axisPos(x, y) {
      return (x - width / 2) * cos + (y - height / 2) * sin
    }

    const BAND_WIDTH = diag * 0.16
    const start0 = -diag / 2 - BAND_WIDTH
    const end0 = diag / 2 + BAND_WIDTH

    // Sparkles scattered across the whole viewport, each keyed to where it
    // sits along the sweep axis so it only twinkles as the glare band
    // reaches it — not all at once.
    const sparkleCount = Math.round((width * height) / 9000)
    const sparkles = []
    for (let i = 0; i < sparkleCount; i++) {
      const x = randRange(0, width)
      const y = randRange(0, height)
      sparkles.push({
        x,
        y,
        axis: axisPos(x, y),
        r: randRange(1.5, 4),
        seed: Math.random() * Math.PI * 2,
      })
    }
    // A handful of ambient sparkles twinkle during the ho ld phase too, spread
    // independently of the sweep so the pre-wipe moment isn't static.
    const ambientCount = Math.round(sparkleCount * 0.4)
    const ambient = []
    for (let i = 0; i < ambientCount; i++) {
      ambient.push({
        x: randRange(0, width),
        y: randRange(0, height),
        r: randRange(1, 3),
        delay: randRange(0, SHINE_FILL_HOLD),
        life: randRange(220, 420),
      })
    }

    function drawSparkle(x, y, r, alpha) {
      if (alpha <= 0) return
      ctx.save()
      ctx.translate(x, y)
      ctx.globalAlpha = alpha
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      // Four-point sparkle (a stretched diamond cross), reads as a glint
      // rather than a plain dot.
      ctx.moveTo(0, -r * 2.2)
      ctx.quadraticCurveTo(r * 0.3, -r * 0.3, r * 2.2, 0)
      ctx.quadraticCurveTo(r * 0.3, r * 0.3, 0, r * 2.2)
      ctx.quadraticCurveTo(-r * 0.3, r * 0.3, -r * 2.2, 0)
      ctx.quadraticCurveTo(-r * 0.3, -r * 0.3, 0, -r * 2.2)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }

    const start = performance.now()
    let raf
    let finished = false

    function tick(now) {
      const elapsed = now - start

      if (elapsed < SHINE_FILL_HOLD) {
        ctx.clearRect(0, 0, width, height)
        // Saturated enough to read clearly against the app's own light
        // background (the earlier low-saturation version blended in and
        // was nearly invisible) — matches the bubble overlay's vividness.
        ctx.fillStyle = `hsl(${settings.hue} 70% 78%)`
        ctx.fillRect(0, 0, width, height)
        // Sheen across the whole wash so it doesn't sit flat.
        const sheenGrad = ctx.createLinearGradient(0, 0, width, height)
        sheenGrad.addColorStop(0, `hsla(${settings.hue}, 80%, 95%, 0.7)`)
        sheenGrad.addColorStop(0.5, `hsla(${settings.hue}, 60%, 70%, 0.2)`)
        sheenGrad.addColorStop(1, `hsla(${settings.hue}, 80%, 95%, 0.7)`)
        ctx.fillStyle = sheenGrad
        ctx.fillRect(0, 0, width, height)

        for (const s of ambient) {
          const age = elapsed - s.delay
          if (age < 0 || age > s.life) continue
          const lifeT = age / s.life
          const alpha = lifeT < 0.5 ? lifeT * 2 : (1 - lifeT) * 2
          drawSparkle(s.x, s.y, s.r, alpha * 0.9)
        }
        raf = requestAnimationFrame(tick)
        return
      }

      const wipeElapsed = elapsed - SHINE_FILL_HOLD
      const t = Math.min(wipeElapsed / SHINE_WIPE_DUR, 1)
      const eased = easeInCubic(t) * 0.5 + t * 0.5 // slight ease-in, mostly linear so it feels like one steady sweep
      const bandCenter = start0 + (end0 - start0) * eased

      // Draw the glare band fresh at its new position (source-over), then
      // erase everything the trailing edge has already passed — the erase
      // never reaches into the band itself, so it always reads as a bright
      // edge with a clean reveal behind it and the untouched wash ahead.
      ctx.save()
      ctx.translate(width / 2, height / 2)
      ctx.rotate(settings.angle)
      const grad = ctx.createLinearGradient(bandCenter - BAND_WIDTH, 0, bandCenter + BAND_WIDTH, 0)
      grad.addColorStop(0, 'rgba(255,255,255,0)')
      grad.addColorStop(0.42, `hsla(${settings.hue}, 70%, 92%, 0.85)`)
      grad.addColorStop(0.5, 'rgba(255,255,255,0.98)')
      grad.addColorStop(0.58, `hsla(${settings.hue}, 70%, 92%, 0.85)`)
      grad.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = grad
      ctx.fillRect(bandCenter - BAND_WIDTH, -diag, BAND_WIDTH * 2, diag * 2)
      ctx.restore()

      // Sparkles twinkle as the band's leading edge nears them.
      for (const s of sparkles) {
        const dist = Math.abs(s.axis - bandCenter)
        if (dist > BAND_WIDTH * 1.4) continue
        const alpha = Math.max(0, 1 - dist / (BAND_WIDTH * 1.4))
        const twinkle = 0.6 + 0.4 * Math.sin(elapsed * 0.02 + s.seed)
        drawSparkle(s.x, s.y, s.r, alpha * twinkle)
      }

      ctx.save()
      ctx.translate(width / 2, height / 2)
      ctx.rotate(settings.angle)
      ctx.globalCompositeOperation = 'destination-out'
      const eraseTo = bandCenter - BAND_WIDTH
      const eraseFrom = start0 - BAND_WIDTH
      // Erase from the sweep's own start point (nothing before it ever needs
      // erasing) up to the band's trailing edge.
      ctx.fillStyle = 'rgba(0,0,0,1)'
      ctx.fillRect(eraseFrom, -diag, eraseTo - eraseFrom, diag * 2)
      ctx.restore()

      if (t >= 1) {
        if (!finished) {
          finished = true
          setFading(true)
          setTimeout(onDone, SHINE_FADE_DUR)
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
        style={{ opacity: fading ? 0 : 1, transition: `opacity ${SHINE_FADE_DUR}ms ease-out` }}
      />
    </div>
  )
}

const OVERLAY_VARIANTS = [BubbleOverlay, ShineOverlay]

// Wraps the app's routes. After login (flag set by the OAuth callback, the
// email/password auth card, or the desktop fly-through) the freshly-navigated
// page mounts underneath, then this overlay plays one of two random
// transitions over it: a full-screen bubble burst, or a diagonal shine/glare
// sweep with sparkles. No-op on normal nav / reduced-motion.
export default function TransitionOverlay({ children }) {
  const location = useLocation()
  const reduce = useReducedMotion()
  const [playing, setPlaying] = useState(false)
  const [Variant, setVariant] = useState(null)

  useLayoutEffect(() => {
    const role = consumeArrival()
    if (!role || reduce) return
    setVariant(() => OVERLAY_VARIANTS[Math.floor(Math.random() * OVERLAY_VARIANTS.length)])
    setPlaying(true)
  }, [location.pathname, reduce])

  return (
    <>
      {children}
      {playing && Variant && <Variant onDone={() => setPlaying(false)} />}
    </>
  )
}
