import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { AnimatedPage } from '../components/ui/Motion'
import DilutionCalculator from '../components/tools/DilutionCalculator'
import JobTimeEstimator from '../components/tools/JobTimeEstimator'
import PricingCalculator from '../components/tools/PricingCalculator'
import ChemicalGuide from '../components/tools/ChemicalGuide'
import { FlaskIcon, ClockIcon, TagIcon, ShieldCheckIcon } from '../components/icons'
import { useT } from '../i18n/useT'

// Same 4 tools/colors as ToolsSidebar.jsx's entry cards, plus which
// component each one renders once you're on this page.
const TOOLS = [
  { key: 'dilution', labelKey: 'dilutionTitle', icon: FlaskIcon, from: 'from-violet-500', to: 'to-fuchsia-600', Component: DilutionCalculator },
  { key: 'time', labelKey: 'timeTitle', icon: ClockIcon, from: 'from-amber-500', to: 'to-orange-600', Component: JobTimeEstimator },
  { key: 'pricing', labelKey: 'priceTitle', icon: TagIcon, from: 'from-emerald-500', to: 'to-teal-600', Component: PricingCalculator },
  { key: 'chemical', labelKey: 'chemTitle', icon: ShieldCheckIcon, from: 'from-rose-500', to: 'to-red-600', Component: ChemicalGuide },
]

// Deliberately its own visual world — a dark, colorful swipeable card stack
// instead of the app's usual light neumorphic pages — reached only through
// ToolsSidebar so the rest of the detailer nav stays uncluttered.
export default function DetailerTools() {
  const t = useT('detailerTools')
  const [searchParams] = useSearchParams()
  const initialKey = searchParams.get('tool')
  const initialIndex = Math.max(0, TOOLS.findIndex((tool) => tool.key === initialKey))

  const scrollRef = useRef(null)
  const cardRefs = useRef([])
  const activeIndexRef = useRef(initialIndex)
  const rafRef = useRef(null)
  const [activeIndex, setActiveIndex] = useState(initialIndex)

  useEffect(() => {
    cardRefs.current[initialIndex]?.scrollIntoView({ inline: 'center', block: 'nearest' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleScroll() {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      const el = scrollRef.current
      if (!el) return
      const center = el.scrollLeft + el.clientWidth / 2
      let closest = 0
      let closestDist = Infinity
      cardRefs.current.forEach((card, i) => {
        if (!card) return
        const dist = Math.abs(card.offsetLeft + card.offsetWidth / 2 - center)
        if (dist < closestDist) {
          closestDist = dist
          closest = i
        }
      })
      if (closest !== activeIndexRef.current) {
        activeIndexRef.current = closest
        setActiveIndex(closest)
      }
    })
  }

  function goTo(i) {
    cardRefs.current[i]?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }

  return (
    <AppShell role="detailer">
      <div className="min-h-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-8 sm:px-6">
        <AnimatedPage className="mx-auto max-w-md">
          <h1 className="font-display text-2xl font-bold text-white">{t('title')}</h1>
          <p className="mt-1 text-sm text-slate-400">{t('swipeHint')}</p>

          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="no-scrollbar mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-[6%] pb-2"
          >
            {TOOLS.map(({ key, labelKey, icon: Icon, from, to, Component }, i) => (
              <div
                key={key}
                ref={(el) => (cardRefs.current[i] = el)}
                className="w-[88%] shrink-0 snap-center sm:w-[420px]"
              >
                <div className={`rounded-[2rem] bg-gradient-to-br ${from} ${to} p-1.5 shadow-2xl shadow-black/40`}>
                  <div className="rounded-[1.6rem] bg-slate-950/40 p-4 backdrop-blur-sm">
                    <div className="flex items-center gap-3 px-1 pb-4">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white">
                        <Icon className="h-6 w-6" />
                      </span>
                      <h2 className="font-display text-lg font-bold text-white">{t(labelKey)}</h2>
                    </div>
                    <div className="rounded-2xl bg-[var(--neu-bg)] p-4">
                      <Component />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-center gap-2" role="tablist" aria-label={t('title')}>
            {TOOLS.map(({ key }, i) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={activeIndex === i}
                aria-label={t(TOOLS[i].labelKey)}
                onClick={() => goTo(i)}
                className={`h-2 cursor-pointer rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
                  activeIndex === i ? 'w-6 bg-white' : 'w-2 bg-white/25 hover:bg-white/40'
                }`}
              />
            ))}
          </div>
        </AnimatedPage>
      </div>
    </AppShell>
  )
}
