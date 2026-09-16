import { useRef } from 'react'
import { ChevronLeftIcon } from './icons'

/**
 * Left-edge grab tab that opens the detailer Tools drawer.
 * Tap or swipe-right (distance ~50px or fast flick) calls onOpen.
 * Hidden while the drawer is open (covers the left edge).
 */
export default function ToolsEdgeTab({ onOpen, ariaLabel, label }) {
  const startX = useRef(0)
  const startY = useRef(0)
  const startT = useRef(0)
  const tracking = useRef(false)
  const openedByGesture = useRef(false)

  const DISTANCE_PX = 50
  const VELOCITY = 0.45 // px/ms â‰ˆ 450px/s

  function open() {
    onOpen?.()
  }

  function onPointerDown(e) {
    if (e.button != null && e.button !== 0) return
    tracking.current = true
    openedByGesture.current = false
    startX.current = e.clientX
    startY.current = e.clientY
    startT.current = performance.now()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* older WebViews */
    }
  }

  function onPointerMove(e) {
    if (!tracking.current) return
    const dx = e.clientX - startX.current
    const dy = Math.abs(e.clientY - startY.current)
    // Prefer horizontal intent; ignore mostly-vertical scrolls.
    if (dx > DISTANCE_PX && dx > dy * 1.2) {
      openedByGesture.current = true
      tracking.current = false
      open()
    }
  }

  function onPointerUp(e) {
    if (!tracking.current && !openedByGesture.current) {
      // Already opened mid-drag.
      return
    }
    const wasTracking = tracking.current
    tracking.current = false
    if (openedByGesture.current) return

    const dx = e.clientX - startX.current
    const dy = Math.abs(e.clientY - startY.current)
    const dt = Math.max(1, performance.now() - startT.current)
    const v = dx / dt

    if (wasTracking && ((dx > DISTANCE_PX && dx > dy) || (v > VELOCITY && dx > 24))) {
      open()
      return
    }
    // Tap / short press â€” treat as open (also covered by onClick).
    if (wasTracking && Math.hypot(dx, dy) < 12) {
      open()
    }
  }

  function onPointerCancel() {
    tracking.current = false
  }

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={() => {
        // Click covers keyboard / accessibility activation; gestures use pointer.
        if (openedByGesture.current) return
        open()
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      // Flush left edge, mid-height, clear of header + bottom tab + safe areas.
      // Rounded on the right only so it reads as a tab peeking from the side.
      className="nx-neu press-spring fixed left-0 z-[650] flex h-28 w-7 cursor-pointer touch-none flex-col items-center justify-center gap-1 rounded-r-2xl border border-l-0 border-brand-100/80 bg-white/95 text-slate-600 shadow-[2px_0_12px_-2px_rgba(30,41,59,0.28)] backdrop-blur transition-transform duration-150 hover:w-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 active:scale-[0.98] dark:border-white/10 dark:bg-[#1E1730]/95 dark:text-slate-200 dark:shadow-black/40"
      style={{
        top: 'max(calc(env(safe-area-inset-top) + 5.5rem), 38%)',
        // Keep clear of bottom tab bar (~4rem) + home indicator.
        maxHeight: 'calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 9rem)',
      }}
    >
      {/* Grab ridges */}
      <span className="h-8 w-1 rounded-full bg-slate-300/90 dark:bg-slate-500/80" aria-hidden="true" />
      <ChevronLeftIcon
        className="h-3.5 w-3.5 rotate-180 text-brand-600 dark:text-brand-300"
        aria-hidden="true"
      />
      <span
        className="mt-0.5 select-none text-[9px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
        style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        aria-hidden="true"
      >
        {label || ariaLabel}
      </span>
    </button>
  )
}
