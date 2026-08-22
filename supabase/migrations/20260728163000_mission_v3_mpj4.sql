-- Full Mission MPJ5 → MPJ4 전환. 2026-07-28.
--
-- 신규 생성물은 mission_v3으로 저장한다. 기존 mission_v1/v2는 회귀검사·열람을
-- 위해 그대로 허용하며 데이터 변환이나 삭제를 하지 않는다.
-- target_feature_version 및 reviewed 감사 조건은 기존 제약에서 그대로 유지한다.

ALTER TABLE public.scenarios DROP CONSTRAINT IF EXISTS scenarios_mission_ck;
ALTER TABLE public.scenarios ADD CONSTRAINT scenarios_mission_ck
  CHECK ( (mission_content IS NULL AND mission_status IS NULL)
       OR (mission_content IS NOT NULL
           AND mission_status IN ('generated','reviewed')
           AND mission_content->>'schema_version' IN ('mission_v1','mission_v2','mission_v3')
           AND target_feature IS NOT NULL
           AND target_feature_version IS NOT NULL) );
