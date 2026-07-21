-- D1 (2026-07-21): 학습자 수행 로그 테이블.
-- 학습 구조 확정판 §로그·§연구 설계에서 확정한 최소 로그 세트 + 9월 실증 연구 필드.
-- 소급 불가능한 자산(로그 스탬프)이므로 개발 초기에 스키마를 박아둔다.
-- decision_traces와 별개: decision_traces는 legacy 판단형 셸용, 이 테이블은
-- 학습자 여정(도입아크·연습·전이·숙달확인·연구앵커) 미션 단위 로그.

CREATE TABLE public.learner_mission_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 학습 맥락
  mission_id text NOT NULL,
  cell_id uuid,                         -- 참조 scenario (scenarios.scenario_id)
  package_id uuid,                      -- 참조 feature_packages (추후 FK)
  feature_id text,                      -- 목표 특징
  speech_act text,
  level text,                           -- 언어 지원 정책 수준 (입문/중급/고급)
  mode text NOT NULL,                   -- 학습|전이|복습|숙달확인|연구앵커

  -- 과업 정체성 (통번역 앱임을 데이터로 증명 — 2026-07-21 제목 정합 라운드)
  task_type text,                       -- direct_production | translation | interpreting | mpj
  source_lang text,                     -- 번역·통역이면 출발어 (ko|zh)
  target_lang text,                     -- 도착어 (zh|ko)
  source_text text,                     -- 출발어 원문·원발화 전사

  -- 수행
  first_response text,                  -- = pre-feedback response (학습 전 능력 아님)
  context_judgment jsonb,               -- P/D/R·적절성 판단
  revision_target_selected text,        -- 학습자가 고른 수정 지점
  revision_target_source text,          -- learner_free | selected_from_options | system_assigned
  revised_response text,
  transfer_response text,
  target_feature_observed jsonb,        -- 목표 특징 실현 관찰 (공통; 화행별 파생 지표는 분석 단계)
  semantic_fidelity_status text,        -- pass | warning | fail — 이중제약의 게이트를 측정 가능한 판정으로
  self_confidence_rating smallint,      -- 1~5, 전이·숙달확인·연구앵커에서만
  example_shown boolean DEFAULT false,
  hint_used boolean DEFAULT false,
  mission_completed boolean DEFAULT false,

  -- 연구 설계 (9월 실증)
  study_id text,                        -- 가명 (learner_id와 분리 보관)
  cohort_id text,
  measurement_point text,               -- pre | mid | post | null(일반 학습)
  form_id text,                         -- A | B
  form_order text,                      -- AB | BA (참가자 간 교차배정)
  consent_version text,

  -- 버전 스탬프 (재현성·실증 동결)
  content_ver text,                     -- = package_ver
  policy_ver text,

  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.learner_mission_logs TO authenticated;
GRANT ALL ON public.learner_mission_logs TO service_role;

ALTER TABLE public.learner_mission_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "learner_insert_own_log"
  ON public.learner_mission_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "learner_update_own_log"
  ON public.learner_mission_logs FOR UPDATE
  TO authenticated
  USING (auth_user_id = auth.uid());

CREATE POLICY "learner_select_own_log"
  ON public.learner_mission_logs FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

CREATE POLICY "admin_select_all_logs"
  ON public.learner_mission_logs FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE INDEX idx_mission_logs_auth_user ON public.learner_mission_logs(auth_user_id);
CREATE INDEX idx_mission_logs_mission ON public.learner_mission_logs(mission_id);
CREATE INDEX idx_mission_logs_study ON public.learner_mission_logs(study_id);
CREATE INDEX idx_mission_logs_measurement ON public.learner_mission_logs(measurement_point)
  WHERE measurement_point IS NOT NULL;

CREATE TRIGGER trg_mission_logs_updated_at
  BEFORE UPDATE ON public.learner_mission_logs
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
