import { useEffect, useRef, useState } from 'react'

// Drop-in replacement for a truncated one-line label. Measures whether the
// text actually overflows its box and, only then, auto-scrolls it back and
// forth so the full sentence becomes readable without any tap/hover — text
// that already fits just renders as a normal static line.
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
        style={distance ? { '--marquee-distance': `-${distance}px` } : undefined}
      >
        {children}
      </span>
    </span>
  )
}
