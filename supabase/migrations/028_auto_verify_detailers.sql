-- ============================================================
-- 028: Optional auto-verification for detailer onboarding — for
-- friends-and-family testing before a real admin-review process is
-- staffed. Controlled by a one-row config table, no redeploy needed to
-- turn off: `update public.app_config set auto_verify_detailers = false;`
-- (ALTER DATABASE ... SET isn't available on managed Postgres — no
-- superuser — hence a table instead of a GUC.)
--
-- is_verified/is_probation are guarded columns (009) — a plain client
-- UPDATE can't touch them even for the profile's own owner. This adds
-- a narrow, session-local bypass GUC that only submit_detailer_onboarding
-- below ever sets, so the guard still blocks every other path.
-- ============================================================

create table public.app_config (
  id boolean primary key default true,
  auto_verify_detailers boolean not null default true,
  constraint app_config_singleton check (id)
);
insert into public.app_config (id) values (true);

-- Readable by anyone (needed inside the security-definer RPC below, which
-- runs as the caller for auth.uid() purposes but still needs to see this
-- row); not writable by ordinary users — no insert/update/delete policy.
alter table public.app_config enable row level security;
create policy "app_config readable" on public.app_config for select using (true);

create or replace function public.guard_detailer_profiles_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_service_role() or public.is_admin()
     or current_setting('app.bypass_verification_guard', true) = 'true' then
    return new;
  end if;
  if new.is_verified            is distinct from old.is_verified
     or new.insurance_status    is distinct from old.insurance_status
     or new.insurance_doc_url   is distinct from old.insurance_doc_url
     or new.insurance_expiry    is distinct from old.insurance_expiry
     or new.insurance_provider  is distinct from old.insurance_provider
     or new.insurance_policy_number is distinct from old.insurance_policy_number
     or new.is_probation        is distinct from old.is_probation
     or new.probation_jobs_remaining is distinct from old.probation_jobs_remaining
     or new.stripe_account_id   is distinct from old.stripe_account_id
     or new.stripe_charges_enabled is distinct from old.stripe_charges_enabled
     or new.total_completed_jobs is distinct from old.total_completed_jobs
     or new.average_rating      is distinct from old.average_rating
     or new.is_founding_member  is distinct from old.is_founding_member
     or new.platform_cut_override is distinct from old.platform_cut_override then
    raise exception 'detailer_profiles verification/insurance/economics fields are server-managed';
  end if;
  return new;
end; $$;

create or replace function public.submit_detailer_onboarding(
  p_bio text, p_zip text, p_insurance text,
  p_free_travel_miles integer, p_charge_per_mile numeric, p_service_days text[]
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_auto_verify boolean := coalesce((select auto_verify_detailers from public.app_config limit 1), false);
begin
  update public.detailer_profiles
     set bio = p_bio,
         zip_code = p_zip,
         insurance_status = p_insurance,
         free_travel_miles = p_free_travel_miles,
         charge_per_extra_mile = p_charge_per_mile,
         service_days = p_service_days
   where user_id = auth.uid()
   returning id into v_id;

  if v_id is null then
    raise exception 'No detailer profile for this account';
  end if;

  if v_auto_verify then
    perform set_config('app.bypass_verification_guard', 'true', true);
    update public.detailer_profiles
       set is_verified = true, is_probation = false
     where id = v_id;
  end if;

  return v_id;
end; $$;
