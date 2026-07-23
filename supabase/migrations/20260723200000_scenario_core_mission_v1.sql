-- 생성계약 v1.3 §6 — scenario_core_v1 + mission_v1 2층 + 편성층 메타.
-- 2026-07-23. 500개 코어 구축 단위 + 선별 미션 승격 + theme/topic 편성 축.
--
-- 저장 구조: 별도 테이블이 아니라 scenarios 행에 얹는다(B10). content_format으로
-- legacy 29건과 공존. 미션은 format이 아니라 층(mission_content·mission_status 병렬).

-- ── 1. 컬럼 ────────────────────────────────────────────────────────────
ALTER TABLE public.scenarios
  ADD COLUMN IF NOT EXISTS content_format text NOT NULL DEFAULT 'legacy_v1',
  ADD COLUMN IF NOT EXISTS core_content jsonb,
  ADD COLUMN IF NOT EXISTS source_modality text,
  ADD COLUMN IF NOT EXISTS theme_code text,
  ADD COLUMN IF NOT EXISTS topic_code text,
  ADD COLUMN IF NOT EXISTS mission_content jsonb,
  ADD COLUMN IF NOT EXISTS mission_status text,               -- NULL|generated|reviewed
  ADD COLUMN IF NOT EXISTS mission_reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS mission_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS target_feature text,
  ADD COLUMN IF NOT EXISTS target_feature_version text,
  ADD COLUMN IF NOT EXISTS prompt_snapshot_hash text,
  ADD COLUMN IF NOT EXISTS generation_run_id text,
  ADD COLUMN IF NOT EXISTS generation_item_key text,
  ADD COLUMN IF NOT EXISTS content_hash text,
  ADD COLUMN IF NOT EXISTS supersedes_scenario_id uuid REFERENCES public.scenarios(scenario_id),
  ADD COLUMN IF NOT EXISTS approval_basis text;

-- ── 2. CHECK 제약 ──────────────────────────────────────────────────────
ALTER TABLE public.scenarios DROP CONSTRAINT IF EXISTS scenarios_content_format_ck;
ALTER TABLE public.scenarios ADD CONSTRAINT scenarios_content_format_ck
  CHECK (content_format IN ('legacy_v1','scenario_core_v1'));

ALTER TABLE public.scenarios DROP CONSTRAINT IF EXISTS scenarios_core_ck;
ALTER TABLE public.scenarios ADD CONSTRAINT scenarios_core_ck
  CHECK (content_format <> 'scenario_core_v1' OR (
    core_content IS NOT NULL
    AND core_content->>'schema_version' = 'scenario_core_v1'
    AND source_modality IN ('written','spoken')
    AND theme_code IN ('campus_study','daily_living','travel_mobility','relationship_social',
                       'career_workplace','commerce_customer','digital_content','international_exchange')
    AND topic_code IS NOT NULL ));

ALTER TABLE public.scenarios DROP CONSTRAINT IF EXISTS scenarios_mission_ck;
ALTER TABLE public.scenarios ADD CONSTRAINT scenarios_mission_ck
  CHECK ( (mission_content IS NULL AND mission_status IS NULL)
       OR (mission_content IS NOT NULL
           AND mission_status IN ('generated','reviewed')
           AND mission_content->>'schema_version' = 'mission_v1'
           AND target_feature IS NOT NULL) );

ALTER TABLE public.scenarios DROP CONSTRAINT IF EXISTS scenarios_mission_reviewed_ck;
ALTER TABLE public.scenarios ADD CONSTRAINT scenarios_mission_reviewed_ck
  CHECK (mission_status IS DISTINCT FROM 'reviewed' OR mission_reviewed_at IS NOT NULL);

-- 복합 멱등키 (0-b·22): 런 재시도 멱등 + 셀 재생성·supersedes 허용
CREATE UNIQUE INDEX IF NOT EXISTS scenarios_generation_run_item_ux
  ON public.scenarios(generation_run_id, generation_item_key)
  WHERE generation_item_key IS NOT NULL;

-- 편성 필터용 인덱스
CREATE INDEX IF NOT EXISTS scenarios_theme_idx ON public.scenarios(theme_code)
  WHERE theme_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS scenarios_mission_status_idx ON public.scenarios(mission_status)
  WHERE mission_status IS NOT NULL;

-- ── 3. RPC: save_generated_core (배치용 INSERT) ────────────────────────
-- payload: { title, speech_act, learner_level, domain, industry_sector, mode,
--            source_modality, theme_code, topic_code, core_content, meta,
--            generation_run_id, generation_item_key, content_hash, prompt_snapshot_hash }
-- 행 태그의 p/d/r·genre는 core_content에서 파생한다(core_content 정본, B10).
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

  INSERT INTO public.scenarios (
    title, source_text, topic,
    speech_act, genre, learner_level,
    domain, industry_sector, mode,
    scenario_p, scenario_d, scenario_r,
    content_format, core_content, source_modality, theme_code, topic_code,
    review_status, usage_assignment, auto_check_result,
    generation_provider, generator_model, generation_prompt_version,
    generation_run_id, generation_item_key, content_hash, prompt_snapshot_hash
  ) VALUES (
    COALESCE(p_payload->>'title', v_core->>'situation_ko'),
    v_core->>'source_text_ko',
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

-- ── 4. RPC: save_generated_mission (승격용 UPDATE, 같은 행) ─────────────
-- 대상 = content_format='scenario_core_v1' AND mission_content IS NULL인 행만.
-- 재생성·수정은 supersedes 새 행(이 RPC 아님).
CREATE OR REPLACE FUNCTION public.save_generated_mission(p_scenario_id uuid, p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_mission jsonb := p_payload->'mission_content';
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can save missions';
  END IF;

  UPDATE public.scenarios
  SET mission_content = v_mission,
      mission_status = 'generated',
      target_feature = v_mission->'unit'->>'target_feature',
      target_feature_version = v_mission->'unit'->>'target_feature_version'
  WHERE scenario_id = p_scenario_id
    AND content_format = 'scenario_core_v1'
    AND mission_content IS NULL
  RETURNING scenario_id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'core not found or already promoted: %', p_scenario_id;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_generated_mission(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_generated_mission(uuid, jsonb) TO authenticated, service_role;

-- ── 5. RPC: review_mission (실행 게이트 0-b·17) ────────────────────────
CREATE OR REPLACE FUNCTION public.review_mission(p_scenario_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can review missions';
  END IF;

  UPDATE public.scenarios
  SET mission_status = 'reviewed',
      mission_reviewed_by = auth.uid(),
      mission_reviewed_at = now()
  WHERE scenario_id = p_scenario_id
    AND mission_status = 'generated'
  RETURNING scenario_id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'mission not found or not in generated state: %', p_scenario_id;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.review_mission(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_mission(uuid) TO authenticated, service_role;
