-- ============================================================
-- 094: Real insurance document upload + AI genuineness check.
--
-- Insurance verification today (001/017) is self-attestation only — a
-- yes/no radio button. insurance_doc_url/insurance_expiry/insurance_provider/
-- insurance_policy_number have sat unused on detailer_profiles since 001;
-- nothing has ever populated them. This wires an actual upload through,
-- private storage bucket + AI genuineness check (check-insurance-document
-- edge function, soft check — the AI flags an obvious mismatch, an admin
-- still makes the real approve/reject call).
-- ============================================================

-- ── New columns for the AI check's result ──────────────────────────────
alter table public.detailer_profiles
  add column if not exists insurance_ai_flagged boolean,
  add column if not exists insurance_ai_note text,
  add column if not exists insurance_uploaded_at timestamptz;

comment on column public.detailer_profiles.insurance_ai_flagged is 'Set by check-insurance-document: true if the vision check thinks the uploaded photo does not look like a genuine insurance document. Advisory only — an admin still makes the real call.';
comment on column public.detailer_profiles.insurance_ai_note is 'Short human-readable reason from the AI check, shown to the admin reviewing this application.';
comment on column public.detailer_profiles.insurance_uploaded_at is 'When the current insurance_doc_url was uploaded.';

-- ── guard_detailer_profiles_update: extend 028's body verbatim ──────────
-- Every existing guarded column below is copied VERBATIM from 028 — never
-- rewrite this from scratch, only add to it (see CLAUDE.md).
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
     or new.insurance_ai_flagged is distinct from old.insurance_ai_flagged
     or new.insurance_ai_note   is distinct from old.insurance_ai_note
     or new.insurance_uploaded_at is distinct from old.insurance_uploaded_at
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

-- ── submit_insurance_document: the RPC the upload flow calls ────────────
-- Separate from submit_detailer_onboarding (028/066) rather than folding
-- in as more params — insurance can be (re-)uploaded any time (profile
-- editor, after an expiry), not just once during the onboarding wizard.
-- Reuses the same app.bypass_verification_guard GUC the onboarding RPC
-- already establishes as safe: transaction-local, only ever set by a
-- SECURITY DEFINER function the caller can't otherwise invoke arbitrarily.
create or replace function public.submit_insurance_document(
  p_doc_url text,
  p_provider text default null,
  p_policy_number text default null,
  p_expiry date default null,
  p_ai_flagged boolean default null,
  p_ai_note text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if p_doc_url is null or length(trim(p_doc_url)) = 0 then
    raise exception 'p_doc_url is required';
  end if;

  perform set_config('app.bypass_verification_guard', 'true', true);

  update public.detailer_profiles
     set insurance_status = 'insured',
         insurance_doc_url = p_doc_url,
         insurance_provider = coalesce(p_provider, insurance_provider),
         insurance_policy_number = coalesce(p_policy_number, insurance_policy_number),
         insurance_expiry = coalesce(p_expiry, insurance_expiry),
         insurance_ai_flagged = p_ai_flagged,
         insurance_ai_note = p_ai_note,
         insurance_uploaded_at = now()
   where user_id = auth.uid()
   returning id into v_id;

  if v_id is null then
    raise exception 'No detailer profile for this account';
  end if;

  return v_id;
end; $$;

-- ── admin_get_insurance_document: the ONLY read path for the private
-- insurance columns from the client. detailer_profiles has table-level
-- SELECT revoked and re-granted column-by-column (019) precisely so these
-- columns stay unreadable by a direct client query; row-level SELECT on
-- detailer_profiles is `true` for every authenticated user (001, "map
-- needs this"), so granting these columns directly would let any logged-in
-- user read any OTHER detailer's insurance document/AI note. A
-- SECURITY DEFINER function bypasses column grants but adds its own
-- explicit admin check instead, which is the actual gate here.
create or replace function public.admin_get_insurance_document(p_detailer_id uuid)
returns table (
  doc_url text,
  provider text,
  policy_number text,
  expiry date,
  ai_flagged boolean,
  ai_note text,
  uploaded_at timestamptz
) language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  return query
    select insurance_doc_url, insurance_provider, insurance_policy_number,
           insurance_expiry, insurance_ai_flagged, insurance_ai_note, insurance_uploaded_at
      from public.detailer_profiles
     where id = p_detailer_id;
end; $$;

-- ── insurance-docs storage bucket: private, owner + admin only ──────────
-- Path convention: <uploader_uid>/<file>. Unlike job-photos/vehicles (089,
-- readable by both parties to a booking), only the uploading detailer and
-- an admin ever need to see this — no "parties" case.
insert into storage.buckets (id, name, public)
values ('insurance-docs', 'insurance-docs', false)
on conflict (id) do nothing;

drop policy if exists "insurance-docs owner or admin read" on storage.objects;
create policy "insurance-docs owner or admin read"
  on storage.objects for select
  using (
    bucket_id = 'insurance-docs'
    and ((storage.foldername(name))[1] = auth.uid()::text or is_admin())
  );

drop policy if exists "insurance-docs owner insert" on storage.objects;
create policy "insurance-docs owner insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'insurance-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "insurance-docs owner update" on storage.objects;
create policy "insurance-docs owner update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'insurance-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "insurance-docs owner delete" on storage.objects;
create policy "insurance-docs owner delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'insurance-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
