import { Link, useLocation } from 'react-router-dom'
import { MailIcon } from '../components/icons'
import { useT } from '../i18n/useT'

// Shown after signup when Supabase email confirmation is enabled.
export default function CheckEmail() {
  const { state } = useLocation()
  const t = useT('checkEmail')

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-md text-center">
        <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-100 text-brand-600">
          <MailIcon className="h-8 w-8" />
        </span>
        <h1 className="text-2xl font-bold text-slate-900">{t('title')}</h1>
        <p className="mt-3 text-slate-600">
          {state?.email ? t('bodyWithEmail', { email: state.email }) : t('bodyFallback')}
        </p>
        <Link to="/login" className="btn btn-brand mt-6">
          {t('goToLogin')}
        </Link>
      </div>
    </div>
  )
}
