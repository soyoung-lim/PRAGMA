-- PRAGMA moat v1: append-only mission lineage.
-- 문헌/설계 규칙 scope → 생성 provenance → 자동검사 → AI 비평 → 인간 검토를
-- 같은 scenario의 불변 스냅샷으로 연결한다. 기존 scenarios 행은 실행용 현재본,
-- 이 테이블은 감사 가능한 이력 정본이다.

CREATE TABLE public.mission_lineage_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id uuid NOT NULL REFERENCES public.scenarios(scenario_id) ON DELETE CASCADE,
  version_no integer NOT NULL CHECK (version_no > 0),
  parent_version_id uuid REFERENCES public.mission_lineage_versions(id),
  stage text NOT NULL CHECK (stage IN ('generated', 'reviewed', 'released', 'superseded')),

  mission_content jsonb NOT NULL,
  item_lineage jsonb,
  mission_content_hash text,
  realization_pack_id text,
  realization_pack_version text,
  coverage_status text NOT NULL DEFAULT 'not_covered'
    CHECK (coverage_status IN ('covered', 'not_covered')),
  rule_scope_ids text[] NOT NULL DEFAULT '{}',
  risk_scope_ids text[] NOT NULL DEFAULT '{}',
  evidence_scope_ids text[] NOT NULL DEFAULT '{}',

  generation_provider text,
  generation_model text,
  prompt_version text,
  prompt_snapshot_hash text,
  prompt_instance_hash text,
  generation_attempt integer,
  validation_result jsonb,
  ai_quality_result jsonb,

  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (scenario_id, version_no),
  CHECK (
    coverage_status = 'not_covered'
    OR (realization_pack_id IS NOT NULL AND realization_pack_version IS NOT NULL)
  ),
  CHECK (item_lineage IS NULL OR jsonb_typeof(item_lineage) = 'object'),
  CHECK (stage <> 'reviewed' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);

CREATE INDEX mission_lineage_scenario_version_idx
  ON public.mission_lineage_versions(scenario_id, version_no DESC);
CREATE INDEX mission_lineage_pack_idx
  ON public.mission_lineage_versions(realization_pack_id, realization_pack_version)
  WHERE realization_pack_id IS NOT NULL;

GRANT SELECT, INSERT ON public.mission_lineage_versions TO authenticated;
GRANT ALL ON public.mission_lineage_versions TO service_role;
REVOKE UPDATE, DELETE ON public.mission_lineage_versions FROM authenticated, anon;

ALTER TABLE public.mission_lineage_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_select_mission_lineage"
  ON public.mission_lineage_versions FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "admin_insert_mission_lineage"
  ON public.mission_lineage_versions FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() AND actor_id = auth.uid());

-- 저장과 lineage append를 같은 트랜잭션에서 수행한다. 기존 payload도 허용하되
-- lineage_meta가 없으면 not_covered로 정직하게 기록한다.
CREATE OR REPLACE FUNCTION public.save_generated_mission(p_scenario_id uuid, p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_mission jsonb := p_payload->'mission_content';
  v_meta jsonb := COALESCE(p_payload->'lineage_meta', '{}'::jsonb);
  v_version integer;
  v_parent uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can save missions';
  END IF;
  IF v_mission IS NULL OR jsonb_typeof(v_mission) <> 'object' THEN
    RAISE EXCEPTION 'mission_content object is required';
  END IF;

  -- scenario별 version_no 계산과 현재본 갱신을 같은 잠금 아래 직렬화한다.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_scenario_id::text, 0));

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

  SELECT id, version_no + 1
    INTO v_parent, v_version
  FROM public.mission_lineage_versions
  WHERE scenario_id = p_scenario_id
  ORDER BY version_no DESC
  LIMIT 1;
  v_version := COALESCE(v_version, 1);

  INSERT INTO public.mission_lineage_versions (
    scenario_id, version_no, parent_version_id, stage,
    mission_content, item_lineage, mission_content_hash,
    realization_pack_id, realization_pack_version, coverage_status,
    rule_scope_ids, risk_scope_ids, evidence_scope_ids,
    generation_provider, generation_model, prompt_version, prompt_snapshot_hash, prompt_instance_hash,
    generation_attempt, validation_result, ai_quality_result,
    actor_id
  ) VALUES (
    p_scenario_id, v_version, v_parent, 'generated',
    v_mission,
    v_mission->'item_lineage',
    NULLIF(v_mission->'provenance'->>'mission_content_hash', ''),
    NULLIF(v_meta->>'realization_pack_id', ''),
    NULLIF(v_meta->>'realization_pack_version', ''),
    COALESCE(NULLIF(v_meta->>'coverage_status', ''), 'not_covered'),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_meta->'rule_scope_ids', '[]'::jsonb))),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_meta->'risk_scope_ids', '[]'::jsonb))),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_meta->'evidence_scope_ids', '[]'::jsonb))),
    NULLIF(v_mission->'provenance'->>'provider', ''),
    NULLIF(v_mission->'provenance'->>'model', ''),
    NULLIF(v_mission->'provenance'->>'prompt_version', ''),
    NULLIF(v_mission->'provenance'->>'prompt_snapshot_hash', ''),
    NULLIF(v_mission->'provenance'->>'prompt_instance_hash', ''),
    NULLIF(v_mission->'provenance'->>'generation_attempt', '')::integer,
    p_payload->'validation_result',
    v_mission->'quality_check',
    auth.uid()
  );

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_generated_mission(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_generated_mission(uuid, jsonb) TO authenticated, service_role;

-- 검토는 기존 generated snapshot을 수정하지 않고 reviewed snapshot을 append한다.
CREATE OR REPLACE FUNCTION public.review_mission(p_scenario_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_mission jsonb;
  v_parent public.mission_lineage_versions%ROWTYPE;
  v_version integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can review missions';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_scenario_id::text, 0));

  UPDATE public.scenarios
  SET mission_status = 'reviewed',
      mission_reviewed_by = auth.uid(),
      mission_reviewed_at = now()
  WHERE scenario_id = p_scenario_id
    AND mission_status = 'generated'
  RETURNING scenario_id, mission_content INTO v_id, v_mission;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'mission not found or not in generated state: %', p_scenario_id;
  END IF;

  SELECT * INTO v_parent
  FROM public.mission_lineage_versions
  WHERE scenario_id = p_scenario_id
  ORDER BY version_no DESC
  LIMIT 1;
  v_version := COALESCE(v_parent.version_no, 0) + 1;

  INSERT INTO public.mission_lineage_versions (
    scenario_id, version_no, parent_version_id, stage,
    mission_content, item_lineage, mission_content_hash,
    realization_pack_id, realization_pack_version, coverage_status,
    rule_scope_ids, risk_scope_ids, evidence_scope_ids,
    generation_provider, generation_model, prompt_version, prompt_snapshot_hash, prompt_instance_hash,
    generation_attempt, validation_result, ai_quality_result,
    actor_id, reviewed_by, reviewed_at
  ) VALUES (
    p_scenario_id, v_version, v_parent.id, 'reviewed',
    v_mission,
    COALESCE(v_parent.item_lineage, v_mission->'item_lineage'),
    COALESCE(v_parent.mission_content_hash, NULLIF(v_mission->'provenance'->>'mission_content_hash', '')),
    v_parent.realization_pack_id,
    v_parent.realization_pack_version,
    COALESCE(v_parent.coverage_status, 'not_covered'),
    COALESCE(v_parent.rule_scope_ids, '{}'),
    COALESCE(v_parent.risk_scope_ids, '{}'),
    COALESCE(v_parent.evidence_scope_ids, '{}'),
    COALESCE(v_parent.generation_provider, NULLIF(v_mission->'provenance'->>'provider', '')),
    COALESCE(v_parent.generation_model, NULLIF(v_mission->'provenance'->>'model', '')),
    COALESCE(v_parent.prompt_version, NULLIF(v_mission->'provenance'->>'prompt_version', '')),
    COALESCE(v_parent.prompt_snapshot_hash, NULLIF(v_mission->'provenance'->>'prompt_snapshot_hash', '')),
    COALESCE(v_parent.prompt_instance_hash, NULLIF(v_mission->'provenance'->>'prompt_instance_hash', '')),
    COALESCE(v_parent.generation_attempt, NULLIF(v_mission->'provenance'->>'generation_attempt', '')::integer),
    v_parent.validation_result,
    COALESCE(v_parent.ai_quality_result, v_mission->'quality_check'),
    auth.uid(), auth.uid(), now()
  );

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.review_mission(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_mission(uuid) TO authenticated, service_role;
