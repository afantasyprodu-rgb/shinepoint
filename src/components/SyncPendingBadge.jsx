import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { subscribeQueueSize } from '../lib/offlineQueue'

// Surfaces the offline retry queue (status updates, location pings queued
// while a detailer had no signal) so a tap that silently didn't reach the
// server doesn't look like it just... didn't happen. Renders nothing once
// the queue drains back to empty.
export default function SyncPendingBadge({ className = '' }) {
  const [count, setCount] = useState(0)

  useEffect(() => subscribeQueueSize(setCount), [])

  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.span
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className={`chip bg-amber-500/15 text-amber-700 dark:text-amber-300 ${className}`}
          title="Some updates couldn't reach the server yet — they'll send automatically once you're back in signal."
        >
          {count} syncing…
        </motion.span>
      )}
    </AnimatePresence>
  )
}
