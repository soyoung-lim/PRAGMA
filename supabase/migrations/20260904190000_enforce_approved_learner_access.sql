-- 학습자 실행 경계와 관리자 승인 상태를 일치시킨다.
-- 프론트엔드 RequireApproved만으로는 직접 DB 조회를 막을 수 없으므로,
-- 기존 learner SELECT 정책들이 공통으로 호출하는 helper에서도 승인을 요구한다.

CREATE OR REPLACE FUNCTION public.has_completed_learner_profile()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = auth.uid()
      AND role = 'learner'::public.app_role
      AND profile_completed = true
      AND approval_status = 'approved'::public.approval_status
  )
$$;

COMMENT ON FUNCTION public.has_completed_learner_profile() IS
  '현재 사용자가 프로필 작성을 마치고 교수자 승인을 받은 learner인지 확인한다.';

REVOKE EXECUTE ON FUNCTION public.has_completed_learner_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_completed_learner_profile() TO authenticated;
