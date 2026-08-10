-- The detailer's invoice builder (InvoiceBuilder.jsx) attaches an itemised
-- invoice to a job, and the customer views it read-only on BookingDetail.
-- There was never a column to put it in: the client called
-- patchBooking(id, { invoice }), which updated React state (so the UI showed
-- "attached") and then silently dropped the field on the way to the
-- database. The invoice vanished on reload and the customer never saw one.
--
-- Stored as jsonb rather than a normalised invoices/line_items pair on
-- purpose: this is a point-in-time snapshot the detailer issues and neither
-- side queries across. Shape:
--   { items: [{ label text, amount number }], total number, issuedAt iso8601 }
alter table public.bookings
  add column if not exists invoice jsonb;

-- Only the two parties to a booking can already read/update the row (the
-- "parties read/update bookings" policies in 002_full_schema), so the
-- invoice inherits the correct visibility with no extra policy.
--
-- The 009 guard trigger denies changes to pricing/payment fields only, so
-- it does not need widening for this column. Note the invoice is descriptive
-- (what the detailer itemised) — it does NOT drive what the customer is
-- charged; total_price/platform_cut/detailer_payout remain server-managed.
comment on column public.bookings.invoice is
  'Detailer-issued invoice snapshot: { items:[{label,amount}], total, issuedAt }. Descriptive only — never used to compute charges.';
