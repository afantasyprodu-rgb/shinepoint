import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { subscribeQueueSize } from '../lib/offlineQueue'
import { subscribePhotoQueueSize } from '../lib/photoQueue'

// Surfaces the offline retry queues (status updates, location pings, and
// photo/damage-report uploads queued while a detailer had no signal) so a
// tap or a shot that silently didn't reach the server doesn't look like it
// just... didn't happen. Renders nothing once both queues drain to empty.
export default function SyncPendingBadge({ className = '' }) {
  const [dataCount, setDataCount] = useState(0)
  const [photoCount, setPhotoCount] = useState(0)
  const count = dataCount + photoCount

  useEffect(() => subscribeQueueSize(setDataCount), [])
  useEffect(() => subscribePhotoQueueSize(setPhotoCount), [])

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
