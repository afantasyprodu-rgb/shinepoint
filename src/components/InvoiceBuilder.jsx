import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import Logo from './Logo'
import { useStore } from '../context/StoreContext'
import {
  CheckIcon,
  PlusIcon,
  XIcon,
  TrashIcon,
  PrinterIcon,
  FileTextIcon,
} from './icons'
import { listTemplates, saveTemplate, deleteTemplate } from '../lib/invoiceTemplates'
import { useT } from '../i18n/useT'
import { useLanguage } from '../context/LanguageContext'

let rowSeq = 0
const newRow = (label = '', amount = '') => ({ id: `row-${rowSeq++}`, label, amount })

function seedRows(booking, tipLabel) {
  // Re-hydrate a previously attached invoice, otherwise seed from the booking.
  if (booking.invoice?.items?.length) {
    return booking.invoice.items.map((it) => newRow(it.label, String(it.amount)))
  }
  const rows = [newRow(booking.service, String(booking.price ?? ''))]
  if (booking.tip) rows.push(newRow(tipLabel, String(booking.tip)))
  return rows
}

const money = (n) => `$${(Number(n) || 0).toFixed(2)}`

// Presentational invoice — reused by the detailer's print copy and the customer's
// read-only modal. Pass `hidden` to keep it off-screen until print (detailer side).
export function InvoicePrintable({ invoice, booking, detailer, customerName, hidden = false }) {
  const items = invoice?.items ?? []
  const total = invoice?.total ?? items.reduce((s, it) => s + (Number(it.amount) || 0), 0)
  const issued = invoice?.issuedAt ? new Date(invoice.issuedAt) : new Date()
  const t = useT('invoiceBuilder')
  const { lang } = useLanguage()

  return (
    <div
      id="invoice-print"
      className={hidden ? 'invoice-print-host' : ''}
    >
      <div className="bg-white p-8 text-slate-900">
        <div className="flex items-start justify-between gap-4 border-b border-brand-100 pb-6">
          <Logo />
          <div className="text-right">
            <p className="font-display text-2xl font-bold tracking-tight text-slate-900">{t('invoice')}</p>
            <p className="mt-1 text-sm text-slate-500">
              {t('no')} <span className="font-mono">{booking.id}</span>
            </p>
            <p className="text-sm text-slate-500">
              {issued.toLocaleDateString(lang === 'es' ? 'es-US' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-6 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('from')}</p>
            <p className="mt-1 font-semibold text-slate-900">{detailer?.name ?? t('yourDetailer')}</p>
            {detailer?.area && <p className="text-slate-500">{detailer.area}</p>}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('billedTo')}</p>
            <p className="mt-1 font-semibold text-slate-900">{customerName}</p>
            {booking.vehicle && <p className="text-slate-500">{booking.vehicle}</p>}
          </div>
        </div>

        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-b border-brand-100 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="pb-2 font-semibold">{t('description')}</th>
              <th className="pb-2 text-right font-semibold">{t('amount')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="py-2.5 text-slate-800">{it.label || '—'}</td>
                <td className="py-2.5 text-right font-medium text-slate-900">{money(it.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex justify-end">
          <div className="w-48">
            <div className="flex justify-between border-t-2 border-slate-900 pt-3 font-display text-lg font-bold">
              <span>{t('total')}</span>
              <span>{money(total)}</span>
            </div>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-slate-400">
          {t('thankYou')}
        </p>
      </div>
    </div>
  )
}

// On-screen slotted-ticket receipt (gallery E, shipped): dark slot with a
// punched hole, paper ticket with the shadow-top gradient, dashed
// perforation title, itemized rows, and a 5-stop lifecycle rail. Print/PDF
// still uses the plain InvoicePrintable doc via the hidden copy. `onPay`
// (customer booking page) jumps to the real Stripe checkout — without it
// the ticket just offers Download. No card row: bookings carry no card
// data, so a "Visa ending …" line would be invented.
export function InvoiceReceipt({ invoice, booking, detailer, customerName, onPay }) {
  const items = invoice?.items ?? []
  const total = invoice?.total ?? items.reduce((s, it) => s + (Number(it.amount) || 0), 0)
  const paid = booking.status === 'complete'
  const t = useT('invoiceBuilder')
  const showPay = !paid && typeof onPay === 'function'
  const dashed =
    'repeating-linear-gradient(90deg, #1b1b1b, #1b1b1b 8px, transparent 8px, transparent 16px)'
  const doneCount = paid
    ? 5
    : ({ pending: 1, accepted: 1, en_route: 1, arrived: 2, in_progress: 3 }[booking.status] ?? 1)

  return (
    <div className="space-y-3">
      {/* Slot + ticket overlap via negative margin, not absolute-over-relative
          — ticket height is dynamic (rail, item count), so a fixed-height
          wrapper would either clip content or leave a gap. The white ticket
          paints ON TOP of the dark slot (default DOM stacking, no z-index)
          so it reads as paper sliding OUT of the slot rather than pasted
          over it. Overlap matches a real slotted-ticket reference's own
          numbers: a 25px hole starting 16px into a 120px slot, ticket top
          24px down — landing 8px into the hole, leaving a sliver of black
          visible above the paper. This wrapper div isn't inside the outer
          `space-y-3` (that would add its own margin-top on top of this
          negative one) — kept as its own group so only this -mt applies. */}
      <div>
        <div className="rounded-2xl border-2 border-[#2c2c2c] bg-[#2b2b2b] pb-2 shadow-[0_0_1px_0_#000,0_5px_15px_0_rgba(0,0,0,0.45)]">
          <div className="mx-auto mt-4 h-[22px] w-[90%] rounded-full border border-[#1b1b1b] bg-black shadow-[0_0_1px_0_#000,0_5px_15px_0_rgba(0,0,0,0.45)]" />
        </div>
        <div className="relative mx-[7.5%] -mt-[30px] overflow-hidden rounded-xl bg-white text-slate-500 shadow-[0_5px_25px_0_rgba(0,0,0,0.15)]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-20"
            style={{
              background:
                'linear-gradient(180deg, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.8) 10%, rgba(0,0,0,0.7) 25%, rgba(0,0,0,0.55) 40%, rgba(0,0,0,0.38) 60%, rgba(0,0,0,0.14) 80%, transparent 100%)',
            }}
          />
          <div className="relative px-4 pb-4 pt-4">
            <div className="h-12" aria-hidden="true" />
            <h2 className="relative py-2.5 text-center text-[1.05rem] font-medium tracking-wide text-[#1b1b1b]">
              <span
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-[1.5px]"
                style={{ backgroundImage: dashed }}
              />
              {booking.service || t('detailingService')}
              <span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-[1.5px]"
                style={{ backgroundImage: dashed }}
              />
            </h2>
            <div className="mb-2 mt-3 flex items-center justify-between text-sm">
              <span>{t('total')}</span>
              <span className="font-bold text-black">{money(total)}</span>
            </div>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span>{t('billedTo')}</span>
              <span className="font-semibold text-slate-800">{customerName}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>{t('detailer')}</span>
              <span className="font-semibold text-slate-800">{detailer?.name ?? '—'}</span>
            </div>

            {items.length > 0 && (
              <>
                <hr className="my-3 border-slate-200" />
                <ul className="divide-y divide-slate-100">
                  {items.map((it, i) => (
                    <li key={i} className="flex items-center justify-between py-2 text-sm">
                      <span>{it.label || '—'}</span>
                      <span className="font-mono text-slate-800">{money(it.amount)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <div className="mt-2 flex items-center justify-between rounded-2xl border border-slate-200 p-4">
              <p className="text-sm font-medium uppercase text-black">
                {t('paymentStatus')}
                <span className="ml-2 normal-case text-slate-500">{paid ? t('paid') : t('unpaid')}</span>
              </p>
            </div>

            {/* Lifecycle rail — hard 2-tone split at doneCount/5. No
                checkpoint markers, just the bare progress line. */}
            <div
              className="relative mx-0.5 mb-2 mt-8 h-1.5 rounded-full"
              role="img"
              aria-label={t('paymentStatusAria')}
              style={{
                background: `linear-gradient(90deg, #000 ${(doneCount / 5) * 100}%, #eee ${(doneCount / 5) * 100}%)`,
              }}
            />

            <div className="mt-4 flex items-center gap-3">
              {showPay ? (
                <>
                  <button
                    type="button"
                    onClick={onPay}
                    className="flex-1 rounded-full border border-[#1b1b1b] bg-[#111827] py-2 text-[13px] text-white shadow-[0_5px_10px_0_rgba(0,0,0,0.15)]"
                  >
                    {t('payNow')}
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="flex-1 rounded-full border border-slate-200 bg-white py-2 text-[13px] text-slate-800 shadow-[0_5px_10px_0_rgba(0,0,0,0.15)]"
                  >
                    {t('downloadInvoice')}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="w-full rounded-full border border-[#1b1b1b] bg-[#111827] py-2 text-[13px] text-white shadow-[0_5px_10px_0_rgba(0,0,0,0.15)]"
                >
                  {t('downloadInvoice')}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Amount-due + Pay Now — below the ticket, own section, only while
          there's actually something left to pay for. */}
      {showPay && (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>{t('amountDue')}</span>
            <span className="font-bold text-black">{money(total)}</span>
          </div>
          <button
            type="button"
            onClick={onPay}
            className="mt-3 w-full rounded-xl border-2 border-[#1b1b1b] bg-[#111827] py-2.5 text-[15px] font-semibold text-white shadow-[0_0_1px_0_#000,0_5px_15px_0_rgba(0,0,0,0.45)]"
          >
            {t('payNow')}
          </button>
        </div>
      )}
    </div>
  )
}

// A one-shot "printing out" reveal of what was just paid for — the moment
// right after checkout, not the detailer's itemized invoice (InvoiceReceipt
// above, which only exists once a detailer bothers to build one and is
// buried in a modal most bookings never reach). No QR code: the same
// breakdown already goes out in the payment confirmation email, so this is
// purely the visual payoff, not another way to retrieve the receipt.
// Reuses the same .receipt-slot/.receipt-ticket look for visual continuity
// with InvoiceReceipt. clipPath wipes the ticket into view top-to-bottom —
// reads as paper feeding out of the slot above it — then each line fades in
// with a small stagger once the paper's fully out.
export function ReceiptPrintout({ title, sub, lines, total, totalLabel = 'Total' }) {
  return (
    <div className="mx-auto w-full max-w-xs">
      <div className="receipt-slot p-3">
        <div className="receipt-slot-hole mx-auto h-5 w-[85%]" />
      </div>
      <motion.div
        initial={{ clipPath: 'inset(0% 0% 100% 0%)' }}
        animate={{ clipPath: 'inset(0% 0% 0% 0%)' }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        className="receipt-ticket relative z-10 -mt-6 mx-auto w-[92%] rounded-2xl p-5"
      >
        <h2 className="receipt-title py-2.5 text-center font-display text-base font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </h2>
        {sub && (
          <p className="mt-2 text-center text-xs text-slate-400 dark:text-slate-500">{sub}</p>
        )}
        <ul className="mt-4 space-y-1.5 text-sm">
          {lines.map((line, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 + i * 0.12, duration: 0.25 }}
              className={`flex items-center justify-between gap-3 ${
                line.strong
                  ? 'font-display text-base font-bold text-slate-900 dark:text-slate-100'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <span>{line.label}</span>
              <span className={line.strong ? '' : 'font-medium text-slate-900 dark:text-slate-100'}>
                {line.value}
              </span>
            </motion.li>
          ))}
        </ul>
        {total != null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 + lines.length * 0.12, duration: 0.25 }}
            className="mt-3 flex items-center justify-between border-t border-dashed border-slate-200 pt-3 font-display text-lg font-bold text-slate-900 dark:border-slate-700 dark:text-slate-100"
          >
            <span>{totalLabel}</span>
            <span>{total}</span>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}

// Detailer-facing editor. Lives inside the Drawer on the job page.
export default function InvoiceBuilder({ booking, detailer }) {
  const { patchBooking } = useStore()
  const t = useT('invoiceBuilder')
  const [items, setItems] = useState(() => seedRows(booking, t('tip')))
  const [templates, setTemplates] = useState(() => listTemplates(detailer?.id))
  const [templateName, setTemplateName] = useState('')
  const [attached, setAttached] = useState(Boolean(booking.invoice))
  // Whether the customer's completion receipt email shows this itemized
  // breakdown or just the flat total. Defaults on — most detailers who
  // bother itemizing want the customer to see why. Doesn't affect the
  // in-app view, which always shows the full breakdown either way.
  const [emailItemized, setEmailItemized] = useState(booking.invoice?.emailItemized ?? true)

  const total = useMemo(
    () => items.reduce((s, it) => s + (Number(it.amount) || 0), 0),
    [items]
  )

  function updateRow(id, patch) {
    setItems((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))
    setAttached(false)
  }
  function addRow() {
    setItems((rows) => [...rows, newRow()])
    setAttached(false)
  }
  function removeRow(id) {
    setItems((rows) => rows.filter((r) => r.id !== id))
    setAttached(false)
  }

  const cleanItems = () =>
    items.map(({ label, amount }) => ({ label: label.trim(), amount: Number(amount) || 0 }))

  function attachToJob() {
    patchBooking(booking.id, {
      invoice: { items: cleanItems(), total, issuedAt: new Date().toISOString(), emailItemized },
    })
    setAttached(true)
  }

  function handleSaveTemplate() {
    const rec = saveTemplate(detailer?.id, templateName, items)
    if (rec) {
      setTemplates(listTemplates(detailer?.id))
      setTemplateName('')
    }
  }

  function loadTemplate(t) {
    setItems(t.items.map((it) => newRow(it.label, String(it.amount))))
    setAttached(false)
  }

  function removeTemplate(id) {
    deleteTemplate(detailer?.id, id)
    setTemplates(listTemplates(detailer?.id))
  }

  const liveInvoice = { items: cleanItems(), total, issuedAt: booking.invoice?.issuedAt }

  return (
    <div className="space-y-6">
      {/* Saved invoices — reuse without rebuilding */}
      {templates.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t('savedInvoices')}
          </h3>
          <ul className="mt-2 space-y-2">
            {templates.map((tpl) => (
              <li
                key={tpl.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-brand-100 bg-brand-50/50 px-3 py-2"
              >
                <button
                  onClick={() => loadTemplate(tpl)}
                  className="flex flex-1 cursor-pointer items-center gap-2 text-left text-sm font-medium text-slate-800 transition-colors duration-200 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                >
                  <FileTextIcon className="h-4 w-4 text-brand-600" />
                  {tpl.name}
                  <span className="ml-auto text-xs font-normal text-slate-400">
                    {t('itemCount', { count: tpl.items.length, s: tpl.items.length === 1 ? '' : 's' })}
                  </span>
                </button>
                <button
                  onClick={() => removeTemplate(tpl.id)}
                  aria-label={t('deleteTemplate', { name: tpl.name })}
                  className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors duration-200 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Line-item editor */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {t('lineItems')}
        </h3>
        <div className="mt-2 space-y-2">
          {items.map((row) => (
            <div key={row.id} className="flex items-center gap-2">
              <input
                aria-label={t('itemDescriptionAria')}
                value={row.label}
                onChange={(e) => updateRow(row.id, { label: e.target.value })}
                placeholder={t('descriptionPlaceholder')}
                className="input h-10 flex-1 text-sm"
              />
              <div className="relative w-24 shrink-0">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                  $
                </span>
                <input
                  aria-label={t('itemAmountAria')}
                  type="number"
                  min="0"
                  step="0.01"
                  value={row.amount}
                  onChange={(e) => updateRow(row.id, { amount: e.target.value })}
                  placeholder="0"
                  className="input h-10 w-full pl-5 text-sm"
                />
              </div>
              <button
                onClick={() => removeRow(row.id)}
                aria-label={t('removeItem')}
                className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors duration-200 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={addRow}
          className="btn btn-outline mt-3 h-10 w-full text-sm"
        >
          <PlusIcon className="h-4 w-4" /> {t('addItem')}
        </button>

        <div className="mt-4 flex items-center justify-between border-t border-brand-100 pt-3 font-display text-lg font-bold text-slate-900">
          <span>{t('total')}</span>
          <motion.span key={total} initial={{ scale: 1.15 }} animate={{ scale: 1 }}>
            {money(total)}
          </motion.span>
        </div>
      </section>

      {/* Email behavior */}
      <section>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-brand-100 px-3.5 py-3">
          <input
            type="checkbox"
            checked={emailItemized}
            onChange={(e) => {
              setEmailItemized(e.target.checked)
              setAttached(false)
            }}
            className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
          />
          <span>
            <span className="block text-sm font-medium text-slate-900">{t('emailItemizedLabel')}</span>
            <span className="block text-xs text-slate-400">{t('emailItemizedHint')}</span>
          </span>
        </label>
      </section>

      {/* Save as reusable template */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {t('saveForReuse')}
        </h3>
        <div className="mt-2 flex gap-2">
          <input
            aria-label={t('templateNameAria')}
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder={t('templateNamePlaceholder')}
            className="input h-10 flex-1 text-sm"
          />
          <button
            onClick={handleSaveTemplate}
            disabled={!templateName.trim()}
            className="btn btn-brand h-10 px-4 text-sm"
          >
            {t('save')}
          </button>
        </div>
        <p className="mt-1.5 text-xs text-slate-400">
          {t('savedInvoicesHint')}
        </p>
      </section>

      {/* Actions */}
      <section className="space-y-2">
        <button onClick={attachToJob} className="btn btn-cta h-11 w-full text-sm">
          {attached ? (
            <>
              <CheckIcon className="h-4 w-4" /> {t('attachedCanView')}
            </>
          ) : (
            t('attachToJob')
          )}
        </button>
        <button onClick={() => window.print()} className="btn btn-outline h-11 w-full text-sm">
          <PrinterIcon className="h-4 w-4" /> {t('printOrSavePdf')}
        </button>
      </section>

      {/* Hidden copy used only when printing */}
      <InvoicePrintable
        hidden
        invoice={liveInvoice}
        booking={booking}
        detailer={detailer}
        customerName={booking.customerName}
      />
    </div>
  )
}
