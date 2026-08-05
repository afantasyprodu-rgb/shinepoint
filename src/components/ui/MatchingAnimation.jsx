import { useEffect, useRef } from 'react';

// ponytail: seeded PRNG (mulberry32) instead of a random-lib dependency
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Particles drift, then converge on a center point as `progress` (0-1) rises —
 * visualizes "searching for your detailer" during matching/booking search.
 * Seeded so the same seed always looks the same (e.g. seed = booking id).
 */
export default function MatchingAnimation({
  progress = 0,
  seed = 1,
  particleCount = 60,
  className = '',
}) {
  const canvasRef = useRef(null);
  const particlesRef = useRef(null);
  const rafRef = useRef(null);
  const progressRef = useRef(progress);
  progressRef.current = progress;

  useEffect(() => {
    const rand = mulberry32(seed);
    particlesRef.current = Array.from({ length: particleCount }, () => {
      const angle = rand() * Math.PI * 2;
      const radius = 0.35 + rand() * 0.6;
      return {
        angle,
        radius,
        speed: 0.15 + rand() * 0.3,
        wobble: rand() * Math.PI * 2,
        size: 1.5 + rand() * 2.5,
      };
    });
  }, [seed, particleCount]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    const brand = getComputedStyle(document.documentElement).getPropertyValue('--color-brand-500').trim() || '#a78bfa';
    const cta = getComputedStyle(document.documentElement).getPropertyValue('--color-cta-500').trim() || '#22c55e';

    function resize() {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    }
    resize();
    window.addEventListener('resize', resize);

    let t = 0;
    function draw() {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const cx = w / 2;
      const cy = h / 2;
      const maxR = Math.min(w, h) / 2;
      const p = progressRef.current;

      ctx.clearRect(0, 0, w, h);
      t += 0.016;

      for (const particle of particlesRef.current) {
        const drift = Math.sin(t * particle.speed + particle.wobble) * 0.05;
        const r = maxR * particle.radius * (1 - p) * (1 + drift);
        const angle = particle.angle + t * particle.speed * 0.2;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        const size = particle.size * (1 + p * 1.5);

        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fillStyle = p > 0.85 ? cta : brand;
        ctx.globalAlpha = 0.35 + p * 0.5;
        ctx.fill();
      }

      ctx.globalAlpha = Math.min(1, p * 1.2);
      ctx.beginPath();
      ctx.arc(cx, cy, 6 + p * 4, 0, Math.PI * 2);
      ctx.fillStyle = cta;
      ctx.fill();
      ctx.globalAlpha = 1;

      rafRef.current = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className={`h-full w-full ${className}`} />;
}
