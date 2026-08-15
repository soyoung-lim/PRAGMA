-- 연구 콘텐츠 LLM 호출 통제(2026-08-04)
-- 1) 프롬프트·응답 본문 없이 호출별 모델·usage·재시도 이력을 append-only로 적재한다.
-- 2) 품질점검이 없는 신규 미션 저장을 DB에서도 막는다.
-- 기존 scenarios 행은 UPDATE하지 않는다.

CREATE TABLE IF NOT EXISTS public.llm_invocation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_group_id uuid NOT NULL,
  provider text NOT NULL,
  operation text NOT NULL CHECK (operation IN (
    'core_generate',
    'core_repair',
    'mission_generate',
    'core_critic',
    'mission_critic',
    'authentic_analyze',
    'legacy_outline',
    'legacy_scenario_generate',
    'learner_feedback'
  )),
  -- 논리 상관키만 보존한다. refresh로 scenario가 삭제돼도 과거 호출 장부는 바꾸지 않는다.
  scenario_id uuid,
  generation_run_id text,
  generation_item_key text,
  invocation_attempt integer NOT NULL DEFAULT 1 CHECK (invocation_attempt >= 1),
  model_requested text NOT NULL,
  model_returned text,
  is_model_fallback boolean NOT NULL DEFAULT false,
  fallback_from text,
  status_code integer NOT NULL CHECK (status_code BETWEEN 100 AND 599),
  success boolean NOT NULL,
  finish_reason text,
  prompt_tokens integer CHECK (prompt_tokens IS NULL OR prompt_tokens >= 0),
  completion_tokens integer CHECK (completion_tokens IS NULL OR completion_tokens >= 0),
  total_tokens integer CHECK (total_tokens IS NULL OR total_tokens >= 0),
  cached_tokens integer CHECK (cached_tokens IS NULL OR cached_tokens >= 0),
  reasoning_tokens integer CHECK (reasoning_tokens IS NULL OR reasoning_tokens >= 0),
  duration_ms integer NOT NULL CHECK (duration_ms >= 0),
  provider_request_id text,
  provider_response_id text,
  prompt_version text,
  prompt_snapshot_hash text,
  content_release_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.llm_invocation_events IS
  'Append-only LLM invocation ledger. Prompt and response bodies are intentionally excluded.';
COMMENT ON COLUMN public.llm_invocation_events.request_group_id IS
  'One Edge Function request; multiple rows mean repair or explicit fallback attempts.';
COMMENT ON COLUMN public.llm_invocation_events.is_model_fallback IS
  'True only when a later attempt intentionally changed model; research content keeps this false.';
CREATE INDEX IF NOT EXISTS llm_invocation_events_operation_created_idx
  ON public.llm_invocation_events (operation, created_at DESC);
CREATE INDEX IF NOT EXISTS llm_invocation_events_run_idx
  ON public.llm_invocation_events (generation_run_id, generation_item_key)
  WHERE generation_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS llm_invocation_events_scenario_idx
  ON public.llm_invocation_events (scenario_id, created_at DESC)
  WHERE scenario_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS llm_invocation_events_model_idx
  ON public.llm_invocation_events (model_requested, created_at DESC);
REVOKE ALL ON public.llm_invocation_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.llm_invocation_events TO authenticated;
GRANT INSERT, SELECT ON public.llm_invocation_events TO service_role;
ALTER TABLE public.llm_invocation_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read LLM invocation events"
  ON public.llm_invocation_events FOR SELECT
  TO authenticated
  USING (public.is_admin());
CREATE OR REPLACE FUNCTION public.reject_llm_invocation_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'llm_invocation_events is append-only';
END;
$$;
REVOKE ALL ON FUNCTION public.reject_llm_invocation_event_mutation() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER llm_invocation_events_append_only
  BEFORE UPDATE OR DELETE ON public.llm_invocation_events
  FOR EACH ROW EXECUTE FUNCTION public.reject_llm_invocation_event_mutation();
-- 신규 generated 미션에는 최소한 유효한 품질점검 객체가 반드시 포함되어야 한다.
CREATE OR REPLACE FUNCTION public.save_generated_mission(p_scenario_id uuid, p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_mission jsonb := p_payload->'mission_content';
  v_quality jsonb := v_mission->'quality_check';
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can save missions';
  END IF;

  IF jsonb_typeof(v_quality) IS DISTINCT FROM 'object'
     OR COALESCE(v_quality->>'verdict', '') NOT IN ('pass', 'warning', 'fail')
     OR COALESCE(v_quality->>'model', '') = ''
     OR COALESCE(v_quality->>'prompt_version', '') = ''
     OR COALESCE(v_quality->>'checked_at', '') = '' THEN
    RAISE EXCEPTION 'A valid quality_check is required before saving a generated mission';
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
