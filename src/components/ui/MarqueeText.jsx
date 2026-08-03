import { useEffect, useRef, useState } from 'react'

// Slow, constant px/s so a long sentence doesn't blow past in the same time
// as a short one — duration scales with distance instead of being fixed.
const PX_PER_SECOND = 28
const MIN_DURATION_S = 5

// Drop-in replacement for a truncated one-line label. Measures whether the
// text actually overflows its box and, only then, auto-scrolls it — once,
// left, at a steady speed — so the full sentence becomes readable without
// any tap/hover. Loops by resetting to the start rather than animating a
// return trip. Text that already fits just renders as a normal static line.
export default function MarqueeText({ children, className = '' }) {
  // Two refs on purpose: measuring against the element whose own class we
  // toggle creates a feedback loop (switching it to inline-block for the
  // scroll changes ITS box, which re-fires a ResizeObserver watching it,
  // which flips the class back, forever restarting the animation at 0%).
  // The outer wrapper's box is fixed by the flex layout regardless of what
  // the inner span does, so observing that instead is stable.
  const outerRef = useRef(null)
  const innerRef = useRef(null)
  const [distance, setDistance] = useState(0)

  useEffect(() => {
    const outer = outerRef.current
    const inner = innerRef.current
    if (!outer || !inner) return
    const measure = () => {
      const overflow = inner.scrollWidth - outer.clientWidth
      setDistance((prev) => {
        const next = overflow > 2 ? overflow : 0
        return prev === next ? prev : next
      })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(outer)
    return () => ro.disconnect()
  }, [children])

  return (
    <span ref={outerRef} className={`block overflow-hidden whitespace-nowrap ${className}`}>
      <span
        ref={innerRef}
        className={distance ? 'marquee-text' : 'block truncate'}
        style={
          distance
            ? {
                '--marquee-distance': `-${distance}px`,
                '--marquee-duration': `${Math.max(MIN_DURATION_S, distance / PX_PER_SECOND)}s`,
              }
            : undefined
        }
      >
        {children}
      </span>
    </span>
  )
}
