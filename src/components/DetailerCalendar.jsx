import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, StatusPill } from './ui/bits'
import { ChevronDownIcon } from './icons'
import { useT } from '../i18n/useT'

// Month-grid schedule for the detailer dashboard (087, CRM audit Option C).
// Read-only jobs render as dots on their day; a 'pending' or 'accepted' job
// can be dragged onto a different day to reschedule it -- everything past
// that (buffer-conflict rejection, the customer notification) happens
// server-side in the 087 migration, not here. This component's only job is
// the interaction and showing the result.
//
// Drag is built on Pointer Events, not the HTML5 Drag and Drop API --
// native `draggable` doesn't fire from touch on a phone, which is most of
// this app's real usage. A pointerdown on a job card starts tracking;
// pointermove floats the card under the finger/cursor and highlights
// whichever day cell it's currently over (via elementFromPoint); pointerup
// resolves the drop.

function localDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const DRAGGABLE_STATUSES = new Set(['pending', 'accepted'])

function buildMonthGrid(viewDate) {
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstDow = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export default function DetailerCalendar({ jobs, onReschedule }) {
  const t = useT('detailerCalendar')
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d
  })
  const [selected, setSelected] = useState(() => localDateKey(new Date()))
  const [dragError, setDragError] = useState('')
  const [dragging, setDragging] = useState(null) // { job, x, y, offsetX, offsetY }
  const [dropKey, setDropKey] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const gridRef = useRef(null)
  const dragStateRef = useRef(null)

  const jobsByDay = useMemo(() => {
    const map = new Map()
    for (const b of jobs) {
      const key = localDateKey(new Date(b.scheduledTime))
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(b)
    }
    for (const list of map.values()) list.sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime))
    return map
  }, [jobs])

  const cells = useMemo(() => buildMonthGrid(viewDate), [viewDate])
  const todayKey = localDateKey(new Date())
  const selectedJobs = jobsByDay.get(selected) ?? []

  function changeMonth(delta) {
    setViewDate((d) => {
      const next = new Date(d)
      next.setMonth(next.getMonth() + delta)
      return next
    })
  }

  function startDrag(job, e) {
    if (!DRAGGABLE_STATUSES.has(job.status)) return
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    dragStateRef.current = { job, pointerId: e.pointerId }
    setDragError('')
    setDragging({
      job,
      x: e.clientX,
      y: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      w: rect.width,
      h: rect.height,
    })
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  function onPointerMove(e) {
    if (!dragStateRef.current) return
    setDragging((d) => (d ? { ...d, x: e.clientX, y: e.clientY } : d))
    const el = document.elementFromPoint(e.clientX, e.clientY)
    const cell = el?.closest?.('[data-day-key]')
    setDropKey(cell?.dataset.dayKey ?? null)
  }

  async function onPointerUp() {
    const state = dragStateRef.current
    dragStateRef.current = null
    setDragging(null)
    const targetKey = dropKey
    setDropKey(null)
    if (!state || !targetKey) return
    const { job } = state
    const currentKey = localDateKey(new Date(job.scheduledTime))
    if (targetKey === currentKey) return

    const original = new Date(job.scheduledTime)
    const [y, m, d] = targetKey.split('-').map(Number)
    const next = new Date(original)
    next.setFullYear(y, m - 1, d)

    setBusyId(job.id)
    setDragError('')
    try {
      await onReschedule(job.id, next.toISOString())
      setSelected(targetKey)
    } catch (err) {
      setDragError(err?.message || t('rescheduleFailed'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div onPointerMove={dragging ? onPointerMove : undefined} onPointerUp={dragging ? onPointerUp : undefined}>
      <div className="card !p-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => changeMonth(-1)}
            aria-label={t('prevMonth')}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/5"
          >
            <ChevronDownIcon className="h-4 w-4 rotate-90" />
          </button>
          <p className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
            {viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>
          <button
            type="button"
            onClick={() => changeMonth(1)}
            aria-label={t('nextMonth')}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/5"
          >
            <ChevronDownIcon className="h-4 w-4 -rotate-90" />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10.5px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div ref={gridRef} className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((date, i) => {
            if (!date) return <div key={i} />
            const key = localDateKey(date)
            const dayJobs = jobsByDay.get(key) ?? []
            const isToday = key === todayKey
            const isSelected = key === selected
            const isDropTarget = dragging && dropKey === key
            return (
              <button
                key={key}
                type="button"
                data-day-key={key}
                onClick={() => setSelected(key)}
                className={`relative flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
                  isSelected
                    ? 'border-transparent bg-brand-600 font-bold text-white'
                    : isToday
                      ? 'border-brand-400 bg-white font-semibold text-brand-700 dark:bg-white/5 dark:text-brand-300'
                      : 'border-transparent bg-slate-50 text-slate-700 hover:border-brand-200 dark:bg-white/5 dark:text-slate-300'
                } ${isDropTarget ? 'outline outline-2 outline-dashed outline-brand-500 outline-offset-2' : ''}`}
              >
                <span>{date.getDate()}</span>
                {dayJobs.length > 0 && (
                  <span className="flex gap-0.5">
                    {dayJobs.slice(0, 3).map((b, idx) => (
                      <span
                        key={b.id}
                        className={`h-1 w-1 rounded-full ${isSelected ? 'bg-white' : idx % 2 ? 'bg-cta-600' : 'bg-brand-500'}`}
                      />
                    ))}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {dragError && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
          {dragError}
        </p>
      )}

      <div className="mt-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          {new Date(`${selected}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
        </p>
        {selectedJobs.length === 0 && (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('noJobsThisDay')}</p>
        )}
        {selectedJobs.map((b) => {
          const draggable = DRAGGABLE_STATUSES.has(b.status)
          const isDraggingThis = dragging?.job.id === b.id
          return (
            <div key={b.id} className="relative">
              <Link
                to={`/detailer/jobs/${b.id}`}
                onPointerDown={draggable ? (e) => startDrag(b, e) : undefined}
                className={`card card-hover flex items-center gap-3 !p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
                  draggable ? 'cursor-grab touch-none active:cursor-grabbing' : ''
                } ${isDraggingThis ? 'opacity-30' : ''} ${busyId === b.id ? 'pointer-events-none opacity-60' : ''}`}
                onClickCapture={(e) => {
                  if (dragStateRef.current) e.preventDefault()
                }}
              >
                <Avatar name={b.customerName} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900 dark:text-slate-100">
                    {b.service} · {b.customerName}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {new Date(b.scheduledTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    {' · '}${b.price}
                  </p>
                </div>
                <StatusPill status={b.status} />
              </Link>
              {draggable && !isDraggingThis && (
                <span className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 text-[10px] font-semibold uppercase tracking-wide text-slate-300 sm:block dark:text-slate-600">
                  {t('dragHint')}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {dragging && (
        <div
          className="pointer-events-none fixed z-[999] flex items-center gap-2 rounded-2xl border border-brand-300 bg-white px-3 py-2.5 shadow-2xl dark:bg-slate-900"
          style={{
            left: dragging.x - dragging.offsetX,
            top: dragging.y - dragging.offsetY,
            width: dragging.w,
          }}
        >
          <Avatar name={dragging.job.customerName} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
              {dragging.job.service} · {dragging.job.customerName}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('dropOnDay')}</p>
          </div>
        </div>
      )}
    </div>
  )
}
