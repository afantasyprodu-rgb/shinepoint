-- ============================================================
-- 049: Soften admin_purge_booking_history (048) with an audit trail.
-- That function force-deletes disputes/payouts/reviews/messages/photos
-- tied to a purged user's bookings so the account can actually be
-- deleted — but a hard delete with no record of what was destroyed is
-- a bad tool to hand an admin for an irreversible action. This adds
-- admin_purge_archive: every row about to be deleted (directly, or via
-- the bookings cascade to messages/photos/booking_location) gets
-- snapshotted as JSON first, tagged with which admin did it and when.
-- Nothing here makes the delete itself reversible — the booking/review/
-- dispute/payout is still gone from the live tables and the app — but
-- the content survives somewhere an admin can pull it back up.
-- ============================================================

create table public.admin_purge_archive (
  id uuid primary key default gen_random_uuid(),
  purged_user_id uuid not null,
  purged_user_email text,
  purged_by uuid references public.users (id),
  source_table text not null,
  row_data jsonb not null,
  archived_at timestamptz not null default now()
);

create index admin_purge_archive_user_idx on public.admin_purge_archive (purged_user_id);

alter table public.admin_purge_archive enable row level security;

create policy admin_purge_archive_select on public.admin_purge_archive
  for select using (public.is_admin());

-- Different parameter list than 048's version, so the old one has to go
-- first — Postgres treats a changed signature as a new overload, not a
-- replacement, and a stray default-arg overload left behind would make
-- every future call ambiguous.
drop function if exists public.admin_purge_booking_history(uuid);

create or replace function public.admin_purge_booking_history(p_user_id uuid, p_admin_id uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_customer_id uuid;
  v_detailer_id uuid;
  v_booking_ids uuid[];
  v_email text;
begin
  select email into v_email from public.users where id = p_user_id;
  select id into v_customer_id from public.customer_profiles where user_id = p_user_id;
  select id into v_detailer_id from public.detailer_profiles where user_id = p_user_id;

  select coalesce(array_agg(id), '{}') into v_booking_ids
    from public.bookings
   where (v_customer_id is not null and customer_id = v_customer_id)
      or (v_detailer_id is not null and detailer_id = v_detailer_id);

  if array_length(v_booking_ids, 1) > 0 then
    -- Snapshot everything about to be deleted — directly, or via the
    -- bookings cascade to messages/photos/booking_location — before any
    -- of it is touched.
    insert into public.admin_purge_archive (purged_user_id, purged_user_email, purged_by, source_table, row_data)
    select p_user_id, v_email, p_admin_id, 'bookings', to_jsonb(b) from public.bookings b where b.id = any(v_booking_ids);

    insert into public.admin_purge_archive (purged_user_id, purged_user_email, purged_by, source_table, row_data)
    select p_user_id, v_email, p_admin_id, 'disputes', to_jsonb(d) from public.disputes d where d.booking_id = any(v_booking_ids);

    insert into public.admin_purge_archive (purged_user_id, purged_user_email, purged_by, source_table, row_data)
    select p_user_id, v_email, p_admin_id, 'payouts', to_jsonb(p) from public.payouts p where p.booking_id = any(v_booking_ids);

    insert into public.admin_purge_archive (purged_user_id, purged_user_email, purged_by, source_table, row_data)
    select p_user_id, v_email, p_admin_id, 'reviews_of_customers', to_jsonb(r) from public.reviews_of_customers r where r.booking_id = any(v_booking_ids);

    insert into public.admin_purge_archive (purged_user_id, purged_user_email, purged_by, source_table, row_data)
    select p_user_id, v_email, p_admin_id, 'reviews_of_detailers', to_jsonb(r) from public.reviews_of_detailers r where r.booking_id = any(v_booking_ids);

    insert into public.admin_purge_archive (purged_user_id, purged_user_email, purged_by, source_table, row_data)
    select p_user_id, v_email, p_admin_id, 'messages', to_jsonb(m) from public.messages m where m.booking_id = any(v_booking_ids);

    insert into public.admin_purge_archive (purged_user_id, purged_user_email, purged_by, source_table, row_data)
    select p_user_id, v_email, p_admin_id, 'photos', to_jsonb(ph) from public.photos ph where ph.booking_id = any(v_booking_ids);

    insert into public.admin_purge_archive (purged_user_id, purged_user_email, purged_by, source_table, row_data)
    select p_user_id, v_email, p_admin_id, 'booking_location', to_jsonb(bl) from public.booking_location bl where bl.booking_id = any(v_booking_ids);

    -- Records fundamentally about these specific bookings — always
    -- involve only the booking's own two parties, so purging the
    -- booking purges these too.
    delete from public.disputes where booking_id = any(v_booking_ids);
    delete from public.payouts where booking_id = any(v_booking_ids);
    delete from public.reviews_of_customers where booking_id = any(v_booking_ids);
    delete from public.reviews_of_detailers where booking_id = any(v_booking_ids);

    -- Context references that may belong to a different person entirely
    -- — preserve the row, just drop the now-dangling booking pointer.
    update public.strikes set booking_id = null where booking_id = any(v_booking_ids);
    update public.notifications set booking_id = null where booking_id = any(v_booking_ids);
    update public.loyalty_rewards set redeemed_on_booking = null where redeemed_on_booking = any(v_booking_ids);
    update public.referrals set qualifying_booking_id = null where qualifying_booking_id = any(v_booking_ids);

    -- messages/photos/booking_location cascade from bookings already —
    -- already archived above.
    delete from public.bookings where id = any(v_booking_ids);
  end if;

  -- Historical reassignment / moderation / approval traces the target
  -- user left on OTHER people's bookings — never delete someone else's
  -- record, just clear the actor pointer (all nullable by design).
  if v_detailer_id is not null then
    update public.bookings set original_detailer_id = null where original_detailer_id = v_detailer_id;
  end if;
  update public.bookings set payout_approved_by = null where payout_approved_by = p_user_id;
  update public.disputes set admin_id = null where admin_id = p_user_id;
  update public.strikes set issued_by = null where issued_by = p_user_id;
end; $$;

revoke execute on function public.admin_purge_booking_history(uuid, uuid) from public, anon, authenticated;
