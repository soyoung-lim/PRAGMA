REVOKE INSERT (role, approval_status) ON public.profiles FROM authenticated;
REVOKE UPDATE (role, approval_status) ON public.profiles FROM authenticated;