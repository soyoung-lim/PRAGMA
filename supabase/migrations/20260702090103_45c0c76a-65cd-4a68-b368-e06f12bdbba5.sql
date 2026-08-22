ALTER TABLE public.profiles DISABLE TRIGGER profiles_prevent_privilege_escalation;

-- 최초 관리자 계정 승격(2026-07-02, 적용 완료).
-- 대상 주소는 개인정보이므로 저장소에 남기지 않는다.
UPDATE public.profiles
SET role = 'admin'::public.app_role,
    approval_status = 'approved'::public.approval_status
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'REPLACE_WITH_INITIAL_ADMIN_EMAIL');

ALTER TABLE public.profiles ENABLE TRIGGER profiles_prevent_privilege_escalation;
