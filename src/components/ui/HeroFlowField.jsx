import { useEffect, useRef } from 'react';

// ponytail: seeded PRNG + value-noise, no dependency (same pattern as MatchingAnimation)
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeNoise2D(seed) {
  const rand = mulberry32(seed);
  const grad = Array.from({ length: 256 }, () => rand() * Math.PI * 2);
  const perm = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  const p = [...perm, ...perm];
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + t * (b - a);
  const gradAt = (ix, iy, x, y) => {
    const a = grad[p[(ix + p[iy & 255]) & 255] & 255];
    return Math.cos(a) * x + Math.sin(a) * y;
  };
  return (x, y) => {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const xf = x - x0, yf = y - y0;
    const u = fade(xf), v = fade(yf);
    const n00 = gradAt(x0, y0, xf, yf);
    const n10 = gradAt(x0 + 1, y0, xf - 1, yf);
    const n01 = gradAt(x0, y0 + 1, xf, yf - 1);
    const n11 = gradAt(x0 + 1, y0 + 1, xf - 1, yf - 1);
    return lerp(lerp(n00, n10, u), lerp(n01, n11, u), v);
  };
}

/**
 * Flow-field of drifting particles for hero backgrounds — organic turbulence,
 * seeded so it's reproducible, colored from the live brand/cta ramp.
 */
export default function HeroFlowField({
  seed = 1,
  particleCount = 140,
  speed = 0.6,
  className = '',
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const noise = makeNoise2D(seed);
    const rand = mulberry32(seed + 1);

    const brand = getComputedStyle(document.documentElement).getPropertyValue('--color-brand-500').trim() || '#a78bfa';
    const cta = getComputedStyle(document.documentElement).getPropertyValue('--color-cta-500').trim() || '#22c55e';

    let w = 0, h = 0;
    function resize() {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = 'rgba(0,0,0,0)';
      ctx.clearRect(0, 0, w, h);
    }
    resize();
    window.addEventListener('resize', resize);

    const particles = Array.from({ length: particleCount }, () => ({
      x: rand() * w,
      y: rand() * h,
      life: rand(),
    }));

    let raf;
    let t = 0;
    function draw() {
      t += 0.003 * speed;
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(0, 0, w, h);

      for (const pt of particles) {
        const n = noise(pt.x * 0.004, pt.y * 0.004 + t);
        const angle = n * Math.PI * 2;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;

        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y);
        pt.x += vx;
        pt.y += vy;
        ctx.lineTo(pt.x, pt.y);

        const velocity = Math.hypot(vx, vy);
        ctx.strokeStyle = velocity > speed * 0.7 ? cta : brand;
        ctx.globalAlpha = 0.25 + Math.min(velocity / speed, 1) * 0.35;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        pt.life -= 0.0025;
        if (pt.life <= 0 || pt.x < 0 || pt.x > w || pt.y < 0 || pt.y > h) {
          pt.x = rand() * w;
          pt.y = rand() * h;
          pt.life = 1;
        }
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [seed, particleCount, speed]);

  return <canvas ref={canvasRef} className={`h-full w-full ${className}`} />;
}
