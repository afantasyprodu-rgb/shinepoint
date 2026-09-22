import { Link } from 'react-router-dom'
import { AnimatedPage } from '../components/ui/Motion'
import { ChevronLeftIcon } from '../components/icons'
import Logo from '../components/Logo'
import { useT } from '../i18n/useT'

const UPDATED = 'August 2026'

function LegalShell({ title, children }) {
  const t = useT('legal')
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

        <div className="card">
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">{title}</h1>
          <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">{t('lastUpdated', { date: UPDATED })}</p>
          <div className="legal-body mt-6 space-y-5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {children}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          ShinePoint · Southern California ·{' '}
          <Link to="/terms" className="underline hover:text-slate-600 dark:hover:text-slate-300">{t('footerTerms')}</Link>
          {' · '}
          <Link to="/privacy" className="underline hover:text-slate-600 dark:hover:text-slate-300">{t('footerPrivacy')}</Link>
        </p>
      </AnimatedPage>
    </div>
  )
}

function H({ children }) {
  return <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">{children}</h2>
}

export function Terms() {
  const t = useT('legal')
  return (
    <LegalShell title={t('termsTitle')}>
      <p>{t('termsIntro')}</p>

      <H>{t('termsH1')}</H>
      <p>{t('termsP1')}</p>

      <H>{t('termsH2')}</H>
      <p>{t('termsP2')}</p>

      <H>{t('termsH3')}</H>
      <p>{t('termsP3')}</p>

      <H>{t('termsH4')}</H>
      <p>{t('termsP4')}</p>

      <H>{t('termsH5')}</H>
      <p>{t('termsP5')}</p>

      <H>{t('termsH6')}</H>
      <p>{t('termsP6')}</p>

      <H>{t('termsH7')}</H>
      <p>{t('termsP7')}</p>

      <H>{t('termsHSms')}</H>
      <p>{t('termsPSms')}</p>

      <H>{t('termsH8')}</H>
      <p>{t('termsP8')}</p>
    </LegalShell>
  )
}

export function Privacy() {
  const t = useT('legal')
  return (
    <LegalShell title={t('privacyTitle')}>
      <p>{t('privacyIntro')}</p>

      <H>{t('privacyH1')}</H>
      <p>{t('privacyP1')}</p>

      <H>{t('privacyH2')}</H>
      <p>{t('privacyP2')}</p>

      <H>{t('privacyH3')}</H>
      <p>{t('privacyP3')}</p>

      <H>{t('privacyH4')}</H>
      <p>{t('privacyP4')}</p>

      <H>{t('privacyH5')}</H>
      <p>{t('privacyP5')}</p>

      <H>{t('privacyHSms')}</H>
      <p>{t('privacyPSms')}</p>

      <H>{t('privacyH6')}</H>
      <p>{t('privacyP6')}</p>

      <H>{t('privacyH7')}</H>
      <p>{t('privacyP7')}</p>
    </LegalShell>
  )
}
