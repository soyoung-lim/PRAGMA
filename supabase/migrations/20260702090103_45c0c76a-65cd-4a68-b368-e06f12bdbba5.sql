ALTER TABLE public.profiles DISABLE TRIGGER profiles_prevent_privilege_escalation;

UPDATE public.profiles
SET role = 'admin'::public.app_role,
    approval_status = 'approved'::public.approval_status
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'cnkr@hufs.ac.kr');

ALTER TABLE public.profiles ENABLE TRIGGER profiles_prevent_privilege_escalation;