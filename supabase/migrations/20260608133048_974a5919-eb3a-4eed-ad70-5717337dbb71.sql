
CREATE OR REPLACE FUNCTION public.ensure_test_dev_profile()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  uemail text;
  uis_anon boolean;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email, is_anonymous INTO uemail, uis_anon FROM auth.users WHERE id = uid;
  IF uis_anon IS NOT TRUE THEN
    RAISE EXCEPTION 'ensure_test_dev_profile is only available for anonymous dev sessions';
  END IF;

  -- Bypass prevent_profile_privilege_escalation trigger for this controlled,
  -- dev-only upsert. Anonymous-session gate above guarantees this can't be
  -- used to escalate a real learner account.
  PERFORM set_config('session_replication_role', 'replica', true);

  INSERT INTO public.profiles (
    user_id, email, role, approval_status, profile_completed, anonymous_participant_id
  )
  VALUES (
    uid, COALESCE(uemail, 'test-dev@anonymous.local'),
    'learner'::public.app_role, 'approved'::public.approval_status,
    true, 'TEST-DEV-001'
  )
  ON CONFLICT (user_id) DO UPDATE
    SET approval_status = 'approved'::public.approval_status,
        profile_completed = true,
        anonymous_participant_id = COALESCE(public.profiles.anonymous_participant_id, 'TEST-DEV-001');

  PERFORM set_config('session_replication_role', 'origin', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_test_dev_profile() TO authenticated;
