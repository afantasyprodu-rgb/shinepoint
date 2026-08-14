-- ============================================================
-- Dispute response window + custom refund amounts.
--
-- Every marketplace-ops source on dispute handling says the same thing:
-- give the other party a defined window (48-72h) to respond with their
-- side before the operator rules, and record why a decision was made.
-- Neither existed here — the RLS policy on disputes only lets the FILER
-- insert and an ADMIN update; filed_against has no write path at all, so
-- a detailer (or customer) disputed against could never respond. And
-- admin_resolve_dispute never wrote to resolution_notes, which has sat
-- unused in the schema since 002.
--
-- Doesn't hard-block the admin from resolving before the window closes —
-- a dispute that never gets a response shouldn't be able to stall forever
-- — it just gives the admin visibility (has the other party spoken?) and
-- a natural default wait.
-- ============================================================

alter table public.disputes
  add column if not exists response_text text,
  add column if not exists responded_at timestamptz,
  add column if not exists response_deadline timestamptz;

update public.disputes
   set response_deadline = opened_at + interval '48 hours'
 where response_deadline is null;

alter table public.disputes
  alter column response_deadline set default (now() + interval '48 hours'),
  alter column response_deadline set not null;

-- The disputed-against party's only write path. RLS's "admins manage
-- disputes" update policy has no clause for filed_against at all, so a
-- raw client UPDATE is rejected outright — this security-definer function
-- is the sole way to record a response, and only once, only by the right
-- person, only while still open.
create or replace function public.respond_to_dispute(p_dispute_id uuid, p_response_text text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_response_text is null or length(trim(p_response_text)) = 0 then
    raise exception 'A response is required';
  end if;

  update public.disputes
     set response_text = trim(p_response_text),
         responded_at = now(),
         status = case when status = 'open' then 'under_review' else status end
   where id = p_dispute_id
     and filed_against = auth.uid()
     and status in ('open', 'under_review')
     and responded_at is null;

  if not found then
    raise exception 'Dispute not found, already responded to, or not yours to respond to';
  end if;
end; $$;

-- Replaces the 040 version: adds p_resolution_notes so an admin's reasoning
-- is actually recorded (resolution_notes existed since 002, was never
-- written). Refund/status logic is unchanged.
create or replace function public.admin_resolve_dispute(
  p_dispute_id uuid,
  p_resolution text,
  p_refund_amount numeric default null,
  p_stripe_refund_id text default null,
  p_resolution_notes text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_booking uuid;
  v_refund  numeric := coalesce(p_refund_amount, 0);
begin
  if not public.is_admin() then raise exception 'admin only'; end if;

  update public.disputes
     set status = 'resolved',
         resolution = p_resolution,
         refund_amount = p_refund_amount,
         resolution_notes = p_resolution_notes,
         stripe_refund_id = p_stripe_refund_id,
         refunded_at = case when p_stripe_refund_id is not null then now() end,
         is_false_dispute = (p_resolution = 'detailer_wins'),
         admin_id = auth.uid(),
         resolved_at = now()
   where id = p_dispute_id
   returning booking_id into v_booking;

  if v_booking is null then return; end if;

  update public.bookings
     set refunded_amount = v_refund,
         detailer_payout = greatest(coalesce(detailer_payout, 0) - v_refund, 0),
         status = case
                    when v_refund > 0 and v_refund >= coalesce(total_price, 0) then 'cancelled'
                    else 'complete'
                  end,
         cancelled_by = case
                    when v_refund > 0 and v_refund >= coalesce(total_price, 0) then 'admin'
                    else cancelled_by
                  end
   where id = v_booking and status = 'disputed';
end; $$;
