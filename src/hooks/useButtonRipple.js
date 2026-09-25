import { useEffect } from 'react'

// One delegated listener gives every `.btn` a water ripple from the press
// point. The ripple span removes itself when its animation ends.
export default function useButtonRipple() {
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    function onDown(e) {
      const btn = e.target.closest?.('.btn')
      if (!btn || btn.disabled) return
      const rect = btn.getBoundingClientRect()
      const size = Math.max(rect.width, rect.height) * 2
      const dot = document.createElement('span')
      dot.className = 'btn-ripple'
      dot.setAttribute('aria-hidden', 'true')
      dot.style.width = dot.style.height = `${size}px`
      dot.style.left = `${e.clientX - rect.left - size / 2}px`
      dot.style.top = `${e.clientY - rect.top - size / 2}px`
      dot.addEventListener('animationend', () => dot.remove(), { once: true })
      btn.appendChild(dot)
    }
    document.addEventListener('pointerdown', onDown, { passive: true })
    return () => document.removeEventListener('pointerdown', onDown)
  }, [])
}
