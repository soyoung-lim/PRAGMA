-- 운영 교수자 검수에서 generated 미션을 승인할 수 없을 때의 최소 재작업 경로.
-- 기존 생성물과 lineage는 삭제하지 않고 superseded 이력을 append한 뒤,
-- 동일 코어를 새 scenario 행으로 복제한다. 새 행만 다시 유료 조립한다.

CREATE OR REPLACE FUNCTION public.supersede_generated_mission_for_rework(p_scenario_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_source public.scenarios%ROWTYPE;
  v_parent public.mission_lineage_versions%ROWTYPE;
  v_new_id uuid := gen_random_uuid();
  v_suffix text := replace(v_new_id::text, '-', '');
  v_version integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can supersede generated missions';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_scenario_id::text, 0));

  SELECT * INTO v_source
  FROM public.scenarios
  WHERE scenario_id = p_scenario_id
    AND content_format = 'scenario_core_v1'
    AND mission_status = 'generated'
    AND dataset_class = 'test_only'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'rework requires a generated operational mission: %', p_scenario_id;
  END IF;

  SELECT * INTO v_parent
  FROM public.mission_lineage_versions
  WHERE scenario_id = p_scenario_id
  ORDER BY version_no DESC
  LIMIT 1;

  IF NOT FOUND OR v_parent.stage <> 'generated' THEN
    RAISE EXCEPTION 'generated lineage not found for rework: %', p_scenario_id;
  END IF;

  v_version := v_parent.version_no + 1;
  INSERT INTO public.mission_lineage_versions (
    scenario_id, version_no, parent_version_id, stage,
    mission_content, item_lineage, mission_content_hash,
    realization_pack_id, realization_pack_version, coverage_status,
    rule_scope_ids, risk_scope_ids, evidence_scope_ids,
    generation_provider, generation_model, prompt_version,
    prompt_snapshot_hash, prompt_instance_hash, generation_attempt,
    validation_result, ai_quality_result, actor_id
  ) VALUES (
    p_scenario_id, v_version, v_parent.id, 'superseded',
    v_parent.mission_content, v_parent.item_lineage, v_parent.mission_content_hash,
    v_parent.realization_pack_id, v_parent.realization_pack_version, v_parent.coverage_status,
    v_parent.rule_scope_ids, v_parent.risk_scope_ids, v_parent.evidence_scope_ids,
    v_parent.generation_provider, v_parent.generation_model, v_parent.prompt_version,
    v_parent.prompt_snapshot_hash, v_parent.prompt_instance_hash, v_parent.generation_attempt,
    v_parent.validation_result, v_parent.ai_quality_result, auth.uid()
  );

  -- 현재본은 반려 상태로 남긴다. mission_content는 lineage와 함께 보존한다.
  UPDATE public.scenarios
  SET review_status = 'revise_required',
      usage_assignment = 'archived_only',
      updated_at = now()
  WHERE scenario_id = p_scenario_id;

  INSERT INTO public.scenarios (
    scenario_id, review_status, usage_assignment, auto_check_result,
    speech_act, title, topic, source_text, industry_sector, business_function,
    interaction_context, genre, learner_level, created_at, updated_at,
    week_no, language_direction, mode, speech_act_text,
    scenario_p, scenario_d, scenario_r, pragmatic_challenge,
    challenge_intensity, hsk_level_min, domain,
    generation_provider, generator_model, generation_prompt_version,
    content_format, core_content, source_modality, theme_code, topic_code,
    prompt_snapshot_hash, generation_run_id, generation_item_key, content_hash,
    supersedes_scenario_id, approval_basis, release_gate_mode, dataset_class,
    core_snapshot_hash
  ) VALUES (
    v_new_id, 'needs_review', 'archived_only', v_source.auto_check_result,
    v_source.speech_act, v_source.title, v_source.topic, v_source.source_text,
    v_source.industry_sector, v_source.business_function, v_source.interaction_context,
    v_source.genre, v_source.learner_level, now(), now(),
    NULL, v_source.language_direction, v_source.mode, v_source.speech_act_text,
    v_source.scenario_p, v_source.scenario_d, v_source.scenario_r,
    v_source.pragmatic_challenge, v_source.challenge_intensity,
    v_source.hsk_level_min, v_source.domain,
    v_source.generation_provider, v_source.generator_model,
    v_source.generation_prompt_version, v_source.content_format,
    v_source.core_content, v_source.source_modality, v_source.theme_code,
    v_source.topic_code, v_source.prompt_snapshot_hash,
    COALESCE(v_source.generation_run_id, 'manual') || ':rework:' || v_suffix,
    COALESCE(v_source.generation_item_key, p_scenario_id::text) || ':rework:' || v_suffix,
    v_source.content_hash, p_scenario_id, NULL,
    'legacy_reviewed', 'test_only', v_source.core_snapshot_hash
  );

  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.supersede_generated_mission_for_rework(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supersede_generated_mission_for_rework(uuid)
  TO authenticated, service_role;

