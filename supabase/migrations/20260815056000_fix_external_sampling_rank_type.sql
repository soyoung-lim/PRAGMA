-- Fix the deterministic ranking CTE so plpgsql_check preserves the JSONB type
-- through every alias. The 550 migration was applied without data; this
-- follow-up keeps migration history immutable while fixing the callable RPC.

CREATE OR REPLACE FUNCTION public.create_pragma_gold_external_sampling_plan(p_pack_id text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_known text[] := ARRAY[
    'request','refusal','apology','thanks','proposal',
    'agreement','opposition','compliment','complaint'
  ];
  v_pack_version text;
  v_population jsonb;
  v_population_count integer;
  v_min_per_act integer;
  v_population_hash text;
  v_seed text;
  v_selection jsonb;
  v_initial uuid[];
  v_reserve uuid[];
  v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only the research lead can preregister the external sample';
  END IF;

  SELECT release.pack_version INTO v_pack_version
  FROM public.pragma_realization_pack_releases release
  WHERE release.pack_id = p_pack_id
    AND NOT EXISTS (
      SELECT 1 FROM public.pragma_realization_pack_releases later
      WHERE later.supersedes_release_id = release.id
    )
  ORDER BY release.created_at DESC LIMIT 1;
  IF v_pack_version IS NULL THEN RAISE EXCEPTION 'Current pack release not found'; END IF;

  SELECT id INTO v_id FROM public.pragma_gold_external_sampling_plans
  WHERE realization_pack_id = p_pack_id AND realization_pack_version = v_pack_version;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  IF EXISTS (
    SELECT 1 FROM public.pragma_final_corpus_generation_locks lock
    WHERE lock.pack_id = p_pack_id AND lock.pack_version = v_pack_version
  ) THEN
    RAISE EXCEPTION 'External sample must be preregistered before final-corpus generation is locked';
  END IF;

  WITH current_cases AS (
    SELECT calibration.id AS calibration_resolution_id,
      calibration.case_id, calibration.case_version,
      calibration.resolved_case_snapshot->>'speech_act' AS speech_act,
      encode(extensions.digest(
        convert_to(calibration.resolved_case_snapshot::text, 'UTF8'), 'sha256'::text
      ), 'hex') AS case_content_hash
    FROM public.pragma_gold_calibration_resolutions calibration
    WHERE calibration.resolution_status = 'researcher_approved'
      AND calibration.resolved_case_snapshot->>'realization_pack_id' = p_pack_id
      AND calibration.resolved_case_snapshot->>'realization_pack_version' = v_pack_version
      AND calibration.resolved_case_snapshot->>'speech_act' = ANY(v_known)
      AND NOT EXISTS (
        SELECT 1 FROM public.pragma_gold_calibration_resolutions later
        WHERE later.case_id = calibration.case_id
          AND later.resolution_round > calibration.resolution_round
      )
  )
  SELECT jsonb_agg(jsonb_build_object(
      'calibration_resolution_id', calibration_resolution_id,
      'case_id', case_id,
      'case_version', case_version,
      'speech_act', speech_act,
      'case_content_hash', case_content_hash
    ) ORDER BY array_position(v_known, speech_act), case_id),
    count(*)
  INTO v_population, v_population_count
  FROM current_cases;

  SELECT min(case_count) INTO v_min_per_act
  FROM (
    SELECT act.speech_act,
      count(candidate.snapshot_item) AS case_count
    FROM unnest(v_known) act(speech_act)
    LEFT JOIN LATERAL (
      SELECT element.value::jsonb AS snapshot_item
      FROM jsonb_array_elements(COALESCE(v_population, '[]'::jsonb)) AS element(value)
      WHERE element.value::jsonb->>'speech_act' = act.speech_act
    ) candidate ON true
    GROUP BY act.speech_act
  ) coverage;
  IF v_population_count < 30 OR COALESCE(v_min_per_act, 0) < 3 THEN
    RAISE EXCEPTION 'Sampling requires the full current researcher Gold population: at least 30 and three per speech act';
  END IF;

  v_population_hash := encode(extensions.digest(
    convert_to(v_population::text, 'UTF8'), 'sha256'::text
  ), 'hex');
  v_seed := encode(extensions.digest(convert_to(
    p_pack_id || ':' || v_pack_version || ':' || v_population_hash ||
    ':seeded_stratified_18_escalate_all_reserve_v1', 'UTF8'
  ), 'sha256'::text), 'hex');

  WITH population AS (
    SELECT element.value::jsonb AS snapshot_item
    FROM jsonb_array_elements(v_population) AS element(value)
  ), ranked AS (
    SELECT population.snapshot_item,
      row_number() OVER (
        PARTITION BY population.snapshot_item::jsonb->>'speech_act'
        ORDER BY encode(extensions.digest(convert_to(
          v_seed || ':' || population.snapshot_item::jsonb->>'calibration_resolution_id', 'UTF8'
        ), 'sha256'::text), 'hex')
      ) AS rank_in_act
    FROM population
  )
  SELECT jsonb_agg(ranked.snapshot_item::jsonb || jsonb_build_object(
      'rank_in_speech_act', ranked.rank_in_act,
      'selection_role', CASE WHEN ranked.rank_in_act <= 2 THEN 'initial' ELSE 'reserve' END
    ) ORDER BY array_position(v_known, ranked.snapshot_item::jsonb->>'speech_act'), ranked.rank_in_act),
    array_agg((ranked.snapshot_item::jsonb->>'calibration_resolution_id')::uuid
      ORDER BY array_position(v_known, ranked.snapshot_item::jsonb->>'speech_act'), ranked.rank_in_act)
      FILTER (WHERE ranked.rank_in_act <= 2),
    COALESCE(array_agg((ranked.snapshot_item::jsonb->>'calibration_resolution_id')::uuid
      ORDER BY array_position(v_known, ranked.snapshot_item::jsonb->>'speech_act'), ranked.rank_in_act)
      FILTER (WHERE ranked.rank_in_act > 2), ARRAY[]::uuid[])
  INTO v_selection, v_initial, v_reserve
  FROM ranked;

  INSERT INTO public.pragma_gold_external_sampling_plans (
    realization_pack_id, realization_pack_version,
    population_snapshot, population_snapshot_hash, sampling_seed,
    selection_snapshot, initial_resolution_ids, reserve_resolution_ids,
    escalation_rule, created_by
  ) VALUES (
    p_pack_id, v_pack_version,
    v_population, v_population_hash, v_seed,
    v_selection, v_initial, v_reserve,
    jsonb_build_object(
      'registered_before_final_generation', true,
      'initial_sample', 'two_seeded_cases_per_speech_act',
      'trigger_case_count', 1,
      'trigger', 'any_initial_reviewer_non_approve_or_latest_resolution_not_expert_approved',
      'action', 'review_all_frozen_reserve_cases_for_flagged_speech_act',
      'second_failure', 'hold_speech_act_and_atomic_final_corpus_release',
      'performance_statistics_allowed', false,
      'pass_conclusion_ko', '사전 고정된 층화표본의 독립 확인에서 공개를 막을 이상이 발견되지 않았다.'
    ), auth.uid()
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_pragma_gold_external_sampling_plan(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_pragma_gold_external_sampling_plan(text)
  TO authenticated, service_role;
