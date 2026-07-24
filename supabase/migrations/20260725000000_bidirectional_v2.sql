-- 양방향 일반화 v2 (생성계약 0-l·84·89). 2026-07-25.
--
-- 원칙: "저장은 그대로, 읽기에서 정규화". 기존 v1 코어·미션 행은 무수정.
-- CHECK를 v1 OR v2 허용(상위집합)으로 완화 + 코어 행에 language_direction 백필.
-- content_format 컬럼 값은 'scenario_core_v1' 유지(행-타입 마커) — 방향·버전은
-- core_content/mission_content JSON의 schema_version·direction으로만 구분한다.
-- 따라서 listCoreScenarios·coreBatchRun·composer의 .eq('content_format',...) 무영향.

-- ── 1. CHECK 완화: 코어 v1 OR v2 ───────────────────────────────────────
-- 기존 제약의 상위집합(v1 조건을 그대로 포함 + v2 허용) → 기존 행 위반 불가능.
ALTER TABLE public.scenarios DROP CONSTRAINT IF EXISTS scenarios_core_ck;
ALTER TABLE public.scenarios ADD CONSTRAINT scenarios_core_ck
  CHECK (content_format <> 'scenario_core_v1' OR (
    core_content IS NOT NULL
    AND core_content->>'schema_version' IN ('scenario_core_v1','scenario_core_v2')
    AND source_modality IN ('written','spoken')
    AND theme_code IN ('campus_study','daily_living','travel_mobility','relationship_social',
                       'career_workplace','commerce_customer','digital_content','international_exchange')
    AND topic_code IS NOT NULL ));

-- ── 2. CHECK 완화: 미션 v1 OR v2 ───────────────────────────────────────
ALTER TABLE public.scenarios DROP CONSTRAINT IF EXISTS scenarios_mission_ck;
ALTER TABLE public.scenarios ADD CONSTRAINT scenarios_mission_ck
  CHECK ( (mission_content IS NULL AND mission_status IS NULL)
       OR (mission_content IS NOT NULL
           AND mission_status IN ('generated','reviewed')
           AND mission_content->>'schema_version' IN ('mission_v1','mission_v2')
           AND target_feature IS NOT NULL) );

-- ── 3. language_direction 백필 (코어 행 한정, 멱등) ─────────────────────
-- 대상 = scenario_core_v1 마커 + 방향 태그 NULL(기존 108 코어는 방향 태그 없이 저장됨).
-- 값 = core_content.direction 우선(v2 코어라면), 없으면 'ko_zh'(v1 = 한→중 전제).
-- ⚠️ 전 테이블 CHECK/NOT NULL은 걸지 않는다(legacy 하이픈 값 존재 가능 — 0-l·84).
UPDATE public.scenarios
SET language_direction = COALESCE(core_content->>'direction', 'ko_zh')
WHERE content_format = 'scenario_core_v1'
  AND language_direction IS NULL;

-- ── 4. save_generated_core 갱신 (v2 저장 + language_direction INSERT) ──
-- 변경점: ① source_text 컬럼 = source_text_ko(v1) 또는 source_text(v2) COALESCE
--         ② language_direction 컬럼 INSERT (payload 또는 core_content.direction, 기본 ko_zh)
-- 나머지(p/d/r·genre 파생, RLS 가드, 태그)는 무변경 — pdr 구조는 v1·v2 동일.
CREATE OR REPLACE FUNCTION public.save_generated_core(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_core jsonb := p_payload->'core_content';
  v_meta jsonb := COALESCE(p_payload->'meta', '{}'::jsonb);
  v_channel text := v_core->>'channel';
  v_p_json text := v_core->'pdr'->>'p';
  v_d_json text := v_core->'pdr'->>'d';
  v_r text := v_core->'pdr'->>'r';
  v_genre text;
  v_p text;
  v_d text;
  v_direction text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can save generated cores';
  END IF;

  -- channel → genre (CHANNEL_TO_GENRE)
  v_genre := CASE v_channel
    WHEN 'email' THEN 'business_email'
    WHEN 'messenger' THEN 'business_messenger'
    WHEN 'facetoface' THEN 'meeting_speech'
    WHEN 'phone' THEN 'business_messenger'
    ELSE 'business_messenger' END;
  -- PDR JSON 이름 → 행 enum 값
  v_p := CASE v_p_json WHEN 'speaker_lower' THEN 'higher'
                       WHEN 'speaker_higher' THEN 'lower'
                       ELSE 'equal' END;
  v_d := CASE v_d_json WHEN 'distant' THEN 'formal' ELSE v_d_json END;
  -- 방향 = payload 명시 > core_content.direction > ko_zh(기본)
  v_direction := COALESCE(p_payload->>'language_direction', v_core->>'direction', 'ko_zh');

  INSERT INTO public.scenarios (
    title, source_text, topic,
    speech_act, genre, learner_level,
    domain, industry_sector, mode,
    scenario_p, scenario_d, scenario_r,
    content_format, core_content, source_modality, theme_code, topic_code,
    language_direction,
    review_status, usage_assignment, auto_check_result,
    generation_provider, generator_model, generation_prompt_version,
    generation_run_id, generation_item_key, content_hash, prompt_snapshot_hash
  ) VALUES (
    COALESCE(p_payload->>'title', v_core->>'situation_ko'),
    COALESCE(v_core->>'source_text_ko', v_core->>'source_text'),
    v_core->>'situation_ko',
    (p_payload->>'speech_act')::public.speech_act,
    v_genre,
    p_payload->>'learner_level',
    p_payload->>'domain',
    p_payload->>'industry_sector',
    p_payload->>'mode',
    v_p, v_d, v_r,
    'scenario_core_v1',
    v_core,
    p_payload->>'source_modality',
    p_payload->>'theme_code',
    p_payload->>'topic_code',
    v_direction,
    'needs_review'::public.review_status,
    'archived_only'::public.usage_assignment,
    NULLIF(p_payload->>'auto_check_result','')::public.auto_check_result,
    v_meta->>'provider',
    v_meta->>'model',
    v_meta->>'prompt_version',
    p_payload->>'generation_run_id',
    p_payload->>'generation_item_key',
    p_payload->>'content_hash',
    p_payload->>'prompt_snapshot_hash'
  )
  RETURNING scenario_id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_generated_core(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_generated_core(jsonb) TO authenticated, service_role;
