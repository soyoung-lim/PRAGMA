-- Full Mission 신규 계약: Judge3+FixChoice4 → Reason3 → MultiJudge4 → DCT.
-- 2026-07-29 KST.
--
-- 신규 생성물만 mission_v4로 저장한다. 기존 mission_v1/v2/v3 데이터는
-- 읽기·회귀검사용으로 그대로 허용하며 변환·삭제하지 않는다.
-- target_feature_version 및 reviewed 감사 조건도 그대로 유지한다.

ALTER TABLE public.scenarios DROP CONSTRAINT IF EXISTS scenarios_mission_ck;
ALTER TABLE public.scenarios ADD CONSTRAINT scenarios_mission_ck
  CHECK ( (mission_content IS NULL AND mission_status IS NULL)
       OR (mission_content IS NOT NULL
           AND mission_status IN ('generated','reviewed')
           AND mission_content->>'schema_version' IN ('mission_v1','mission_v2','mission_v3','mission_v4')
           AND target_feature IS NOT NULL
           AND target_feature_version IS NOT NULL) );
