import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CameraIcon, PlusIcon, TrashIcon, CheckIcon } from './icons'

function newItem() {
  return { id: crypto.randomUUID(), area: '', note: '', photo: null }
}

export default function DamageInspection({ booking, onSubmit, onNoDamage }) {
  const [items, setItems] = useState([newItem()])
  const fileRefs = useRef({})

  function update(id, patch) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  }

  function remove(id) {
    setItems((prev) => prev.filter((it) => it.id !== id))
  }

  function handleFile(id, file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => update(id, { photo: e.target.result })
    reader.readAsDataURL(file)
  }

  const canSubmit = items.some((it) => it.area.trim() || it.note.trim() || it.photo)

  function submit() {
    const clean = items
      .filter((it) => it.area.trim() || it.note.trim() || it.photo)
      .map(({ id, ...rest }) => rest)
    onSubmit(clean)
  }

  return (
    <div className="mt-3 space-y-3">
      <p className="text-xs text-slate-500">
        Photograph and describe any existing damage before touching the vehicle. The client must
        confirm each item before work can start.
      </p>

      <AnimatePresence initial={false}>
        {items.map((item, idx) => (
          <motion.div
            key={item.id}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="rounded-2xl border border-brand-100 bg-white p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-display text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Area {idx + 1}
              </span>
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  aria-label="Remove area"
                  className="cursor-pointer text-slate-400 transition-colors duration-200 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              )}
            </div>

            <input
              type="text"
              placeholder="Area (e.g. Driver door, Hood)"
              value={item.area}
              onChange={(e) => update(item.id, { area: e.target.value })}
              className="input mt-2 h-9 text-sm"
            />
            <input
              type="text"
              placeholder="Note (e.g. Small ding, scratch — pre-existing)"
              value={item.note}
              onChange={(e) => update(item.id, { note: e.target.value })}
              className="input mt-2 h-9 text-sm"
            />

            {/* Photo capture */}
            <input
              ref={(el) => { if (el) fileRefs.current[item.id] = el }}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              aria-hidden="true"
              onChange={(e) => handleFile(item.id, e.target.files[0])}
            />

            {item.photo ? (
              <div className="relative mt-2">
                <img
                  src={item.photo}
                  alt={`Damage at ${item.area || 'area ' + (idx + 1)}`}
                  className="h-36 w-full rounded-xl object-cover"
                />
                <button
                  type="button"
                  onClick={() => update(item.id, { photo: null })}
                  className="absolute right-2 top-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-black/50 text-white transition-colors duration-200 hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  aria-label="Remove photo"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => fileRefs.current[item.id]?.click()}
                  className="absolute bottom-2 right-2 flex cursor-pointer items-center gap-1 rounded-lg bg-black/50 px-2 py-1 text-[11px] font-medium text-white transition-colors duration-200 hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <CameraIcon className="h-3 w-3" /> Retake
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRefs.current[item.id]?.click()}
                className="mt-2 flex h-24 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-200 bg-brand-50/50 text-sm font-medium text-brand-700 transition-colors duration-200 hover:border-brand-400 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
              >
                <CameraIcon className="h-5 w-5" /> Take or upload photo
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setItems((prev) => [...prev, newItem()])}
        className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-brand-200 py-2.5 text-sm font-medium text-brand-700 transition-colors duration-200 hover:border-brand-400 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
      >
        <PlusIcon className="h-4 w-4" /> Add another area
      </button>

      <div className="flex flex-col gap-2 pt-1">
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="btn btn-brand h-10 text-sm disabled:opacity-40"
        >
          <CheckIcon className="h-4 w-4" /> Send report to client
        </button>
        <button
          type="button"
          onClick={onNoDamage}
          className="btn btn-outline h-10 text-sm"
        >
          No pre-existing damage — proceed
        </button>
      </div>
    </div>
  )
}
