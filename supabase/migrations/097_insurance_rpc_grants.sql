-- ============================================================
-- 097: Lock down the insurance RPCs (094) to signed-in callers.
--
-- 094 created admin_get_insurance_document and submit_insurance_document
-- as SECURITY DEFINER without touching grants, so both inherited EXECUTE
-- from PUBLIC and were callable by `anon` — the same gap 088 closed for
-- every other definer function.
--
-- Not exploitable today: admin_get raises 'admin only' via is_admin(), and
-- submit resolves the row by auth.uid() (null for anon -> 'No detailer
-- profile'). This is defence in depth, and keeps the advisor clean so a
-- real leak stands out.
-- ============================================================

revoke execute on function public.admin_get_insurance_document(uuid) from public, anon;
grant execute on function public.admin_get_insurance_document(uuid) to authenticated, service_role;

revoke execute on function public.submit_insurance_document(text, text, text, date, boolean, text) from public, anon;
grant execute on function public.submit_insurance_document(text, text, text, date, boolean, text) to authenticated, service_role;
