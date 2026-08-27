import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatedPage } from '../components/ui/Motion'
import { ChevronLeftIcon, ChevronDownIcon } from '../components/icons'
import Logo from '../components/Logo'
import { useT } from '../i18n/useT'

const SECTIONS = [
  { key: 'general', questionCount: 4 },
  { key: 'customer', questionCount: 4 },
  { key: 'detailer', questionCount: 8 },
]

function QaItem({ question, answer }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="card !p-0 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
      >
        <span className="font-semibold text-slate-900 dark:text-slate-100">{question}</span>
        <ChevronDownIcon
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <p className="px-4 pb-4 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{answer}</p>
      )}
    </div>
  )
}

export default function Faq() {
  const t = useT('faq')
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-cta-50/40 dark:from-[#1A1430] dark:via-[#141026] dark:to-[#141026]">
      <AnimatedPage className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <div className="mb-8 flex items-center justify-between">
          <Link to="/" className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600">
            <Logo />
          </Link>
          <Link
            to="/"
            className="flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <ChevronLeftIcon className="h-4 w-4" /> {t('back')}
          </Link>
        </div>

        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">{t('title')}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('subtitle')}</p>

        <div className="mt-8 space-y-8">
          {SECTIONS.map(({ key, questionCount }) => (
            <div key={key}>
              <h2 className="mb-3 font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                {t(`${key}Heading`)}
              </h2>
              <div className="space-y-2">
                {Array.from({ length: questionCount }, (_, i) => i + 1).map((n) => (
                  <QaItem key={n} question={t(`${key}Q${n}`)} answer={t(`${key}A${n}`)} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-slate-400 dark:text-slate-500">
          {t('stillNeedHelp')}{' '}
          <Link to="/terms" className="underline hover:text-slate-600 dark:hover:text-slate-300">{t('footerTerms')}</Link>
          {' · '}
          <Link to="/privacy" className="underline hover:text-slate-600 dark:hover:text-slate-300">{t('footerPrivacy')}</Link>
        </p>
      </AnimatedPage>
    </div>
  )
}
