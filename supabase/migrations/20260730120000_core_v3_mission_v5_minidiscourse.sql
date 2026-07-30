-- 미니 담화형 DCT 계약: scenario_core_v3(2~4문장 원문 + focal_segments) +
-- mission_v5(MPJ4 동일 + 미니 담화 DCT). 2026-07-30 KST. DEC-20260730-01.
--
-- MPJ 구성·순서·판정과 저장 페이로드는 v4와 같다. 변경점은 DCT 원문뿐이다.
-- 기존 scenario_core_v1/v2 · mission_v1~v4 데이터는 읽기·회귀검사용으로
-- 그대로 허용하며 변환·삭제·백필하지 않는다(계열 혼합 생성만 금지).
-- target_feature_version 및 reviewed 감사 조건도 그대로 유지한다.

ALTER TABLE public.scenarios DROP CONSTRAINT IF EXISTS scenarios_core_ck;
ALTER TABLE public.scenarios ADD CONSTRAINT scenarios_core_ck
  CHECK (content_format <> 'scenario_core_v1' OR (
    core_content IS NOT NULL
    AND core_content->>'schema_version' IN ('scenario_core_v1','scenario_core_v2','scenario_core_v3')
    AND source_modality IN ('written','spoken')
    AND theme_code IN ('campus_study','daily_living','travel_mobility','relationship_social',
                       'career_workplace','commerce_customer','digital_content','international_exchange')
    AND topic_code IS NOT NULL ));

ALTER TABLE public.scenarios DROP CONSTRAINT IF EXISTS scenarios_mission_ck;
ALTER TABLE public.scenarios ADD CONSTRAINT scenarios_mission_ck
  CHECK ( (mission_content IS NULL AND mission_status IS NULL)
       OR (mission_content IS NOT NULL
           AND mission_status IN ('generated','reviewed')
           AND mission_content->>'schema_version' IN ('mission_v1','mission_v2','mission_v3','mission_v4','mission_v5')
           AND target_feature IS NOT NULL
           AND target_feature_version IS NOT NULL) );
