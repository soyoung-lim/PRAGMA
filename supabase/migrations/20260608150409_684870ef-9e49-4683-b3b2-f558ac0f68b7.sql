-- 1) archive_items.researcher_notes: 내부 메모는 비공개 (관리자/서비스만)
REVOKE SELECT (researcher_notes) ON public.archive_items FROM anon;
REVOKE SELECT (researcher_notes) ON public.archive_items FROM authenticated;

-- 2) decision_traces: 제출 후 불변 — UPDATE/DELETE 권한 회수
REVOKE UPDATE, DELETE ON public.decision_traces FROM authenticated;
REVOKE UPDATE, DELETE ON public.decision_traces FROM anon;

-- 3) SECURITY DEFINER 함수 노출 최소화
-- 트리거 전용 함수: API 노출 불필요
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.prevent_profile_privilege_escalation() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prevent_profile_privilege_escalation() FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at() FROM anon, authenticated;

-- RLS에서 사용되는 함수: 인증 사용자만 EXECUTE 필요
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
GRANT  EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- dev 전용 RPC: 인증된 익명 dev 세션에서 호출되며, 함수 내부에서 is_anonymous 검사
REVOKE EXECUTE ON FUNCTION public.ensure_test_dev_profile() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.ensure_test_dev_profile() TO authenticated, service_role;