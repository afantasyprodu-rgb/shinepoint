import { useState } from 'react'
import AdminShell from '../../components/AdminShell'
import { AnimatedPage } from '../../components/ui/Motion'
import { AlertTriangleIcon, CheckIcon, ClockIcon } from '../../components/icons'
import { compareVisionProviders } from '../../lib/db'

// Admin-only debug tool — runs a real photo through all four vision
// provider slots (OpenRouter/gemma, DeepSeek direct, DeepSeek routed
// through OpenRouter, Anthropic/Haiku) in parallel via
// compare-vision-providers, and shows all four results side by side with
// timing and an estimated per-call cost. Two panels: the client-side
// prompt (vehicle photo, from onboarding) and the detailer-side prompt
// (price flyer) — same prompts production actually uses, not stand-ins.
// Never wired into the real app flow; this exists purely to eyeball
// provider quality/speed/cost against each other.
export default function AdminVisionCompare() {
  return (
    <AdminShell>
      <AnimatedPage>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
          Vision provider comparison
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
          Upload a real photo and see OpenRouter, DeepSeek (direct API and via OpenRouter), and
          Anthropic's actual answers side by side — with timing and an estimated cost per call —
          using the exact same prompts the real app sends.
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <ComparePanel
            kind="vehicle"
            title="Client side — vehicle photo"
            subtitle="What a customer uploads during onboarding (extract-vehicle-photo)"
          />
          <ComparePanel
            kind="flyer"
            title="Detailer side — price flyer"
            subtitle="What a detailer uploads during onboarding (extract-flyer-prices)"
          />
        </div>
      </AnimatedPage>
    </AdminShell>
  )
}

function ComparePanel({ kind, title, subtitle }) {
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setResult(null)
    setPreview(URL.createObjectURL(file))
    setLoading(true)
    try {
      const data = await compareVisionProviders(file, kind)
      setResult(data)
    } catch (err) {
      setError(err.message ?? String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card !p-5">
      <p className="font-semibold text-slate-900 dark:text-slate-100">{title}</p>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>

      <label className="mt-4 flex h-28 cursor-pointer items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 text-sm text-slate-500 hover:border-brand-300 hover:text-brand-600 dark:border-white/10 dark:text-slate-400">
        {preview ? (
          <img src={preview} alt="" className="h-full rounded-lg object-cover" />
        ) : (
          <span>Choose a photo…</span>
        )}
        <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </label>

      {error && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-red-600">
          <AlertTriangleIcon className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      {loading && (
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="h-40 animate-pulse rounded-xl bg-brand-100 dark:bg-brand-500/15" />
          <div className="h-40 animate-pulse rounded-xl bg-brand-100 dark:bg-brand-500/15" />
          <div className="h-40 animate-pulse rounded-xl bg-brand-100 dark:bg-brand-500/15" />
          <div className="h-40 animate-pulse rounded-xl bg-brand-100 dark:bg-brand-500/15" />
        </div>
      )}

      {result && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ProviderResult label="OpenRouter" sub="google/gemma-4-31b-it" data={result.openrouter} />
          <ProviderResult label="DeepSeek" sub="deepseek-v4-flash-vision-exp (direct)" data={result.deepseek} />
          <ProviderResult label="DeepSeek via OpenRouter" sub="deepseek-v4-flash-vision-exp" data={result.deepseekOpenrouter} />
          <ProviderResult label="Anthropic" sub="claude-haiku-4-5" data={result.anthropic} />
        </div>
      )}
    </div>
  )
}

function ProviderResult({ label, sub, data }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">{label}</p>
          <p className="text-[11px] text-slate-400">{sub}</p>
        </div>
        {data.ok ? (
          <span className="flex flex-col items-end gap-0.5 text-[11px] font-semibold text-cta-700 dark:text-cta-400">
            <span className="flex items-center gap-1"><CheckIcon className="h-3.5 w-3.5" /> {data.ms}ms</span>
            <span className="font-mono font-normal text-slate-400 dark:text-slate-500">
              {data.costUsd == null ? '—' : `$${data.costUsd.toFixed(5)}`}
            </span>
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-red-600">
            <AlertTriangleIcon className="h-3.5 w-3.5" /> failed
          </span>
        )}
      </div>

      {data.ok ? (
        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-2 text-[11px] text-slate-700 dark:bg-white/5 dark:text-slate-300">
          {JSON.stringify(data.parsed ?? data.raw, null, 2)}
        </pre>
      ) : (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-red-600">
          {data.notConfigured ? <ClockIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <AlertTriangleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
          {data.error}
        </p>
      )}
    </div>
  )
}
