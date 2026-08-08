-- 단일 코어 생성에서 선택한 직무 기능을 기존 scenarios.business_function에 저장한다.
-- 새 테이블·새 컬럼은 만들지 않는다. 기존 저장 RPC의 INSERT 열만 확장한다.

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

  v_genre := CASE v_channel
    WHEN 'email' THEN 'business_email'
    WHEN 'messenger' THEN 'business_messenger'
    WHEN 'facetoface' THEN 'meeting_speech'
    WHEN 'phone' THEN 'business_messenger'
    ELSE 'business_messenger' END;
  v_p := CASE v_p_json WHEN 'speaker_lower' THEN 'higher'
                       WHEN 'speaker_higher' THEN 'lower'
                       ELSE 'equal' END;
  v_d := CASE v_d_json WHEN 'distant' THEN 'formal' ELSE v_d_json END;
  v_direction := COALESCE(p_payload->>'language_direction', v_core->>'direction', 'ko_zh');

  INSERT INTO public.scenarios (
    title, source_text, topic,
    speech_act, genre, learner_level,
    domain, industry_sector, business_function, mode,
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
    NULLIF(p_payload->>'business_function', ''),
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
