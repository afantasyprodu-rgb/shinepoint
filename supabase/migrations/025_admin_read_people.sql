-- Admin read access to people rows, so the admin dashboard can show real
-- customers and real headcounts instead of hardcoded sample rows.
--
-- Before this, `users` and `customer_profiles` were readable ONLY by their
-- owner (001_initial_schema). Admins could already read every booking,
-- dispute, flagged message and customer-review row (002_full_schema), so the
-- moderation surface existed but had no way to resolve a customer's name or
-- count how many customers exist — which is why those figures were
-- hardcoded in the UI.
--
-- is_admin() is security-definer and reads public.users.role, so these
-- policies can't be spoofed by a client setting its own claims.

create policy "admins read users"
  on public.users for select
  using (public.is_admin());

create policy "admins read customer profiles"
  on public.customer_profiles for select
  using (public.is_admin());
