-- 20260725000000_bidirectional_v2.sql이 mission_v2를 허용하도록 CHECK를
-- 재작성하는 과정에서 누락한 target_feature_version 필수 조건을 복원한다.
-- mission_v1|mission_v2 허용과 reviewed 검토자·시각 제약은 그대로 유지한다.
-- 기존 결측값을 임의 backfill하지 않는다. 결측 미션이 있으면 적용을 중단해
-- 연구자가 해당 행의 실제 카탈로그 버전을 확인하도록 한다.

DO $$
DECLARE
  v_missing_count bigint;
BEGIN
  SELECT count(*)
  INTO v_missing_count
  FROM public.scenarios
  WHERE mission_content IS NOT NULL
    AND target_feature_version IS NULL;

  IF v_missing_count > 0 THEN
    RAISE EXCEPTION
      'Cannot restore scenarios_mission_ck: % mission rows lack target_feature_version',
      v_missing_count;
  END IF;
END;
$$;

ALTER TABLE public.scenarios DROP CONSTRAINT IF EXISTS scenarios_mission_ck;
ALTER TABLE public.scenarios ADD CONSTRAINT scenarios_mission_ck
  CHECK ( (mission_content IS NULL AND mission_status IS NULL)
       OR (mission_content IS NOT NULL
           AND mission_status IN ('generated','reviewed')
           AND mission_content->>'schema_version' IN ('mission_v1','mission_v2')
           AND target_feature IS NOT NULL
           AND target_feature_version IS NOT NULL) );
