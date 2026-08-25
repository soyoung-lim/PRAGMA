-- AI-assisted mission authoring v1.
-- One whole draft is saved even when the semantic critic reports issues. Only
-- structurally valid content may enter generated state; learner exposure remains
-- blocked until a professor finalizes the current content and fresh lineage/hash.

ALTER TABLE public.llm_invocation_events
  DROP CONSTRAINT IF EXISTS llm_invocation_events_operation_check;

ALTER TABLE public.llm_invocation_events
  ADD CONSTRAINT llm_invocation_events_operation_check CHECK (operation IN (
    'core_generate',
    'core_repair',
    'mission_generate',
    'mission_repair',
    'item_lineage_attribution',
    'core_critic',
    'mission_critic',
    'authentic_analyze',
    'legacy_outline',
    'legacy_scenario_generate',
    'learner_feedback'
  ));

CREATE OR REPLACE FUNCTION public.validate_mission_authoring_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_mission jsonb := NEW.mission_content;
  v_authoring jsonb;
  v_plan jsonb;
  v_expected_types constant text[] := ARRAY['scale4','judge3','fix_choice','reason','multi_judge'];
  v_actual_types text[];
  v_within integer;
  v_non_within integer;
BEGIN
  IF v_mission IS NULL
     OR v_mission->'provenance'->>'prompt_version'
        IS DISTINCT FROM 'mission_v5_mpj5_minidiscourse_v6_authoring' THEN
    RETURN NEW;
  END IF;

  v_authoring := v_mission->'authoring';
  v_plan := v_mission->'contrast_plan';
  IF v_mission->>'schema_version' IS DISTINCT FROM 'mission_v5'
     OR v_mission->'provenance'->>'content_release_id'
        IS DISTINCT FROM 'pragma_content_candidate_20260825_02_authoring'
     OR v_mission->'learning_goal'->>'kind' IS DISTINCT FROM 'speech_act'
     OR v_mission->'learning_goal'->>'speech_act' IS DISTINCT FROM NEW.speech_act::text
     OR v_plan->>'version' IS DISTINCT FROM 'contrast_plan_v1'
     OR v_plan->>'mission_goal' IS DISTINCT FROM 'integrated_speech_act'
     OR v_plan->>'speech_act' IS DISTINCT FROM NEW.speech_act::text
     OR jsonb_typeof(v_plan->'item_slots') IS DISTINCT FROM 'array'
     OR jsonb_array_length(v_plan->'item_slots') <> 5
     OR jsonb_typeof(v_mission->'mpj_items') IS DISTINCT FROM 'array'
     OR jsonb_array_length(v_mission->'mpj_items') <> 5
     OR v_authoring->>'schema_version' IS DISTINCT FROM 'mission_authoring_v1'
     OR COALESCE((v_authoring->>'repair_attempts')::integer, -1) NOT BETWEEN 0 AND 1
     OR jsonb_typeof(v_mission->'quality_check') IS DISTINCT FROM 'object'
     OR COALESCE(v_mission->'quality_check'->>'verdict', '') NOT IN ('pass','warning','fail') THEN
    RAISE EXCEPTION 'Current mission authoring contract is incomplete';
  END IF;

  SELECT array_agg(item->>'type' ORDER BY ordinality)
  INTO v_actual_types
  FROM jsonb_array_elements(v_mission->'mpj_items')
    WITH ORDINALITY source(item, ordinality);

  IF v_actual_types IS DISTINCT FROM v_expected_types
     OR EXISTS (
       SELECT 1
       FROM jsonb_array_elements(v_mission->'mpj_items') WITH ORDINALITY source(item, ordinality)
       JOIN jsonb_array_elements(v_plan->'item_slots') WITH ORDINALITY planned(slot, slot_ordinality)
         ON slot_ordinality = ordinality
       WHERE (item->>'id')::integer <> ordinality
          OR (slot->>'item_id')::integer <> ordinality
          OR slot->>'item_type' IS DISTINCT FROM item->>'type'
          OR COALESCE(item->>'item_focus', item->>'axis_feature') IS DISTINCT FROM slot->>'item_focus'
          OR item->>'axis_feature' IS DISTINCT FROM COALESCE(item->>'item_focus', item->>'axis_feature')
     ) THEN
    RAISE EXCEPTION 'Mission items do not match contrast_plan_v1';
  END IF;

  SELECT
    count(*) FILTER (WHERE candidate->'accepted_band_codes' ? 'within_band'),
    count(*) FILTER (WHERE NOT (candidate->'accepted_band_codes' ? 'within_band'))
  INTO v_within, v_non_within
  FROM jsonb_array_elements(v_mission->'mpj_items'->4->'candidates') candidate;
  IF v_within <> 2 OR v_non_within <> 2 THEN
    RAISE EXCEPTION 'Current MultiJudge requires two within and two adjustment-needed candidates';
  END IF;

  IF NEW.mission_status = 'generated' THEN
    IF v_authoring->>'stage' NOT IN ('ai_draft','ai_repaired','professor_revised')
       OR v_authoring->>'lineage_status' IS DISTINCT FROM 'pending'
       OR v_mission ? 'item_lineage' THEN
      RAISE EXCEPTION 'Generated draft must keep lineage pending and omit item_lineage';
    END IF;
  ELSIF NEW.mission_status IN ('reviewed','released') THEN
    IF v_authoring->>'stage' IS DISTINCT FROM 'professor_finalized'
       OR v_authoring->>'lineage_status' IS DISTINCT FROM 'complete'
       OR COALESCE(v_mission->'provenance'->>'mission_content_hash', '') !~ '^[0-9a-f]{64}$'
       OR jsonb_typeof(v_mission->'hsk_lexical_audit') IS DISTINCT FROM 'object'
       OR (
         v_mission->>'direction' = 'ko_zh'
         AND NEW.speech_act::text IN ('request','refusal','thanks')
         AND jsonb_typeof(v_mission->'item_lineage') IS DISTINCT FROM 'object'
       ) THEN
      RAISE EXCEPTION 'Reviewed mission requires finalized lineage, HSK audit, and content hash';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_mission_authoring_v1() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS validate_mission_authoring_v1_trg ON public.scenarios;
CREATE TRIGGER validate_mission_authoring_v1_trg
  BEFORE INSERT OR UPDATE OF mission_content, mission_status ON public.scenarios
  FOR EACH ROW EXECUTE FUNCTION public.validate_mission_authoring_v1();

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
  v_meta jsonb := COALESCE(p_payload->'lineage_meta', '{}'::jsonb);
  v_version integer;
  v_parent uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only admins can save missions'; END IF;
  IF jsonb_typeof(v_mission) IS DISTINCT FROM 'object'
     OR jsonb_typeof(v_quality) IS DISTINCT FROM 'object'
     OR COALESCE(v_quality->>'verdict', '') NOT IN ('pass','warning','fail')
     OR COALESCE(v_quality->>'model', '') = ''
     OR COALESCE(v_quality->>'prompt_version', '') = ''
     OR COALESCE(v_quality->>'checked_at', '') = '' THEN
    RAISE EXCEPTION 'A valid quality_check is required before saving a generated draft';
  END IF;

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
  IF v_id IS NULL THEN RAISE EXCEPTION 'core not found or already promoted: %', p_scenario_id; END IF;

  SELECT id, version_no + 1 INTO v_parent, v_version
  FROM public.mission_lineage_versions
  WHERE scenario_id = p_scenario_id ORDER BY version_no DESC LIMIT 1;
  v_version := COALESCE(v_version, 1);

  INSERT INTO public.mission_lineage_versions (
    scenario_id, version_no, parent_version_id, stage,
    mission_content, item_lineage, mission_content_hash,
    realization_pack_id, realization_pack_version, coverage_status,
    rule_scope_ids, risk_scope_ids, evidence_scope_ids,
    generation_provider, generation_model, prompt_version, prompt_snapshot_hash, prompt_instance_hash,
    generation_attempt, validation_result, ai_quality_result, actor_id
  ) VALUES (
    p_scenario_id, v_version, v_parent, 'generated',
    v_mission, NULL, NULLIF(v_mission->'provenance'->>'mission_content_hash', ''),
    NULLIF(v_meta->>'realization_pack_id', ''), NULLIF(v_meta->>'realization_pack_version', ''),
    COALESCE(NULLIF(v_meta->>'coverage_status', ''), 'not_covered'),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_meta->'rule_scope_ids', '[]'::jsonb))),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_meta->'risk_scope_ids', '[]'::jsonb))),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_meta->'evidence_scope_ids', '[]'::jsonb))),
    'openai', NULLIF(v_mission->'provenance'->>'model', ''),
    NULLIF(v_mission->'provenance'->>'prompt_version', ''),
    NULLIF(v_mission->'provenance'->>'prompt_snapshot_hash', ''),
    NULLIF(v_mission->'provenance'->>'prompt_instance_hash', ''),
    NULLIF(v_mission->'provenance'->>'generation_attempt', '')::integer,
    p_payload->'validation_result', v_quality, auth.uid()
  );
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_generated_mission(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_generated_mission(uuid, jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.save_generated_mission_revision(p_scenario_id uuid, p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_row public.scenarios%ROWTYPE;
  v_old jsonb;
  v_new jsonb := p_payload->'mission_content';
  v_parent public.mission_lineage_versions%ROWTYPE;
  v_version integer;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only admins can revise missions'; END IF;
  IF jsonb_typeof(v_new) IS DISTINCT FROM 'object'
     OR jsonb_typeof(v_new->'quality_check') IS DISTINCT FROM 'object'
     OR COALESCE(v_new->'quality_check'->>'verdict', '') NOT IN ('pass','warning','fail')
     OR v_new->'authoring'->>'lineage_status' IS DISTINCT FROM 'pending'
     OR v_new ? 'item_lineage' THEN
    RAISE EXCEPTION 'A structurally valid pending draft is required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_scenario_id::text, 0));
  SELECT * INTO v_row FROM public.scenarios
  WHERE scenario_id = p_scenario_id AND mission_status = 'generated' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'generated mission not found: %', p_scenario_id; END IF;
  v_old := v_row.mission_content;

  IF v_new->>'schema_version' IS DISTINCT FROM v_old->>'schema_version'
     OR v_new->>'direction' IS DISTINCT FROM v_old->>'direction'
     OR v_new->'unit'->>'target_feature' IS DISTINCT FROM v_old->'unit'->>'target_feature'
     OR v_new->'unit'->>'target_feature_version' IS DISTINCT FROM v_old->'unit'->>'target_feature_version'
     OR v_new->'learning_goal' IS DISTINCT FROM v_old->'learning_goal'
     OR v_new->'contrast_plan' IS DISTINCT FROM v_old->'contrast_plan'
     OR v_new->'production_task'->>'mode' IS DISTINCT FROM v_old->'production_task'->>'mode'
     OR v_new->'production_task'->>'source_modality' IS DISTINCT FROM v_old->'production_task'->>'source_modality'
     OR v_new->'production_task'->'pdr' IS DISTINCT FROM v_old->'production_task'->'pdr'
     OR v_new->'production_task'->>'source_text' IS DISTINCT FROM v_old->'production_task'->>'source_text'
     OR v_new->'production_task'->'focal_segments' IS DISTINCT FROM v_old->'production_task'->'focal_segments'
     OR v_new->'provenance'->>'prompt_version' IS DISTINCT FROM v_old->'provenance'->>'prompt_version'
     OR COALESCE((v_new->'authoring'->>'repair_attempts')::integer, -1) NOT BETWEEN 0 AND 1 THEN
    RAISE EXCEPTION 'Mission revision changed a frozen core or generation contract field';
  END IF;

  UPDATE public.scenarios SET mission_content = v_new, updated_at = now()
  WHERE scenario_id = p_scenario_id RETURNING * INTO v_row;
  SELECT * INTO v_parent FROM public.mission_lineage_versions
  WHERE scenario_id = p_scenario_id ORDER BY version_no DESC LIMIT 1;
  v_version := COALESCE(v_parent.version_no, 0) + 1;
  INSERT INTO public.mission_lineage_versions (
    scenario_id, version_no, parent_version_id, stage,
    mission_content, item_lineage, mission_content_hash,
    realization_pack_id, realization_pack_version, coverage_status,
    rule_scope_ids, risk_scope_ids, evidence_scope_ids,
    generation_provider, generation_model, prompt_version, prompt_snapshot_hash, prompt_instance_hash,
    generation_attempt, validation_result, ai_quality_result, actor_id
  ) VALUES (
    p_scenario_id, v_version, v_parent.id, 'generated',
    v_new, NULL, NULLIF(v_new->'provenance'->>'mission_content_hash', ''),
    v_parent.realization_pack_id, v_parent.realization_pack_version, v_parent.coverage_status,
    v_parent.rule_scope_ids, v_parent.risk_scope_ids, v_parent.evidence_scope_ids,
    v_parent.generation_provider, v_parent.generation_model, v_parent.prompt_version,
    v_parent.prompt_snapshot_hash, v_parent.prompt_instance_hash, v_parent.generation_attempt,
    p_payload->'validation_result', v_new->'quality_check', auth.uid()
  );
  RETURN p_scenario_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_generated_mission_revision(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_generated_mission_revision(uuid, jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.finalize_reviewed_mission(p_scenario_id uuid, p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_row public.scenarios%ROWTYPE;
  v_final jsonb := p_payload->'mission_content';
  v_overrides jsonb := COALESCE(p_payload->'issue_overrides', '[]'::jsonb);
  v_parent public.mission_lineage_versions%ROWTYPE;
  v_version integer;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only admins can review missions'; END IF;
  IF jsonb_typeof(v_final) IS DISTINCT FROM 'object'
     OR jsonb_typeof(v_overrides) IS DISTINCT FROM 'array'
     OR v_final->'authoring'->>'stage' IS DISTINCT FROM 'professor_finalized'
     OR v_final->'authoring'->>'lineage_status' IS DISTINCT FROM 'complete'
     OR COALESCE(v_final->'provenance'->>'mission_content_hash', '') !~ '^[0-9a-f]{64}$'
     OR jsonb_typeof(v_final->'hsk_lexical_audit') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Finalized mission content is required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_scenario_id::text, 0));
  SELECT * INTO v_row FROM public.scenarios
  WHERE scenario_id = p_scenario_id AND mission_status = 'generated' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'mission not found or not generated: %', p_scenario_id; END IF;
  IF v_final->'quality_check' IS DISTINCT FROM v_row.mission_content->'quality_check' THEN
    RAISE EXCEPTION 'Finalization cannot replace the current critic result';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(v_final->'quality_check'->'findings', '[]'::jsonb))
      WITH ORDINALITY finding(value, ordinality)
    WHERE finding.value->>'severity' = 'fail'
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_overrides) override
        WHERE (override->>'issue_index')::integer = finding.ordinality - 1
          AND override->>'code' IS NOT DISTINCT FROM finding.value->>'code'
          AND COALESCE(override->>'where', '') IS NOT DISTINCT FROM COALESCE(finding.value->>'where', '')
          AND length(btrim(COALESCE(override->>'rationale_ko', ''))) >= 10
      )
  ) THEN
    RAISE EXCEPTION 'Every unresolved critical AI issue requires a professor override rationale';
  END IF;

  SELECT * INTO v_parent FROM public.mission_lineage_versions
  WHERE scenario_id = p_scenario_id ORDER BY version_no DESC LIMIT 1;
  IF v_parent.coverage_status = 'covered' AND jsonb_typeof(v_final->'item_lineage') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Covered mission requires finalized item lineage';
  END IF;

  v_final := jsonb_set(v_final, '{authoring,professor_issue_overrides}', v_overrides, true);
  UPDATE public.scenarios
  SET mission_content = v_final,
      mission_status = 'reviewed',
      mission_reviewed_by = auth.uid(),
      mission_reviewed_at = now(),
      updated_at = now()
  WHERE scenario_id = p_scenario_id;

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
    v_final, v_final->'item_lineage', v_final->'provenance'->>'mission_content_hash',
    v_parent.realization_pack_id, v_parent.realization_pack_version, v_parent.coverage_status,
    v_parent.rule_scope_ids, v_parent.risk_scope_ids, v_parent.evidence_scope_ids,
    v_parent.generation_provider, v_parent.generation_model, v_parent.prompt_version,
    v_parent.prompt_snapshot_hash, v_parent.prompt_instance_hash, v_parent.generation_attempt,
    v_parent.validation_result, v_final->'quality_check',
    auth.uid(), auth.uid(), now()
  );
  RETURN p_scenario_id;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_reviewed_mission(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_reviewed_mission(uuid, jsonb) TO authenticated, service_role;
