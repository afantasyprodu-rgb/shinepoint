import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useReducedMotion } from 'motion/react'
import { createNoise2D } from 'simplex-noise'
import { consumeArrival } from '../lib/transition'

// Soap-foam wipe replacing the old brand-fill "arrival" cover. The new route
// is already mounted underneath (React Router already swapped it in) — this
// overlay just covers it with a foam mass whose top edge is a noisy,
// ever-shifting line, then shrinks that edge up off the top of the screen so
// the reveal reads as foam receding upward. A separate unclipped canvas
// layers foam-blob texture along the edge plus rising, wobbling bubbles that
// drift up past the edge into the already-revealed page, so they read as
// "escaping" the wash rather than stopping dead at the boundary.
//
// Every run randomizes its own settings (points, foam height, bubble count/
// size, duration, hue) — no two wipes look the same. Bounded purple->pink
// ->blue hue arc (same idea as the soap-sheen accents elsewhere), not a
// full rainbow — thin-film soap really does stay in one band.
const HUE_ARC = [262, 322, 208] // purple, pink, blue

function lerp(a, b, t) {
  return a + (b - a) * t
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3)
}

function randRange(min, max) {
  return min + Math.random() * (max - min)
}

function buildSettings() {
  return {
    duration: randRange(1000, 1300),
    segment: randRange(34, 52), // px between edge sample points
    noiseAmp: randRange(26, 46), // px of noise wobble on the edge
    noiseFreq: randRange(0.006, 0.011),
    timeFreq: randRange(0.9, 1.6), // how fast the noise crawls sideways
    bubbleRate: randRange(28, 45), // ms between spawns
    bubbleMin: randRange(3, 6),
    bubbleMax: randRange(9, 18),
    hue: HUE_ARC[Math.floor(Math.random() * HUE_ARC.length)],
  }
}

function FoamOverlay({ onDone }) {
  const canvasRef = useRef(null)
  const pathRef = useRef(null)
  const clipId = useRef(`foam-clip-${Math.random().toString(36).slice(2)}`)

  useEffect(() => {
    const canvas = canvasRef.current
    const path = pathRef.current
    if (!canvas || !path) return

    const ctx = canvas.getContext('2d')
    const noise2D = createNoise2D()
    const settings = buildSettings()
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

    const xs = []
    for (let x = -settings.segment; x <= width + settings.segment; x += settings.segment) xs.push(x)

    const start = performance.now()
    let bubbles = []
    let lastSpawn = 0
    let raf

    function edgeYAt(x, baseY, t) {
      const n = noise2D(x * settings.noiseFreq, t * settings.timeFreq)
      return baseY + n * settings.noiseAmp
    }

    // Covers from above the top of the screen DOWN to the wavy edge, leaving
    // everything below the edge (down to the bottom) revealed. As baseY rises
    // (shrinks toward and past 0), the covered band shrinks to nothing.
    function pathFor(baseY, t) {
      const pts = xs.map((x) => [x, edgeYAt(x, baseY, t)])
      let d = `M ${pts[0][0]} -40 L ${pts[0][0]} ${pts[0][1]}`
      for (let i = 0; i < pts.length - 1; i++) {
        const [x0, y0] = pts[i]
        const [x1, y1] = pts[i + 1]
        const mx = (x0 + x1) / 2
        const my = (y0 + y1) / 2
        d += ` Q ${x0} ${y0} ${mx} ${my}`
      }
      const last = pts[pts.length - 1]
      d += ` L ${last[0]} -40 Z`
      return { d, pts }
    }

    function spawnBubble(pts) {
      const [x, y] = pts[Math.floor(Math.random() * pts.length)]
      bubbles.push({
        x: x + randRange(-14, 14),
        y,
        r: randRange(settings.bubbleMin, settings.bubbleMax),
        vy: randRange(0.7, 1.6),
        wobbleFreq: randRange(1.5, 3.5),
        wobbleAmp: randRange(6, 18),
        seed: Math.random() * Math.PI * 2,
        born: performance.now(),
        life: randRange(650, 1100),
      })
    }

    function tick(now) {
      const elapsed = now - start
      const t = Math.min(elapsed / settings.duration, 1)
      const eased = easeOutCubic(t)
      // Edge starts below the viewport bottom (fully covering) and rises to
      // a bit above the top (fully clearing, with room for the noise wobble).
      const baseY = lerp(height + settings.noiseAmp, -settings.noiseAmp * 2, eased)

      const { d, pts } = pathFor(baseY, elapsed * 0.001)
      path.setAttribute('d', d)

      ctx.clearRect(0, 0, width, height)

      // Foam texture: soft white blobs clustered along the current edge so
      // the boundary reads as foam, not a hard vector line.
      ctx.save()
      for (const [x, y] of pts) {
        const r = settings.noiseAmp * 0.55
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r)
        grad.addColorStop(0, 'rgba(255,255,255,0.9)')
        grad.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()

      // Shine sweep — a soft diagonal light band crossing once over the run.
      const shineX = lerp(-width * 0.4, width * 1.4, eased)
      const shineGrad = ctx.createLinearGradient(shineX - 90, 0, shineX + 90, height)
      shineGrad.addColorStop(0, 'rgba(255,255,255,0)')
      shineGrad.addColorStop(0.5, `hsla(${settings.hue}, 90%, 92%, 0.35)`)
      shineGrad.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = shineGrad
      ctx.fillRect(0, Math.max(baseY - 60, -60), width, 160)

      // Bubbles: spawn while the foam is still mostly covering, then let the
      // existing ones keep rising/wobbling/fading even after spawn stops.
      if (t < 0.75 && now - lastSpawn > settings.bubbleRate) {
        spawnBubble(pts)
        lastSpawn = now
      }
      bubbles = bubbles.filter((b) => {
        const age = now - b.born
        if (age > b.life || b.y < -40) return false
        b.y -= b.vy
        b.vy *= 0.992
        const x = b.x + Math.sin(elapsed * 0.001 * b.wobbleFreq + b.seed) * (b.wobbleAmp * 0.02)
        const lifeT = age / b.life
        const alpha = lifeT < 0.15 ? lifeT / 0.15 : 1 - Math.max(0, (lifeT - 0.6) / 0.4)
        ctx.beginPath()
        ctx.arc(x, b.y, b.r, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${settings.hue}, 85%, 96%, ${Math.max(alpha, 0) * 0.85})`
        ctx.fill()
        ctx.lineWidth = 1
        ctx.strokeStyle = `hsla(${settings.hue}, 70%, 88%, ${Math.max(alpha, 0) * 0.6})`
        ctx.stroke()
        return true
      })

      if (t < 1 || bubbles.length > 0) {
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
  }, [onDone])

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden">
      <svg width="0" height="0" className="absolute">
        <defs>
          <clipPath id={clipId.current} clipPathUnits="userSpaceOnUse">
            <path ref={pathRef} d="M0 0" />
          </clipPath>
        </defs>
      </svg>
      <div
        className="absolute inset-0 bg-[#f3effa]"
        style={{ clipPath: `url(#${clipId.current})` }}
      />
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  )
}

// Wraps the app's routes. After login (flag set by the OAuth callback or the
// desktop fly-through) the freshly-navigated page mounts underneath, then
// this overlay washes over it with the foam wipe above. No-op on normal
// nav / reduced-motion, same as the arrival cover it replaces.
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
      {playing && <FoamOverlay onDone={() => setPlaying(false)} />}
    </>
  )
}
