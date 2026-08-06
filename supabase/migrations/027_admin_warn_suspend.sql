-- ============================================================
-- 027: Admin moderation RPCs for flagged messages — warn and suspend.
--
-- Previously the client only had admin_clear_flag; the "Issue warning"
-- and "Suspend account" buttons on AdminOps' Flagged tab called the same
-- clearFlag() as "Dismiss", so they silently did nothing beyond clearing
-- the flag. users.is_suspended already exists (001) and is already
-- writable by admins per guard_users_update (010) — the missing piece
-- was RLS letting an admin UPDATE the users row at all (012 only added
-- SELECT), plus a notification so the warned user actually sees it.
-- ============================================================

create policy "admins update users" on public.users
  for update using (public.is_admin());

create or replace function public.admin_warn_user(p_user_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  insert into public.notifications (user_id, kind, title, body)
  values (
    p_user_id,
    'moderation',
    'Warning from ShinePoint',
    coalesce(p_reason, 'A message you sent was flagged for review. Please review our community guidelines.')
  );
end; $$;

create or replace function public.admin_set_user_suspended(p_user_id uuid, p_suspended boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  update public.users set is_suspended = p_suspended where id = p_user_id;
  if p_suspended then
    insert into public.notifications (user_id, kind, title, body)
    values (p_user_id, 'moderation', 'Account suspended', 'Your account has been suspended pending review. Contact support for details.');
  end if;
end; $$;
