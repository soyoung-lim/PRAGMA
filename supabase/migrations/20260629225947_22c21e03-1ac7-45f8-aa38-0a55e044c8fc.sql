
-- 1) Harden profiles_update_own with column-stability WITH CHECK
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND role = (SELECT p.role FROM public.profiles p WHERE p.user_id = auth.uid())
    AND approval_status = (SELECT p.approval_status FROM public.profiles p WHERE p.user_id = auth.uid())
  );

-- 2) Revoke EXECUTE on SECURITY DEFINER helpers from public roles.
--    is_admin() is used inside RLS policies (runs with definer privileges regardless),
--    handle_new_user() is only invoked by the auth trigger.
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Keep ensure_test_dev_profile() callable only by authenticated role
-- (anonymous dev sessions are 'authenticated' in PostgREST). Block anon/public.
REVOKE EXECUTE ON FUNCTION public.ensure_test_dev_profile() FROM PUBLIC, anon;
