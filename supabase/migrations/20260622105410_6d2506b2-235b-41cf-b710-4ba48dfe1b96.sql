
-- 1) Revoke public/authenticated EXECUTE on the dev RPC; keep it for service_role only.
REVOKE EXECUTE ON FUNCTION public.ensure_test_dev_profile() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ensure_test_dev_profile() FROM anon;
REVOKE EXECUTE ON FUNCTION public.ensure_test_dev_profile() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_test_dev_profile() TO service_role;

-- 2) Tighten decision_traces INSERT policy to bind profile_id to caller's profile.
DROP POLICY IF EXISTS "learner_insert_own_trace" ON public.decision_traces;
CREATE POLICY "learner_insert_own_trace"
  ON public.decision_traces
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth_user_id = auth.uid()
    AND profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );
