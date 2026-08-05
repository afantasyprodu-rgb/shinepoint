import { useEffect, useRef } from 'react';

// ponytail: seeded PRNG, same pattern as HeroFlowField/MatchingAnimation
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
 * Soap-bubble field rising and drifting — brand fit for a detailing marketplace.
 * Bubbles get a thin rim-light ring + faint highlight, sized/spaced from the seed.
 */
export default function HeroBubbles({
  seed = 1,
  bubbleCount = 26,
  speed = 0.5,
  className = '',
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rand = mulberry32(seed);

    // ponytail: re-read every frame (not once at mount) so bubbles follow
    // ThemeContext's live --brand-h/--cta-h hue shifts and paint-derived accent.
    const rootStyle = () => getComputedStyle(document.documentElement);
    function colors() {
      const s = rootStyle();
      return {
        brand: s.getPropertyValue('--color-brand-500').trim() || '#a78bfa',
        brandLight: s.getPropertyValue('--color-brand-300').trim() || '#d8b4fe',
        cta: s.getPropertyValue('--color-cta-500').trim() || '#22c55e',
      };
    }

    let w = 0, h = 0;
    function resize() {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    function spawn(fromBottom) {
      return {
        x: rand() * w,
        y: fromBottom ? h + rand() * 60 : rand() * h,
        r: 6 + rand() * 22,
        wobble: rand() * Math.PI * 2,
        wobbleSpeed: 0.4 + rand() * 0.8,
        rise: (0.3 + rand() * 0.7) * speed,
        hueCta: rand() < 0.2,
      };
    }
    const bubbles = Array.from({ length: bubbleCount }, () => spawn(false));

    let raf;
    let t = 0;
    let frame = 0;
    let c = colors();
    function draw() {
      t += 0.02;
      // re-read CSS vars a few times a second, not every frame — cheap enough
      // to react to a hue-shift click almost instantly, without the per-frame cost
      if (frame % 20 === 0) c = colors();
      frame++;
      ctx.clearRect(0, 0, w, h);

      for (const b of bubbles) {
        const drift = Math.sin(t * b.wobbleSpeed + b.wobble) * 0.6;
        b.x += drift;
        b.y -= b.rise;
        if (b.y < -b.r * 2) Object.assign(b, spawn(true));

        const color = b.hueCta ? c.cta : c.brand;
        const grad = ctx.createRadialGradient(
          b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.1,
          b.x, b.y, b.r
        );
        grad.addColorStop(0, 'rgba(255,255,255,0.35)');
        grad.addColorStop(0.35, `color-mix(in oklch, ${c.brandLight} 20%, transparent)`);
        grad.addColorStop(1, `color-mix(in oklch, ${color} 8%, transparent)`);

        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.22, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [seed, bubbleCount, speed]);

  return <canvas ref={canvasRef} className={`h-full w-full ${className}`} />;
}
