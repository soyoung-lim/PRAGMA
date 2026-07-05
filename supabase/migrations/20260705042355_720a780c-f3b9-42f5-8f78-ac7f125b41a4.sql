
-- Tighten EXECUTE grants on SECURITY DEFINER functions.
-- Trigger-only functions: revoke from everyone (triggers run as table owner regardless).
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_profile_privilege_escalation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon, authenticated;

-- is_admin: used in RLS policies; policies evaluate as function owner via SECURITY DEFINER,
-- callers don't need direct EXECUTE. Revoke from anon/public; keep authenticated for any
-- client-side helper use is unnecessary — RLS evaluates server-side.
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;

-- RPCs intentionally callable by signed-in users. Restrict to authenticated only.
REVOKE ALL ON FUNCTION public.ensure_test_dev_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_test_dev_profile() TO authenticated;

REVOKE ALL ON FUNCTION public.save_generated_scenario(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_generated_scenario(jsonb) TO authenticated;
