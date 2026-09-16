/** Inline sparkles / icons for Client Book (no hearts). */
export function Sparkle({ className = 'h-4 w-4', color = 'currentColor' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={color} aria-hidden="true">
      <path d="M12 2.5c.35 3.6 1.9 5.15 5.5 5.5-3.6.35-5.15 1.9-5.5 5.5-.35-3.6-1.9-5.15-5.5-5.5 3.6-.35 5.15-1.9 5.5-5.5Z" />
    </svg>
  )
}

export function CarSilhouette({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 14.5 4.2 10a2 2 0 0 1 1.9-1.35h11.8A2 2 0 0 1 19.8 10l1.2 4.5M5 16.5h.01M19 16.5h.01M6.5 14.5h11" />
      <circle cx="7" cy="16.5" r="1.4" />
      <circle cx="17" cy="16.5" r="1.4" />
    </svg>
  )
}

export function PhoneIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 5.5c0 8 6.5 14.5 14.5 14.5l2-3.5-4-2-1.5 1.5a11 11 0 0 1-5-5L11 9l-2-4-3.5.5Z" />
    </svg>
  )
}

export function ChatIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 6.75A2.25 2.25 0 0 1 6.75 4.5h10.5A2.25 2.25 0 0 1 19.5 6.75v7.5A2.25 2.25 0 0 1 17.25 16.5H9l-4.5 3v-3.75A2.25 2.25 0 0 1 4.5 14.25v-7.5Z" />
    </svg>
  )
}
