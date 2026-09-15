-- ============================================================
-- 091: Reject signups from disposable / temp-mail email domains.
--
-- A throwaway account (pivewok325@fidhost.com, confirmed 18s after signup
-- from a cloud IP) showed the pattern. Blocking in the client is useless —
-- anyone can call auth.signUp with the anon key — so this is a Supabase Auth
-- "Before User Created" hook: Auth calls it before inserting into
-- auth.users and aborts the signup if it returns an error.
--
-- ENABLE IT: Dashboard → Authentication → Hooks → Before User Created →
-- Postgres → public.hook_block_disposable_email. (Creating the function
-- alone does nothing.)
--
-- Covers every signup path (email/password, magic link, OAuth). Google
-- accounts are gmail/workspace so they never match.
--
-- Add a domain later:  insert into public.disposable_email_domains values ('x.com');
-- ponytail: curated list of the common services, not the full ~4k-domain
-- community list; import that into the same table if throwaways keep coming.
-- ============================================================

create table if not exists public.disposable_email_domains (
  domain text primary key check (domain = lower(domain))
);
-- Service/auth only: RLS on, no policies.
alter table public.disposable_email_domains enable row level security;
revoke all on public.disposable_email_domains from anon, authenticated, public;
grant select on public.disposable_email_domains to supabase_auth_admin;

insert into public.disposable_email_domains (domain) values
  ('fidhost.com'),
  ('10minutemail.com'), ('10minutemail.net'), ('10minemail.com'), ('20minutemail.com'),
  ('33mail.com'), ('anonaddy.me'), ('burnermail.io'), ('byom.de'),
  ('cool.fr.nf'), ('courriel.fr.nf'), ('crazymailing.com'), ('cuvox.de'),
  ('dayrep.com'), ('deadaddress.com'), ('discard.email'), ('discardmail.com'),
  ('dispostable.com'), ('dropmail.me'), ('einrot.com'), ('emailondeck.com'),
  ('emailfake.com'), ('emailtemporanea.net'), ('fakeinbox.com'), ('fakemail.net'),
  ('fleckens.hu'), ('getairmail.com'), ('getnada.com'), ('gufum.com'),
  ('guerrillamail.biz'), ('guerrillamail.com'), ('guerrillamail.de'), ('guerrillamail.info'),
  ('guerrillamail.net'), ('guerrillamail.org'), ('guerrillamailblock.com'), ('grr.la'),
  ('gustr.com'), ('harakirimail.com'), ('inboxkitten.com'), ('incognitomail.org'),
  ('jetable.org'), ('jourrapide.com'), ('kurzepost.de'), ('mail-temp.com'),
  ('mail.tm'), ('mailcatch.com'), ('maildrop.cc'), ('mailinator.com'),
  ('mailinator.net'), ('mailinator2.com'), ('mailnesia.com'), ('mailpoof.com'),
  ('mailsac.com'), ('mintemail.com'), ('mohmal.com'), ('moakt.com'),
  ('mytemp.email'), ('mytrashmail.com'), ('nada.email'), ('nospam.ze.tc'),
  ('objectmail.com'), ('onetimemail.com'), ('proxymail.eu'), ('rcpt.at'),
  ('rhyta.com'), ('sharklasers.com'), ('spam4.me'), ('spambox.us'),
  ('spamgourmet.com'), ('spamex.com'), ('superrito.com'), ('teleworm.us'),
  ('temp-mail.io'), ('temp-mail.org'), ('tempail.com'), ('tempinbox.com'),
  ('tempmail.com'), ('tempmail.dev'), ('tempmail.net'), ('tempmail.plus'),
  ('tempmailo.com'), ('tempr.email'), ('throwam.com'), ('throwawaymail.com'),
  ('tmail.ws'), ('tmpmail.net'), ('tmpmail.org'), ('trash-mail.com'),
  ('trashmail.com'), ('trashmail.de'), ('trashmail.net'), ('trbvm.com'),
  ('wegwerfmail.de'), ('yopmail.com'), ('yopmail.fr'), ('yopmail.net'),
  ('zetmail.com'), ('armyspy.com'), ('emlhub.com'), ('emltmp.com'),
  ('tmpeml.com'), ('1secmail.com'), ('1secmail.net'), ('1secmail.org'),
  ('esiix.com'), ('wwjmp.com'), ('xojxe.com'), ('yoggm.com'), ('mailto.plus'),
  ('fexpost.com'), ('fexbox.org'), ('inboxbear.com')
on conflict do nothing;

create or replace function public.hook_block_disposable_email(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_domain text := lower(split_part(coalesce(event->'user'->>'email', ''), '@', 2));
begin
  -- Match the domain or any parent (x.mailinator.com → mailinator.com).
  if v_domain <> '' and exists (
    select 1 from public.disposable_email_domains d
    where v_domain = d.domain or v_domain like '%.' || d.domain
  ) then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 400,
      'message', 'Please sign up with a permanent email address — temporary inboxes aren''t supported.'
    ));
  end if;
  return '{}'::jsonb;
end;
$$;

grant execute on function public.hook_block_disposable_email(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_block_disposable_email(jsonb) from authenticated, anon, public;
