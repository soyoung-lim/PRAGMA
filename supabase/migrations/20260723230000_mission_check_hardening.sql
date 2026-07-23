-- 계약 v1.4 0-e·37 (2026-07-23 정합 라운드): 승인 CHECK를 문서의 감사 요구 수준으로 강화.
-- reviewed = 검토자+시각 둘 다 기록 / 미션 = target_feature_version 필수.
-- 기존 행 영향 없음(mission_status 설정 행 아직 0건).

ALTER TABLE public.scenarios DROP CONSTRAINT IF EXISTS scenarios_mission_ck;
ALTER TABLE public.scenarios ADD CONSTRAINT scenarios_mission_ck
  CHECK ( (mission_content IS NULL AND mission_status IS NULL)
       OR (mission_content IS NOT NULL
           AND mission_status IN ('generated','reviewed')
           AND mission_content->>'schema_version' = 'mission_v1'
           AND target_feature IS NOT NULL
           AND target_feature_version IS NOT NULL) );

ALTER TABLE public.scenarios DROP CONSTRAINT IF EXISTS scenarios_mission_reviewed_ck;
ALTER TABLE public.scenarios ADD CONSTRAINT scenarios_mission_reviewed_ck
  CHECK (mission_status IS DISTINCT FROM 'reviewed'
      OR (mission_reviewed_at IS NOT NULL AND mission_reviewed_by IS NOT NULL));
