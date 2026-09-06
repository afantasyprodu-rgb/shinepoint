import { useState } from 'react'
import { extractFlyerPrices } from '../lib/db'
import { PlusIcon, TrashIcon } from './icons'
import { useT } from '../i18n/useT'

// Services/pricing editor for ONE of a detailer's additional locations
// (075). Deliberately a standalone component rather than sharing code with
// DetailerOnboarding.jsx's flyer flow: onboarding's services state is a
// name-keyed set of parallel maps (services/serviceDescriptions/
// serviceAddons), while DetailerProfileEditor's primary Services tab (and
// this editor) use an array-of-row-objects shape — reconciling those into
// one shared component would mean reshaping onboarding's whole pricing
// step for a one-time save, more risk than the reuse is worth. What IS
// reused is the actual vision extraction call (extractFlyerPrices) and the
// same repeat-name disambiguation onboarding's handleFlyerUpload uses.
//
// Packages ("bundle of other services") aren't supported here — a fresh
// location's services list is short enough that individual items + add-ons
// cover it; packages can still be added to the PRIMARY location's list as
// today. Keeps this editor's scope to what the location-setup prompt
// actually asked for: same as primary, or a different flat list.
export default function LocationServicesEditor({ initialServices, onSave, onCancel, saving }) {
  const t = useT('detailerProfileEditor')
  const [services, setServices] = useState(
    (initialServices ?? []).map((s) => ({
      name: s.name, price: String(s.price ?? ''), desc: s.desc ?? '', isAddon: Boolean(s.isAddon),
    }))
  )
  const [flyerBusy, setFlyerBusy] = useState(false)
  const [flyerError, setFlyerError] = useState('')

  function setService(i, key, val) {
    setServices((ss) => ss.map((s, idx) => (idx === i ? { ...s, [key]: val } : s)))
  }
  function addService() {
    setServices((ss) => [...ss, { name: '', price: '', desc: '', isAddon: false }])
  }
  function removeService(i) {
    setServices((ss) => ss.filter((_, idx) => idx !== i))
  }

  async function handleFlyerUpload(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { setFlyerError(t('flyerNotImage')); return }
    setFlyerError('')
    setFlyerBusy(true)
    try {
      const extracted = await extractFlyerPrices(file)
      // Same repeat-name disambiguation as onboarding's handleFlyerUpload —
      // a flyer can legitimately list two tiers under the same name.
      const seen = new Map()
      const rows = extracted.map((s) => {
        const count = (seen.get(s.name) ?? 0) + 1
        seen.set(s.name, count)
        const name = count === 1 ? s.name : `${s.name} (${count})`
        const desc = s.includes?.length
          ? s.includes.join(', ')
          : s.priceNote
            ? t('flyerPriceRangeNote', { range: s.priceNote })
            : ''
        return { name, price: String(s.price ?? ''), desc, isAddon: !s.includes?.length }
      })
      setServices(rows)
    } catch (err) {
      setFlyerError(err.message || t('flyerExtractFailed'))
    } finally {
      setFlyerBusy(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        <div className="flex flex-wrap gap-2">
          <label className="btn btn-outline h-10 cursor-pointer text-sm">
            {flyerBusy ? t('flyerScanning') : t('scanFlyerForLocation')}
            <input type="file" accept="image/*" className="hidden" disabled={flyerBusy} onChange={handleFlyerUpload} />
          </label>
        </div>
        {flyerError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{flyerError}</p>}

        <ul className="space-y-3">
          {services.map((s, i) => (
            <li key={i} className="card !p-3">
              <div className="flex items-start gap-2">
                <div className="flex-1 space-y-2">
                  <input
                    type="text" value={s.name} onChange={(e) => setService(i, 'name', e.target.value)}
                    placeholder={t('serviceNamePlaceholder')} className="input h-9 w-full text-sm"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500 dark:text-slate-400">$</span>
                    <input
                      type="number" min={0} value={s.price} onChange={(e) => setService(i, 'price', e.target.value)}
                      className="input h-9 w-24 text-sm"
                    />
                    <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                      <input type="checkbox" checked={s.isAddon} onChange={(e) => setService(i, 'isAddon', e.target.checked)} />
                      {t('addOnLabel')}
                    </label>
                  </div>
                  <input
                    type="text" value={s.desc} onChange={(e) => setService(i, 'desc', e.target.value)}
                    placeholder={t('serviceDescPlaceholder')} className="input h-9 w-full text-sm"
                  />
                </div>
                <button
                  type="button" onClick={() => removeService(i)} aria-label={t('removeService', { name: s.name || t('service') })}
                  className="cursor-pointer p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>

        <button type="button" onClick={addService} className="flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800">
          <PlusIcon className="h-4 w-4" /> {t('addService')}
        </button>
      </div>

      <div className="flex gap-2 border-t border-slate-200 p-4 dark:border-white/10">
        <button type="button" onClick={onCancel} className="btn btn-outline h-10 flex-1 text-sm">
          {t('cancel')}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => onSave(services)}
          className="btn btn-brand h-10 flex-1 text-sm"
        >
          {saving ? t('saving') : t('saveServices')}
        </button>
      </div>
    </div>
  )
}
