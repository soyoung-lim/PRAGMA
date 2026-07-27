-- 승인된 학습 콘텐츠의 실제 학습자 조회 경로를 연다.
--
-- 기존 상태:
--   curriculum_outlines / curriculum_weeks / curriculum_week_scenarios가
--   admin-only라 /learner/course-live는 관리자 세션에서만 동작했다.
--
-- 공개 경계:
--   1) 실제 로그인 + 프로필 작성 완료 learner
--   2) status='published'인 커리큘럼과 그 주차·편성만
--   3) 편성된 시나리오 중 mission_status='reviewed'만
-- approval_status는 Sprint 1B-1a에서 학습 진입 조건에서 제외되었으므로 검사하지 않는다.
--
-- 쓰기 정책은 기존 admin_all 그대로다. 이 마이그레이션은 SELECT만 추가한다.

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
  )
$$;

REVOKE EXECUTE ON FUNCTION public.has_completed_learner_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_completed_learner_profile() TO authenticated;

DROP POLICY IF EXISTS curriculum_outlines_learner_select_published
  ON public.curriculum_outlines;
CREATE POLICY curriculum_outlines_learner_select_published
  ON public.curriculum_outlines
  FOR SELECT
  TO authenticated
  USING (
    status = 'published'
    AND public.has_completed_learner_profile()
  );

DROP POLICY IF EXISTS curriculum_weeks_learner_select_published
  ON public.curriculum_weeks;
CREATE POLICY curriculum_weeks_learner_select_published
  ON public.curriculum_weeks
  FOR SELECT
  TO authenticated
  USING (
    public.has_completed_learner_profile()
    AND EXISTS (
      SELECT 1
      FROM public.curriculum_outlines AS outline
      WHERE outline.id = curriculum_weeks.outline_id
        AND outline.status = 'published'
    )
  );

DROP POLICY IF EXISTS curriculum_week_scenarios_learner_select_published
  ON public.curriculum_week_scenarios;
CREATE POLICY curriculum_week_scenarios_learner_select_published
  ON public.curriculum_week_scenarios
  FOR SELECT
  TO authenticated
  USING (
    public.has_completed_learner_profile()
    AND EXISTS (
      SELECT 1
      FROM public.curriculum_outlines AS outline
      WHERE outline.id = curriculum_week_scenarios.outline_id
        AND outline.status = 'published'
    )
  );

-- 기존 legacy 공개 정책(review_status=approved + coursework_published)은 유지한다.
-- 신규 core→mission 경로에는 별도 정책을 더해, reviewed이면서 게시 강좌에 실제로
-- 편성된 미션만 직접 조회 및 /learner/practice/:scenarioId 실행이 가능하게 한다.
DROP POLICY IF EXISTS scenarios_learner_select_reviewed_course_mission
  ON public.scenarios;
CREATE POLICY scenarios_learner_select_reviewed_course_mission
  ON public.scenarios
  FOR SELECT
  TO authenticated
  USING (
    content_format = 'scenario_core_v1'
    AND mission_status = 'reviewed'
    AND public.has_completed_learner_profile()
    AND EXISTS (
      SELECT 1
      FROM public.curriculum_week_scenarios AS assignment
      JOIN public.curriculum_outlines AS outline
        ON outline.id = assignment.outline_id
      WHERE assignment.scenario_id = scenarios.scenario_id
        AND outline.status = 'published'
    )
  );
