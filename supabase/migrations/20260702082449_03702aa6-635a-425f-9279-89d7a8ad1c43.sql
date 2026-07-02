-- The privilege-escalation guard trigger reads auth.users, which the calling
-- user cannot access. Run it as SECURITY DEFINER so the check itself works,
-- while keeping the exact same enforcement logic.
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  caller_is_admin boolean;
  target_is_anon boolean;
BEGIN
  IF uid IS NULL THEN
    RETURN NEW;
  END IF;

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

-- Trigger functions should not be directly callable via the API.
REVOKE EXECUTE ON FUNCTION public.prevent_profile_privilege_escalation() FROM PUBLIC, anon, authenticated;