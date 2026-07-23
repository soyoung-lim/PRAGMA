-- 태스크 D — curriculum_week_scenarios 조인 테이블 (2026-07-24).
-- 관리자구조md §6-2 + 생성계약 0-g·47. 15주 편성기가 실제 시나리오를 주차에 배정한다.
--
-- 층 구분:
--   curriculum_weeks         = "몇 주차에 어떤 화행" (매크로 골격, 이미 존재)
--   curriculum_week_scenarios = "그 주차에 어떤 실제 시나리오" (이 테이블, 신설)
--
-- 편성 = scenarios(content_format='scenario_core_v1')를 outline_id·week_no에 꽂는 것.
-- 시나리오 생성·검수는 기존 흐름을 그대로 쓴다(여기서 콘텐츠를 만들지 않는다).
-- RLS·GRANT·트리거는 curriculum_weeks와 동일 패턴(admin 전용).

CREATE TABLE IF NOT EXISTS public.curriculum_week_scenarios (
  id           uuid        NOT NULL DEFAULT gen_random_uuid(),
  outline_id   uuid        NOT NULL,
  week_no      int         NOT NULL,
  scenario_id  uuid        NOT NULL,
  position     int         NOT NULL DEFAULT 0,   -- 주차 내 정렬 순서
  slot_role    text        NOT NULL DEFAULT 'primary', -- primary | interpreting | 등
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT curriculum_week_scenarios_pkey PRIMARY KEY (id),
  CONSTRAINT curriculum_week_scenarios_outline_fkey
    FOREIGN KEY (outline_id) REFERENCES public.curriculum_outlines(id) ON DELETE CASCADE,
  CONSTRAINT curriculum_week_scenarios_scenario_fkey
    FOREIGN KEY (scenario_id) REFERENCES public.scenarios(scenario_id) ON DELETE CASCADE,
  CONSTRAINT curriculum_week_scenarios_week_no_check
    CHECK (week_no >= 1),
  -- 같은 주차에 같은 시나리오 중복 배정 금지
  CONSTRAINT curriculum_week_scenarios_unique
    UNIQUE (outline_id, week_no, scenario_id)
);

CREATE INDEX IF NOT EXISTS curriculum_week_scenarios_outline_idx
  ON public.curriculum_week_scenarios (outline_id, week_no, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.curriculum_week_scenarios TO authenticated;
GRANT ALL ON public.curriculum_week_scenarios TO service_role;

ALTER TABLE public.curriculum_week_scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "curriculum_week_scenarios_admin_all"
  ON public.curriculum_week_scenarios FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TRIGGER curriculum_week_scenarios_set_updated_at
  BEFORE UPDATE ON public.curriculum_week_scenarios
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
