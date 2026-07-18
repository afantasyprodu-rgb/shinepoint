import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import Logo from './Logo'
import { useStore } from '../context/StoreContext'
import {
  CheckIcon,
  ClockIcon,
  PlusIcon,
  XIcon,
  TrashIcon,
  PrinterIcon,
  FileTextIcon,
  StampIcon,
} from './icons'
import { listTemplates, saveTemplate, deleteTemplate } from '../lib/invoiceTemplates'

let rowSeq = 0
const newRow = (label = '', amount = '') => ({ id: `row-${rowSeq++}`, label, amount })

function seedRows(booking) {
  // Re-hydrate a previously attached invoice, otherwise seed from the booking.
  if (booking.invoice?.items?.length) {
    return booking.invoice.items.map((it) => newRow(it.label, String(it.amount)))
  }
  const rows = [newRow(booking.service, String(booking.price ?? ''))]
  if (booking.tip) rows.push(newRow('Tip', String(booking.tip)))
  return rows
}

const money = (n) => `$${(Number(n) || 0).toFixed(2)}`

// Presentational invoice — reused by the detailer's print copy and the customer's
// read-only modal. Pass `hidden` to keep it off-screen until print (detailer side).
export function InvoicePrintable({ invoice, booking, detailer, customerName, hidden = false }) {
  const items = invoice?.items ?? []
  const total = invoice?.total ?? items.reduce((s, it) => s + (Number(it.amount) || 0), 0)
  const issued = invoice?.issuedAt ? new Date(invoice.issuedAt) : new Date()

  return (
    <div
      id="invoice-print"
      className={hidden ? 'invoice-print-host' : ''}
    >
      <div className="bg-white p-8 text-slate-900">
        <div className="flex items-start justify-between gap-4 border-b border-brand-100 pb-6">
          <Logo />
          <div className="text-right">
            <p className="font-display text-2xl font-bold tracking-tight text-slate-900">INVOICE</p>
            <p className="mt-1 text-sm text-slate-500">
              No. <span className="font-mono">{booking.id}</span>
            </p>
            <p className="text-sm text-slate-500">
              {issued.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-6 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">From</p>
            <p className="mt-1 font-semibold text-slate-900">{detailer?.name ?? 'Your detailer'}</p>
            {detailer?.area && <p className="text-slate-500">{detailer.area}</p>}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Billed to</p>
            <p className="mt-1 font-semibold text-slate-900">{customerName}</p>
            {booking.vehicle && <p className="text-slate-500">{booking.vehicle}</p>}
          </div>
        </div>

        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-b border-brand-100 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="pb-2 font-semibold">Description</th>
              <th className="pb-2 text-right font-semibold">Amount</th>
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
              <span>Total</span>
              <span>{money(total)}</span>
            </div>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-slate-400">
          Thank you for choosing ShinePoint. For viewing only — not a tax document.
        </p>
      </div>
    </div>
  )
}

// On-screen "ticket sliding out of a slot" view — the presentation the
// customer/detailer actually see when opening an invoice (print/PDF still
// uses the plain InvoicePrintable doc above, via the hidden copy).
export function InvoiceReceipt({ invoice, booking, detailer, customerName }) {
  const items = invoice?.items ?? []
  const total = invoice?.total ?? items.reduce((s, it) => s + (Number(it.amount) || 0), 0)
  const issued = invoice?.issuedAt ? new Date(invoice.issuedAt) : new Date()
  const paid = booking.status === 'complete'

  return (
    <div>
      <div className="receipt-slot p-3">
        <div className="receipt-slot-hole mx-auto h-5 w-[85%]" />
      </div>
      <div className="receipt-ticket relative z-10 -mt-6 mx-auto w-[92%] rounded-2xl p-5 sm:p-6">
        <h2 className="receipt-title py-2.5 text-center font-display text-base font-semibold text-slate-900 dark:text-slate-100">
          {booking.service || 'Detailing service'}
        </h2>

        <div className="mt-3 space-y-1.5">
          <p className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
            <span>Total</span>
            <span className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
              {money(total)}
            </span>
          </p>
          <p className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
            <span>Billed to</span>
            <span className="font-medium text-slate-700 dark:text-slate-300">{customerName}</span>
          </p>
          <p className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
            <span>Detailer</span>
            <span className="font-medium text-slate-700 dark:text-slate-300">{detailer?.name ?? '—'}</span>
          </p>
        </div>

        {items.length > 0 && (
          <ul className="mt-4 divide-y divide-slate-200 border-y border-slate-200 text-sm dark:divide-slate-700 dark:border-slate-700">
            {items.map((it, i) => (
              <li key={i} className="flex items-center justify-between py-2">
                <span className="text-slate-700 dark:text-slate-300">{it.label || '—'}</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">{money(it.amount)}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <span>Invoice date</span>
          <span>{issued.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 p-3.5 dark:border-slate-700">
          <p className="flex items-center justify-between text-sm">
            <span className="font-semibold text-slate-900 dark:text-slate-100">Payment status</span>
            {paid ? (
              <span className="chip bg-cta-700/10 text-cta-700">
                <CheckIcon className="h-3.5 w-3.5" /> Paid
              </span>
            ) : (
              <span className="chip bg-amber-500/15 text-amber-700">
                <ClockIcon className="h-3.5 w-3.5" /> Pending
              </span>
            )}
          </p>
          <div className="job-progress-track mt-3.5 mx-1.5" aria-label="Payment status">
            <motion.div
              className="job-progress-fill"
              initial={false}
              animate={{ width: paid ? '100%' : '0%' }}
              transition={{ type: 'spring', stiffness: 140, damping: 20 }}
            />
            <div className="job-progress-tick" style={{ left: '0%' }}>
              <CheckIcon className="h-3 w-3" />
            </div>
            <div className="job-progress-tick" style={{ left: '100%' }}>
              <StampIcon className="h-3.5 w-3.5" />
            </div>
            <motion.div
              className="job-progress-ball-wrap"
              initial={false}
              animate={{ left: paid ? '100%' : '0%' }}
              transition={{ type: 'spring', stiffness: 140, damping: 20 }}
            >
              <div className="job-progress-ball" />
            </motion.div>
          </div>
        </div>

        <button onClick={() => window.print()} className="btn btn-outline mt-4 h-10 w-full text-sm">
          <PrinterIcon className="h-4 w-4" /> Download invoice
        </button>
      </div>
    </div>
  )
}

// Detailer-facing editor. Lives inside the Drawer on the job page.
export default function InvoiceBuilder({ booking, detailer }) {
  const { patchBooking } = useStore()
  const [items, setItems] = useState(() => seedRows(booking))
  const [templates, setTemplates] = useState(() => listTemplates())
  const [templateName, setTemplateName] = useState('')
  const [attached, setAttached] = useState(Boolean(booking.invoice))

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
      invoice: { items: cleanItems(), total, issuedAt: new Date().toISOString() },
    })
    setAttached(true)
  }

  function handleSaveTemplate() {
    const rec = saveTemplate(templateName, items)
    if (rec) {
      setTemplates(listTemplates())
      setTemplateName('')
    }
  }

  function loadTemplate(t) {
    setItems(t.items.map((it) => newRow(it.label, String(it.amount))))
    setAttached(false)
  }

  function removeTemplate(id) {
    deleteTemplate(id)
    setTemplates(listTemplates())
  }

  const liveInvoice = { items: cleanItems(), total, issuedAt: booking.invoice?.issuedAt }

  return (
    <div className="space-y-6">
      {/* Saved invoices — reuse without rebuilding */}
      {templates.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Saved invoices
          </h3>
          <ul className="mt-2 space-y-2">
            {templates.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-brand-100 bg-brand-50/50 px-3 py-2"
              >
                <button
                  onClick={() => loadTemplate(t)}
                  className="flex flex-1 cursor-pointer items-center gap-2 text-left text-sm font-medium text-slate-800 transition-colors duration-200 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                >
                  <FileTextIcon className="h-4 w-4 text-brand-600" />
                  {t.name}
                  <span className="ml-auto text-xs font-normal text-slate-400">
                    {t.items.length} item{t.items.length === 1 ? '' : 's'}
                  </span>
                </button>
                <button
                  onClick={() => removeTemplate(t.id)}
                  aria-label={`Delete ${t.name}`}
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
          Line items
        </h3>
        <div className="mt-2 space-y-2">
          {items.map((row) => (
            <div key={row.id} className="flex items-center gap-2">
              <input
                aria-label="Item description"
                value={row.label}
                onChange={(e) => updateRow(row.id, { label: e.target.value })}
                placeholder="Description"
                className="input h-10 flex-1 text-sm"
              />
              <div className="relative w-24 shrink-0">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                  $
                </span>
                <input
                  aria-label="Item amount"
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
                aria-label="Remove item"
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
          <PlusIcon className="h-4 w-4" /> Add item
        </button>

        <div className="mt-4 flex items-center justify-between border-t border-brand-100 pt-3 font-display text-lg font-bold text-slate-900">
          <span>Total</span>
          <motion.span key={total} initial={{ scale: 1.15 }} animate={{ scale: 1 }}>
            {money(total)}
          </motion.span>
        </div>
      </section>

      {/* Save as reusable template */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Save for reuse
        </h3>
        <div className="mt-2 flex gap-2">
          <input
            aria-label="Template name"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="e.g. Full detail — SUV"
            className="input h-10 flex-1 text-sm"
          />
          <button
            onClick={handleSaveTemplate}
            disabled={!templateName.trim()}
            className="btn btn-brand h-10 px-4 text-sm"
          >
            Save
          </button>
        </div>
        <p className="mt-1.5 text-xs text-slate-400">
          Saved invoices live in “Saved invoices” above — load and re-edit any time.
        </p>
      </section>

      {/* Actions */}
      <section className="space-y-2">
        <button onClick={attachToJob} className="btn btn-cta h-11 w-full text-sm">
          {attached ? (
            <>
              <CheckIcon className="h-4 w-4" /> Attached — customer can view
            </>
          ) : (
            'Attach to this job'
          )}
        </button>
        <button onClick={() => window.print()} className="btn btn-outline h-11 w-full text-sm">
          <PrinterIcon className="h-4 w-4" /> Print / Save as PDF
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
