
-- 1) Narrow the privilege-escalation guard: allow an anonymous auth user to
--    modify their OWN profile row. Real Google learners are never anonymous,
--    so this changes nothing for Track A. It only enables the gated dev RPC
--    public.ensure_test_dev_profile() to flip approval_status/profile_completed
--    for a throwaway anonymous test session.
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  caller_is_admin boolean;
  target_is_anon boolean;
BEGIN
  -- No JWT (service_role / SECURITY DEFINER trigger like handle_new_user): allow.
  IF uid IS NULL THEN
    RETURN NEW;
  END IF;

  -- Dev-only escape hatch: an anonymous auth user editing their OWN profile.
  -- Real learner accounts (Google, email/password) are never anonymous, so
  -- this exception cannot be used to escalate a real account.
  SELECT COALESCE(u.is_anonymous, false)
    INTO target_is_anon
    FROM auth.users u
   WHERE u.id = NEW.user_id;

  IF target_is_anon AND NEW.user_id = uid THEN
    RETURN NEW;
  END IF;

  caller_is_admin := public.is_admin();

  IF TG_OP = 'INSERT' THEN
    IF NOT caller_is_admin THEN
      IF NEW.role IS DISTINCT FROM 'learner'::public.app_role THEN
        RAISE EXCEPTION 'Not allowed to set role on insert';
      END IF;
      IF NEW.approval_status IS DISTINCT FROM 'pending_approval'::public.approval_status THEN
        RAISE EXCEPTION 'Not allowed to set approval_status on insert';
      END IF;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NOT caller_is_admin THEN
      IF NEW.role IS DISTINCT FROM OLD.role THEN
        RAISE EXCEPTION 'Not allowed to change role';
      END IF;
      IF NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
        RAISE EXCEPTION 'Not allowed to change approval_status';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2) Drop the unprivileged session_replication_role calls from the dev RPC.
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
END;
$$;
