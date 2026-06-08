-- Restore column-level grants so admins (using their authenticated JWT + admin RLS policy) can update these columns.
GRANT INSERT (role, approval_status), UPDATE (role, approval_status) ON public.profiles TO authenticated;

-- Trigger-based guard: only admins (or SECURITY DEFINER / service_role contexts where auth.uid() is null, e.g. handle_new_user) may set/change role or approval_status.
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  caller_is_admin boolean;
BEGIN
  -- No JWT (service_role / SECURITY DEFINER trigger like handle_new_user): allow.
  IF uid IS NULL THEN
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
$$;

DROP TRIGGER IF EXISTS profiles_prevent_privilege_escalation ON public.profiles;
CREATE TRIGGER profiles_prevent_privilege_escalation
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_privilege_escalation();