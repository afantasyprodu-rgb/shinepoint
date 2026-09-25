import { useEffect, useRef, useState } from 'react'
import { ChevronLeftIcon } from './icons'

const STORAGE_KEY = 'shinepoint:tools-tab-top'
const TAB_HEIGHT = 112 // h-28
// Keep clear of the header (safe-area + ~5.5rem) and the bottom tab bar +
// home indicator (~9rem), same margins the old fixed `top` formula used.
const TOP_MARGIN = 88 // ~5.5rem
const BOTTOM_MARGIN = 144 // ~9rem

function clampTop(top) {
  const safeTop = TOP_MARGIN
  const safeBottom = window.innerHeight - BOTTOM_MARGIN - TAB_HEIGHT
  return Math.min(Math.max(top, safeTop), Math.max(safeTop, safeBottom))
}

function readStoredTop() {
  try {
    const v = Number(localStorage.getItem(STORAGE_KEY))
    return Number.isFinite(v) && v > 0 ? clampTop(v) : null
  } catch {
    return null
  }
}

function defaultTop() {
  // Same as the old fixed formula: max(headerClearance, 38% of viewport).
  return clampTop(Math.max(TOP_MARGIN, window.innerHeight * 0.38))
}

/**
 * Left-edge grab tab that opens the detailer Tools drawer.
 * Tap or swipe-right (distance ~50px or fast flick) calls onOpen.
 * Drag mostly-vertically to reposition the tab along the edge — the new
 * position is remembered (localStorage) across visits.
 * Hidden while the drawer is open (covers the left edge).
 */
export default function ToolsEdgeTab({ onOpen, ariaLabel, label }) {
  const startX = useRef(0)
  const startY = useRef(0)
  const startT = useRef(0)
  const startTop = useRef(0)
  const tracking = useRef(false)
  const openedByGesture = useRef(false)
  const draggingVertical = useRef(false)

  const [top, setTop] = useState(() => readStoredTop() ?? defaultTop())
  const [dragTop, setDragTop] = useState(null) // live position while dragging

  // Re-clamp on viewport resize/rotation so a saved position never strands
  // the tab off-screen or behind the header/bottom bar.
  useEffect(() => {
    function onResize() {
      setTop((t) => clampTop(t))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const DISTANCE_PX = 50
  const VELOCITY = 0.45 // px/ms ≈ 450px/s
  const VERTICAL_DRAG_PX = 10 // below this, a vertical wobble doesn't count as a drag

  function open() {
    onOpen?.()
  }

  function onPointerDown(e) {
    if (e.button != null && e.button !== 0) return
    tracking.current = true
    openedByGesture.current = false
    draggingVertical.current = false
    startX.current = e.clientX
    startY.current = e.clientY
    startT.current = performance.now()
    startTop.current = top
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* older WebViews */
    }
  }

  function onPointerMove(e) {
    if (!tracking.current) return
    const dx = e.clientX - startX.current
    const dy = e.clientY - startY.current
    const adx = Math.abs(dx)
    const ady = Math.abs(dy)

    // Once a gesture commits to vertical (reposition) or horizontal (open),
    // stick with it for the rest of this drag.
    if (!draggingVertical.current && ady > VERTICAL_DRAG_PX && ady > adx * 1.2) {
      draggingVertical.current = true
    }

    if (draggingVertical.current) {
      setDragTop(clampTop(startTop.current + dy))
      return
    }

    // Prefer horizontal intent; ignore mostly-vertical scrolls.
    if (dx > DISTANCE_PX && dx > ady * 1.2) {
      openedByGesture.current = true
      tracking.current = false
      open()
    }
  }

  function onPointerUp(e) {
    if (draggingVertical.current) {
      draggingVertical.current = false
      tracking.current = false
      const finalTop = clampTop(startTop.current + (e.clientY - startY.current))
      setTop(finalTop)
      setDragTop(null)
      try {
        localStorage.setItem(STORAGE_KEY, String(finalTop))
      } catch {
        /* private mode, ignore */
      }
      return
    }

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
    // Tap / short press — treat as open (also covered by onClick).
    if (wasTracking && Math.hypot(dx, dy) < 12) {
      open()
    }
  }

  function onPointerCancel() {
    tracking.current = false
    draggingVertical.current = false
    setDragTop(null)
  }

  const displayTop = dragTop ?? top

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
      // Flush left edge, draggable vertically. Rounded on the right only so
      // it reads as a tab peeking from the side.
      className={`nx-neu press-spring fixed left-0 z-[650] flex h-28 w-7 cursor-grab touch-none flex-col items-center justify-center gap-1 rounded-r-2xl border border-l-0 border-brand-100/80 bg-white/95 text-slate-600 shadow-[2px_0_12px_-2px_rgba(30,41,59,0.28)] backdrop-blur hover:w-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 active:cursor-grabbing active:scale-[0.98] dark:border-white/10 dark:bg-[#1E1730]/95 dark:text-slate-200 dark:shadow-black/40 ${
        dragTop != null ? '' : 'transition-transform duration-150'
      }`}
      style={{ top: displayTop }}
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
