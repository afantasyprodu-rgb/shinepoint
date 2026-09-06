-- ============================================================
-- 060 regression test: the booking guards must never shrink.
--
-- Migration 054 rewrote guard_bookings_update with only 6 of the 15 columns
-- 041 protected, silently re-opening forged-tip / early-payout attacks.
-- This test asserts every column ever protected is STILL protected, and
-- that the admin bypass survived. Run it against staging after any migration
-- that touches guard_bookings_update / guard_bookings_insert:
--
--   supabase db execute --file supabase/tests/060_guard_regression.sql
-- ============================================================

do $$
declare
  update_src text;
  insert_src text;
  col text;
  missing text[];
  -- Every column any prior migration (009/016/039/040/041/060) guarded.
  -- ADD TO THIS LIST, NEVER REMOVE FROM IT: a new server-managed bookings
  -- column must land here in the same migration that guards it.
  required_update_cols text[] := array[
    'total_price', 'platform_cut', 'detailer_payout', 'paid_at',
    'promo_discount', 'promo_code_id',
    'tip_paid_at', 'tip_payment_intent', 'tip_amount',
    'stripe_payment_method', 'stripe_payment_intent', 'mileage_fee',
    'payout_hold_until', 'transferred_at', 'stripe_transfer_id',
    'payout_requires_approval', 'payout_approved_at', 'payout_approved_by'
  ];
begin
  select p.prosrc into update_src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'guard_bookings_update';
  if update_src is null then
    raise exception 'guard_bookings_update is missing entirely';
  end if;
  if position('is_admin()' in update_src) = 0 then
    raise exception 'guard_bookings_update lost the is_admin() bypass (admin_approve_payout would break)';
  end if;
  foreach col in array required_update_cols loop
    if position(format('new.%I', col) in update_src) = 0
       and position(format('new.%s', col) in update_src) = 0 then
      missing := missing || col;
    end if;
  end loop;
  if array_length(missing, 1) is not null then
    raise exception 'guard_bookings_update no longer guards: % (regression - see migration 060''s header for why this class of bug matters)', array_to_string(missing, ', ');
  end if;
  raise notice 'OK: guard_bookings_update covers all % protected columns + admin bypass', array_length(required_update_cols, 1);

  select p.prosrc into insert_src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'guard_bookings_insert';
  if insert_src is null then
    raise exception 'guard_bookings_insert is missing entirely';
  end if;
  -- The INSERT guard must strip client-provided promo pricing and payment
  -- state (039's rule, dropped by 053/054, restored by 060).
  foreach col in array['promo_code_id', 'promo_discount', 'stripe_payment_intent', 'paid_at'] loop
    if position(col in insert_src) = 0 then
      raise exception 'guard_bookings_insert no longer strips % on INSERT', col;
    end if;
  end loop;
  raise notice 'OK: guard_bookings_insert still strips promo/payment fields';

  -- 075: service_id must be bound to the booking's detailer_location_id,
  -- not just its detailer_id, or a service scoped to one of a detailer's
  -- OTHER locations could be attached to a booking against a different one.
  if position('detailer_location_id is null or detailer_location_id = new.detailer_location_id' in insert_src) = 0 then
    raise exception 'guard_bookings_insert no longer binds service_id to the booking''s detailer_location_id (075 regression)';
  end if;
  raise notice 'OK: guard_bookings_insert binds service_id to detailer_location_id';
end $$;
