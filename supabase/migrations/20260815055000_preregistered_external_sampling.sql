-- PRAGMA moat v1.9: preregister the bounded external sample and keep three
-- evidence claims separate:
--   (1) researcher-confirmed Gold 30 -> automated operational gate,
--   (2) seeded nine-act external sample 18 -> content-validity confirmation,
--   (3) all 504 -> automated pass confirmation plus warning-focused researcher review.

CREATE TABLE public.pragma_gold_external_sampling_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_version text NOT NULL DEFAULT 'pragma_gold_external_sampling_plan_v1'
    CHECK (schema_version = 'pragma_gold_external_sampling_plan_v1'),
  realization_pack_id text NOT NULL,
  realization_pack_version text NOT NULL,
  protocol_version text NOT NULL DEFAULT 'seeded_stratified_18_escalate_all_reserve_v1'
    CHECK (protocol_version = 'seeded_stratified_18_escalate_all_reserve_v1'),
  population_snapshot jsonb NOT NULL CHECK (jsonb_typeof(population_snapshot) = 'array'),
  population_snapshot_hash text NOT NULL CHECK (population_snapshot_hash ~ '^[0-9a-f]{64}$'),
  sampling_seed text NOT NULL CHECK (sampling_seed ~ '^[0-9a-f]{64}$'),
  selection_snapshot jsonb NOT NULL CHECK (jsonb_typeof(selection_snapshot) = 'array'),
  initial_resolution_ids uuid[] NOT NULL CHECK (cardinality(initial_resolution_ids) = 18),
  reserve_resolution_ids uuid[] NOT NULL,
  escalation_rule jsonb NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (realization_pack_id, realization_pack_version)
);

CREATE TRIGGER pragma_gold_external_sampling_plans_append_only
  BEFORE UPDATE OR DELETE ON public.pragma_gold_external_sampling_plans
  FOR EACH ROW EXECUTE FUNCTION public.reject_pragma_pack_manifest_attestation_mutation();
ALTER TABLE public.pragma_gold_external_sampling_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY pragma_gold_external_sampling_plans_admin_read
  ON public.pragma_gold_external_sampling_plans FOR SELECT TO authenticated
  USING (public.is_admin());
GRANT SELECT ON public.pragma_gold_external_sampling_plans TO authenticated, service_role;
GRANT ALL ON public.pragma_gold_external_sampling_plans TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.pragma_gold_external_sampling_plans FROM authenticated, anon;

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
      count(item) AS case_count
    FROM unnest(v_known) act(speech_act)
    LEFT JOIN LATERAL (
      SELECT value AS item FROM jsonb_array_elements(COALESCE(v_population, '[]'::jsonb))
      WHERE value->>'speech_act' = act.speech_act
    ) selected ON true
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
    SELECT value AS item FROM jsonb_array_elements(v_population)
  ), ranked AS (
    SELECT item,
      row_number() OVER (
        PARTITION BY item->>'speech_act'
        ORDER BY encode(extensions.digest(convert_to(
          v_seed || ':' || item->>'calibration_resolution_id', 'UTF8'
        ), 'sha256'::text), 'hex')
      ) AS rank_in_act
    FROM population
  )
  SELECT jsonb_agg(item || jsonb_build_object(
      'rank_in_speech_act', rank_in_act,
      'selection_role', CASE WHEN rank_in_act <= 2 THEN 'initial' ELSE 'reserve' END
    ) ORDER BY array_position(v_known, item->>'speech_act'), rank_in_act),
    array_agg((item->>'calibration_resolution_id')::uuid
      ORDER BY array_position(v_known, item->>'speech_act'), rank_in_act)
      FILTER (WHERE rank_in_act <= 2),
    COALESCE(array_agg((item->>'calibration_resolution_id')::uuid
      ORDER BY array_position(v_known, item->>'speech_act'), rank_in_act)
      FILTER (WHERE rank_in_act > 2), '{}'::uuid[])
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

CREATE OR REPLACE FUNCTION public.get_pragma_gold_external_validation_status(p_plan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.pragma_gold_external_sampling_plans%ROWTYPE;
  v_flagged text[] := '{}';
  v_blocking text[] := '{}';
  v_required uuid[] := '{}';
  v_required_count integer := 0;
  v_complete_count integer := 0;
  v_status text;
  v_pass boolean := false;
  v_conclusion text;
BEGIN
  IF NOT public.is_admin() AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Only admins or the service role can inspect external validation status';
  END IF;
  SELECT * INTO v_plan FROM public.pragma_gold_external_sampling_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'External sampling plan not found'; END IF;

  WITH initial_cases AS (
    SELECT (item->>'calibration_resolution_id')::uuid AS calibration_id,
      item->>'speech_act' AS speech_act
    FROM jsonb_array_elements(v_plan.selection_snapshot) item
    WHERE item->>'selection_role' = 'initial'
  ), latest_resolution AS (
    SELECT DISTINCT ON (resolution.calibration_resolution_id)
      resolution.calibration_resolution_id, resolution.final_status, resolution.resolution_method
    FROM public.pragma_gold_expert_resolutions resolution
    JOIN initial_cases initial ON initial.calibration_id = resolution.calibration_resolution_id
    ORDER BY resolution.calibration_resolution_id,
      resolution.review_round DESC, resolution.resolution_revision DESC
  )
  SELECT COALESCE(array_agg(DISTINCT initial.speech_act), '{}'::text[])
  INTO v_flagged
  FROM initial_cases initial
  LEFT JOIN latest_resolution latest ON latest.calibration_resolution_id = initial.calibration_id
  WHERE EXISTS (
      SELECT 1 FROM public.pragma_gold_expert_reviews review
      WHERE review.calibration_resolution_id = initial.calibration_id
        AND review.overall_verdict <> 'approve'
    ) OR (latest.calibration_resolution_id IS NOT NULL AND (
      latest.final_status <> 'expert_approved'
      OR latest.resolution_method NOT IN ('unanimous','consensus_after_discussion')
    ));

  WITH selected AS (
    SELECT (item->>'calibration_resolution_id')::uuid AS calibration_id,
      item->>'speech_act' AS speech_act,
      item->>'selection_role' AS selection_role
    FROM jsonb_array_elements(v_plan.selection_snapshot) item
  )
  SELECT COALESCE(array_agg(calibration_id ORDER BY speech_act, calibration_id), '{}'::uuid[])
  INTO v_required
  FROM selected
  WHERE selection_role = 'initial'
     OR (selection_role = 'reserve' AND speech_act = ANY(v_flagged));
  v_required_count := cardinality(v_required);

  WITH required AS (
    SELECT selection.calibration_id, selection.speech_act, selection.selection_role
    FROM (
      SELECT (item->>'calibration_resolution_id')::uuid AS calibration_id,
        item->>'speech_act' AS speech_act,
        item->>'selection_role' AS selection_role
      FROM jsonb_array_elements(v_plan.selection_snapshot) item
    ) selection
    WHERE selection.calibration_id = ANY(v_required)
  ), latest_round AS (
    SELECT required.*,
      (SELECT max(assignment.review_round)
       FROM public.pragma_gold_expert_review_assignments assignment
       WHERE assignment.calibration_resolution_id = required.calibration_id
         AND assignment.sampling_plan_id = v_plan.id) AS review_round
    FROM required
  ), latest_resolution AS (
    SELECT DISTINCT ON (resolution.calibration_resolution_id)
      resolution.*
    FROM public.pragma_gold_expert_resolutions resolution
    JOIN required ON required.calibration_id = resolution.calibration_resolution_id
    ORDER BY resolution.calibration_resolution_id,
      resolution.review_round DESC, resolution.resolution_revision DESC
  ), state AS (
    SELECT latest_round.*,
      resolution.id AS resolution_id,
      resolution.final_status,
      resolution.resolution_method,
      (SELECT count(DISTINCT assignment.reviewer_user_id)
       FROM public.pragma_gold_expert_review_assignments assignment
       WHERE assignment.calibration_resolution_id = latest_round.calibration_id
         AND assignment.sampling_plan_id = v_plan.id
         AND assignment.review_round = latest_round.review_round) AS assignment_count,
      (SELECT count(DISTINCT review.reviewer_user_id)
       FROM public.pragma_gold_expert_reviews review
       WHERE review.calibration_resolution_id = latest_round.calibration_id
         AND review.review_round = latest_round.review_round) AS review_count,
      (SELECT count(*)
       FROM public.pragma_gold_expert_reviews review
       WHERE review.calibration_resolution_id = latest_round.calibration_id
         AND review.review_round = latest_round.review_round
         AND review.overall_verdict <> 'approve') AS non_approve_review_count,
      CASE WHEN resolution.resolution_method = 'consensus_after_discussion' THEN
        (SELECT count(DISTINCT signoff.reviewer_user_id)
         FROM public.pragma_gold_expert_resolution_signoffs signoff
         WHERE signoff.resolution_id = resolution.id AND signoff.decision = 'agree')
      ELSE 2 END AS agree_count
    FROM latest_round
    LEFT JOIN latest_resolution resolution
      ON resolution.calibration_resolution_id = latest_round.calibration_id
  )
  SELECT count(*) FILTER (
      WHERE review_round IS NOT NULL
        AND assignment_count = 2 AND review_count = 2
        AND final_status = 'expert_approved'
        AND resolution_method IN ('unanimous','consensus_after_discussion')
        AND agree_count = 2
        AND (selection_role = 'initial' OR non_approve_review_count = 0)
    ),
    COALESCE(array_agg(DISTINCT speech_act) FILTER (
      WHERE selection_role = 'reserve'
        AND review_round IS NOT NULL AND review_count = 2
        AND (non_approve_review_count > 0 OR final_status IS DISTINCT FROM 'expert_approved')
    ), '{}'::text[])
  INTO v_complete_count, v_blocking
  FROM state;

  v_pass := v_required_count >= 18
    AND v_complete_count = v_required_count
    AND cardinality(v_blocking) = 0;
  v_status := CASE
    WHEN v_pass THEN 'pass'
    WHEN cardinality(v_blocking) > 0 THEN 'blocked'
    WHEN cardinality(v_flagged) > 0 THEN 'expansion_required'
    ELSE 'pending_initial'
  END;
  v_conclusion := CASE WHEN v_pass
    THEN '사전 고정된 층화표본의 독립 확인에서 공개를 막을 이상이 발견되지 않았다.'
    WHEN v_status = 'blocked'
    THEN '추가 확인에서도 이상이 발견되어 해당 화행과 이를 포함한 최종 corpus 공개를 보류한다.'
    ELSE '외부 내용타당성 확인이 아직 완료되지 않았다.' END;

  RETURN jsonb_build_object(
    'schema_version', 'pragma_gold_external_validation_status_v1',
    'plan_id', v_plan.id,
    'status', v_status,
    'passed', v_pass,
    'population_count', jsonb_array_length(v_plan.population_snapshot),
    'initial_sample_count', 18,
    'required_case_count', v_required_count,
    'completed_case_count', v_complete_count,
    'flagged_speech_acts', to_jsonb(v_flagged),
    'blocking_speech_acts', to_jsonb(v_blocking),
    'required_calibration_resolution_ids', to_jsonb(v_required),
    'performance_statistics_allowed', false,
    'conclusion_ko', v_conclusion
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_pragma_gold_external_validation_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_pragma_gold_external_validation_status(uuid)
  TO authenticated, service_role;

ALTER TABLE public.pragma_gold_expert_review_assignments
  ADD COLUMN sampling_plan_id uuid
    REFERENCES public.pragma_gold_external_sampling_plans(id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.enforce_preregistered_gold_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resolution public.pragma_gold_calibration_resolutions%ROWTYPE;
  v_plan public.pragma_gold_external_sampling_plans%ROWTYPE;
  v_item jsonb;
  v_status jsonb;
  v_count integer;
BEGIN
  SELECT * INTO v_resolution FROM public.pragma_gold_calibration_resolutions
  WHERE id = NEW.calibration_resolution_id;
  SELECT * INTO v_plan FROM public.pragma_gold_external_sampling_plans
  WHERE realization_pack_id = v_resolution.resolved_case_snapshot->>'realization_pack_id'
    AND realization_pack_version = v_resolution.resolved_case_snapshot->>'realization_pack_version';
  IF NOT FOUND THEN RAISE EXCEPTION 'Create the seeded external sampling plan before assigning experts'; END IF;

  SELECT item INTO v_item FROM jsonb_array_elements(v_plan.selection_snapshot) item
  WHERE item->>'calibration_resolution_id' = NEW.calibration_resolution_id::text;
  IF v_item IS NULL THEN RAISE EXCEPTION 'Only preregistered sampled cases may be assigned'; END IF;
  IF v_item->>'selection_role' = 'reserve' THEN
    v_status := public.get_pragma_gold_external_validation_status(v_plan.id);
    IF NOT (v_item->>'speech_act' = ANY(ARRAY(
      SELECT jsonb_array_elements_text(v_status->'flagged_speech_acts')
    ))) THEN RAISE EXCEPTION 'Reserve cases open only after the preregistered escalation trigger'; END IF;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.pragma_gold_regression_runs run
    WHERE run.external_sampling_plan_id = v_plan.id
  ) THEN RAISE EXCEPTION 'The sampling plan is frozen after its system gate is recorded'; END IF;

  SELECT count(*) INTO v_count
  FROM public.pragma_gold_expert_review_assignments assignment
  WHERE assignment.calibration_resolution_id = NEW.calibration_resolution_id
    AND assignment.review_round = NEW.review_round;
  IF v_count >= 2 THEN RAISE EXCEPTION 'This protocol requires exactly two external reviewers per case and round'; END IF;
  NEW.sampling_plan_id := v_plan.id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER zz_enforce_preregistered_gold_assignment_trg
  BEFORE INSERT ON public.pragma_gold_expert_review_assignments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_preregistered_gold_assignment();
REVOKE ALL ON FUNCTION public.enforce_preregistered_gold_assignment() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.pragma_gold_regression_runs
  ADD COLUMN source_authority text NOT NULL DEFAULT 'legacy_expert_resolution'
    CHECK (source_authority IN ('legacy_expert_resolution','researcher_calibration')),
  ADD COLUMN external_sampling_plan_id uuid
    REFERENCES public.pragma_gold_external_sampling_plans(id) ON DELETE RESTRICT;
ALTER TABLE public.pragma_gold_regression_runs
  ALTER COLUMN source_authority SET DEFAULT 'researcher_calibration';

CREATE OR REPLACE FUNCTION public.enforce_pragma_gold_gate_boundary()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.evaluation_purpose := 'operational_gate_check';
  NEW.is_quality_measurement := false;
  NEW.interpretation_note_ko :=
    '연구 책임자가 확정한 기준답안 30건으로 품질 점검 자동화의 작동 조건만 확인합니다. 외부 전문가 18건의 내용타당성 확인과 별개이며, 전체 시스템 정확도나 일반화된 품질 측정치로 해석하거나 보고하지 않습니다.';
  NEW.report := COALESCE(NEW.report, '{}'::jsonb) || jsonb_build_object(
    'evaluation_purpose', NEW.evaluation_purpose,
    'is_quality_measurement', NEW.is_quality_measurement,
    'interpretation_note_ko', NEW.interpretation_note_ko
  );
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_pragma_gold_gate_boundary() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_gold_regression_run(
  p_gold_resolution_ids uuid[],
  p_observations jsonb,
  p_evaluator_version text,
  p_prompt_snapshot_hash text
)
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
  v_requested integer := cardinality(p_gold_resolution_ids);
  v_selected integer;
  v_pack_count integer;
  v_pack_id text;
  v_pack_version text;
  v_snapshots jsonb;
  v_min_per_act integer;
  v_plan public.pragma_gold_external_sampling_plans%ROWTYPE;
  v_external_status jsonb;
  v_current_population_count integer;
  v_expected integer;
  v_received integer;
  v_duplicate integer;
  v_unknown integer;
  v_missing integer;
  v_band_matches integer;
  v_semantic_matches integer;
  v_band_accuracy numeric;
  v_semantic_accuracy numeric;
  v_gate text;
  v_report jsonb;
  v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only admins can record the system judgment gate'; END IF;
  IF v_requested < 30 OR v_requested <> (
    SELECT count(DISTINCT resolution_id) FROM unnest(p_gold_resolution_ids) resolution_id
  ) THEN RAISE EXCEPTION 'System judgment gate requires at least 30 distinct researcher-confirmed Gold cases'; END IF;
  IF jsonb_typeof(p_observations) IS DISTINCT FROM 'array' OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_observations) observation
    WHERE jsonb_typeof(observation) <> 'object'
      OR length(btrim(COALESCE(observation->>'case_id', ''))) = 0
      OR observation->>'candidate_id' NOT IN ('A','B','C')
      OR observation->>'predicted_band_code' NOT IN (
        'too_direct','within_band','too_indirect',
        'too_blunt','over_elaborate','insufficient','excessive'
      )
      OR observation->>'predicted_semantic_fidelity' NOT IN ('pass','fail')
  ) THEN RAISE EXCEPTION 'Gold observations require case, A/B/C, band, and semantic predictions'; END IF;

  SELECT count(*), count(DISTINCT resolved_case_snapshot->>'realization_pack_id'),
    min(resolved_case_snapshot->>'realization_pack_id'),
    min(resolved_case_snapshot->>'realization_pack_version'),
    jsonb_agg(resolved_case_snapshot ORDER BY resolved_case_snapshot->>'case_id')
  INTO v_selected, v_pack_count, v_pack_id, v_pack_version, v_snapshots
  FROM public.pragma_gold_calibration_resolutions calibration
  WHERE calibration.id = ANY(p_gold_resolution_ids)
    AND calibration.resolution_status = 'researcher_approved'
    AND NOT EXISTS (
      SELECT 1 FROM public.pragma_gold_calibration_resolutions later
      WHERE later.case_id = calibration.case_id
        AND later.resolution_round > calibration.resolution_round
    );
  IF v_selected <> v_requested OR v_pack_count <> 1 OR (
    SELECT count(DISTINCT snapshot->>'realization_pack_version')
    FROM jsonb_array_elements(v_snapshots) snapshot
  ) <> 1 THEN RAISE EXCEPTION 'System gate requires current researcher-confirmed cases from one pack version'; END IF;

  SELECT * INTO v_plan FROM public.pragma_gold_external_sampling_plans
  WHERE realization_pack_id = v_pack_id AND realization_pack_version = v_pack_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'Preregistered external sampling plan is required'; END IF;
  IF v_requested <> jsonb_array_length(v_plan.population_snapshot)
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(v_plan.population_snapshot) item
       WHERE NOT ((item->>'calibration_resolution_id')::uuid = ANY(p_gold_resolution_ids))
     )
  THEN RAISE EXCEPTION 'System gate must use the entire frozen researcher Gold population, not a selected subset'; END IF;
  SELECT count(*) INTO v_current_population_count
  FROM public.pragma_gold_calibration_resolutions calibration
  WHERE calibration.resolution_status = 'researcher_approved'
    AND calibration.resolved_case_snapshot->>'realization_pack_id' = v_pack_id
    AND calibration.resolved_case_snapshot->>'realization_pack_version' = v_pack_version
    AND NOT EXISTS (
      SELECT 1 FROM public.pragma_gold_calibration_resolutions later
      WHERE later.case_id = calibration.case_id
        AND later.resolution_round > calibration.resolution_round
    );
  IF v_current_population_count <> jsonb_array_length(v_plan.population_snapshot) THEN
    RAISE EXCEPTION 'Researcher Gold population changed after sampling; create a new version before proceeding';
  END IF;

  SELECT min(case_count) INTO v_min_per_act
  FROM (
    SELECT act.speech_act, count(snapshot) AS case_count
    FROM unnest(v_known) act(speech_act)
    LEFT JOIN LATERAL (
      SELECT value AS snapshot FROM jsonb_array_elements(v_snapshots)
      WHERE value->>'speech_act' = act.speech_act
    ) selected ON true
    GROUP BY act.speech_act
  ) per_act;
  IF v_min_per_act < 3 THEN RAISE EXCEPTION 'System gate requires at least three cases for every speech act'; END IF;

  v_external_status := public.get_pragma_gold_external_validation_status(v_plan.id);
  IF COALESCE((v_external_status->>'passed')::boolean, false) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'External content-validity confirmation must pass before recording the system gate: %', v_external_status->>'status';
  END IF;

  WITH expected AS (
    SELECT snapshot->>'case_id' AS case_id,
      candidate->>'candidate_id' AS candidate_id,
      candidate->>'expected_band_code' AS expected_band,
      candidate->>'semantic_fidelity' AS expected_semantic
    FROM jsonb_array_elements(v_snapshots) snapshot,
      LATERAL jsonb_array_elements(snapshot->'candidates') candidate
  ), observed AS (
    SELECT observation->>'case_id' AS case_id,
      observation->>'candidate_id' AS candidate_id,
      observation->>'predicted_band_code' AS predicted_band,
      observation->>'predicted_semantic_fidelity' AS predicted_semantic
    FROM jsonb_array_elements(p_observations) observation
  )
  SELECT
    (SELECT count(*) FROM expected),
    (SELECT count(*) FROM observed),
    (SELECT count(*) FROM (
      SELECT case_id, candidate_id FROM observed GROUP BY case_id, candidate_id HAVING count(*) > 1
    ) duplicates),
    (SELECT count(*) FROM observed o LEFT JOIN expected e USING (case_id,candidate_id)
      WHERE e.case_id IS NULL),
    (SELECT count(*) FROM expected e LEFT JOIN observed o USING (case_id,candidate_id)
      WHERE o.case_id IS NULL),
    (SELECT count(*) FROM expected e JOIN observed o USING (case_id,candidate_id)
      WHERE e.expected_band = o.predicted_band),
    (SELECT count(*) FROM expected e JOIN observed o USING (case_id,candidate_id)
      WHERE e.expected_semantic = o.predicted_semantic)
  INTO v_expected, v_received, v_duplicate, v_unknown, v_missing,
    v_band_matches, v_semantic_matches;

  v_band_accuracy := CASE WHEN v_expected = 0 THEN 0 ELSE v_band_matches::numeric / v_expected END;
  v_semantic_accuracy := CASE WHEN v_expected = 0 THEN 0 ELSE v_semantic_matches::numeric / v_expected END;
  v_gate := CASE WHEN v_received = v_expected AND v_duplicate = 0
      AND v_unknown = 0 AND v_missing = 0
      AND v_band_accuracy >= 0.90 AND v_semantic_accuracy >= 0.95
    THEN 'pass' ELSE 'fail' END;
  v_report := jsonb_build_object(
    'mode', 'researcher_gold_operational_gate',
    'reference_case_count', v_selected,
    'minimum_per_speech_act', v_min_per_act,
    'expected_observation_count', v_expected,
    'received_observation_count', v_received,
    'duplicate_key_count', v_duplicate,
    'unknown_key_count', v_unknown,
    'missing_key_count', v_missing,
    'band_accuracy', v_band_accuracy,
    'semantic_accuracy', v_semantic_accuracy,
    'minimum_band_accuracy', 0.90,
    'minimum_semantic_accuracy', 0.95,
    'external_content_validity', jsonb_build_object(
      'plan_id', v_plan.id,
      'initial_sample_count', 18,
      'status', v_external_status->>'status',
      'performance_statistics_allowed', false,
      'conclusion_ko', v_external_status->>'conclusion_ko'
    ),
    'evaluation_purpose', 'operational_gate_check',
    'is_quality_measurement', false,
    'gate_status', v_gate
  );

  INSERT INTO public.pragma_gold_regression_runs (
    schema_version, realization_pack_id, realization_pack_version,
    gold_resolution_ids, gold_case_snapshots, observations,
    evaluator_version, prompt_snapshot_hash, report, gate_status, created_by,
    source_authority, external_sampling_plan_id
  ) VALUES (
    'pragma_gold_regression_run_v1', v_pack_id, v_pack_version,
    p_gold_resolution_ids, v_snapshots, p_observations,
    p_evaluator_version, p_prompt_snapshot_hash, v_report, v_gate, auth.uid(),
    'researcher_calibration', v_plan.id
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.record_gold_regression_run(uuid[], jsonb, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_gold_regression_run(uuid[], jsonb, text, text)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.reject_frozen_gold_external_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_calibration_id uuid;
  v_plan_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'pragma_gold_expert_resolutions' THEN
    v_calibration_id := NEW.calibration_resolution_id;
  ELSIF TG_TABLE_NAME = 'pragma_gold_expert_resolution_signoffs' THEN
    SELECT resolution.calibration_resolution_id INTO v_calibration_id
    FROM public.pragma_gold_expert_resolutions resolution WHERE resolution.id = NEW.resolution_id;
  ELSE
    RETURN NEW;
  END IF;
  SELECT assignment.sampling_plan_id INTO v_plan_id
  FROM public.pragma_gold_expert_review_assignments assignment
  WHERE assignment.calibration_resolution_id = v_calibration_id
    AND assignment.sampling_plan_id IS NOT NULL
  ORDER BY assignment.assigned_at DESC LIMIT 1;
  IF v_plan_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.pragma_gold_regression_runs run
    WHERE run.external_sampling_plan_id = v_plan_id
  ) THEN RAISE EXCEPTION 'External validation evidence is frozen after the system gate is recorded'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER zz_reject_frozen_gold_resolution_trg
  BEFORE INSERT ON public.pragma_gold_expert_resolutions
  FOR EACH ROW EXECUTE FUNCTION public.reject_frozen_gold_external_mutation();
CREATE TRIGGER zz_reject_frozen_gold_signoff_trg
  BEFORE INSERT ON public.pragma_gold_expert_resolution_signoffs
  FOR EACH ROW EXECUTE FUNCTION public.reject_frozen_gold_external_mutation();
REVOKE ALL ON FUNCTION public.reject_frozen_gold_external_mutation() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.pragma_final_corpus_researcher_item_reviews
  ADD COLUMN automated_warning boolean,
  ADD COLUMN attention_mode text
    CHECK (attention_mode IN ('automated_pass_confirmation','warning_focused_review')),
  ADD COLUMN review_started_at timestamptz,
  ADD COLUMN review_duration_seconds integer CHECK (review_duration_seconds BETWEEN 1 AND 28800);

REVOKE ALL ON FUNCTION public.record_pragma_final_corpus_researcher_item_review(uuid, text, text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.record_pragma_final_corpus_researcher_item_review(
  p_lineage_version_id uuid,
  p_verdict text,
  p_rationale_ko text,
  p_review_started_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lineage public.mission_lineage_versions%ROWTYPE;
  v_scenario public.scenarios%ROWTYPE;
  v_result public.pragma_final_corpus_mission_item_results%ROWTYPE;
  v_reviewed_id uuid;
  v_warning boolean;
  v_duration integer;
  v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only the research lead can review final-corpus items'; END IF;
  IF p_verdict NOT IN ('approve','revise','reject') THEN RAISE EXCEPTION 'Invalid researcher verdict'; END IF;
  IF length(btrim(COALESCE(p_rationale_ko, ''))) = 0 THEN RAISE EXCEPTION 'Researcher rationale is required'; END IF;
  IF p_review_started_at IS NULL OR p_review_started_at > now()
     OR p_review_started_at < now() - interval '8 hours'
  THEN RAISE EXCEPTION 'A valid review start time within the current work session is required'; END IF;
  v_duration := GREATEST(1, floor(extract(epoch FROM (now() - p_review_started_at)))::integer);

  SELECT * INTO v_lineage FROM public.mission_lineage_versions WHERE id = p_lineage_version_id;
  IF NOT FOUND OR v_lineage.stage NOT IN ('generated','reviewed') THEN
    RAISE EXCEPTION 'Researcher review requires the current generated or reviewed lineage';
  END IF;
  SELECT * INTO v_scenario FROM public.scenarios WHERE scenario_id = v_lineage.scenario_id;
  IF NOT FOUND OR v_scenario.dataset_class <> 'final_candidate'
     OR v_scenario.final_corpus_generation_run_id IS NULL
     OR v_scenario.mission_content IS DISTINCT FROM v_lineage.mission_content
  THEN RAISE EXCEPTION 'Only exact final-corpus candidates can receive this review'; END IF;

  SELECT result.* INTO v_result
  FROM public.pragma_final_corpus_mission_item_results result
  JOIN public.pragma_final_corpus_mission_item_claims claim ON claim.id = result.claim_id
  WHERE claim.scenario_id = v_scenario.scenario_id
    AND result.result = 'succeeded'
    AND result.lineage_version_id IN (v_lineage.id, v_lineage.parent_version_id)
  ORDER BY result.occurred_at DESC LIMIT 1;
  IF v_result.id IS NULL THEN RAISE EXCEPTION 'Researcher review requires a successful full-corpus automated result'; END IF;
  v_warning := lower(COALESCE(v_result.quality_verdict, '')) <> 'pass'
    OR lower(COALESCE(v_result.rule_result::text, '')) LIKE '%warning%';
  IF v_warning AND p_verdict = 'approve'
     AND p_rationale_ko = '자동 점검 통과와 핵심 내용의 이상 없음 확인'
  THEN RAISE EXCEPTION 'Warning-focused approval requires a case-specific rationale'; END IF;

  IF v_lineage.stage = 'generated' THEN
    PERFORM public.review_mission(v_scenario.scenario_id);
    SELECT id INTO v_reviewed_id FROM public.mission_lineage_versions
    WHERE scenario_id = v_scenario.scenario_id AND stage = 'reviewed'
    ORDER BY version_no DESC LIMIT 1;
  ELSE
    v_reviewed_id := v_lineage.id;
  END IF;

  INSERT INTO public.pragma_final_corpus_researcher_item_reviews (
    generation_run_id, scenario_id, lineage_version_id, verdict,
    automated_result_snapshot, rationale_ko, reviewed_by,
    automated_warning, attention_mode, review_started_at, review_duration_seconds
  ) VALUES (
    v_scenario.final_corpus_generation_run_id, v_scenario.scenario_id, v_reviewed_id, p_verdict,
    jsonb_build_object(
      'mission_item_result_id', v_result.id,
      'rule_result', v_result.rule_result,
      'quality_verdict', v_result.quality_verdict,
      'generation_attempt_count', v_result.generation_attempt_count
    ), p_rationale_ko, auth.uid(),
    v_warning,
    CASE WHEN v_warning THEN 'warning_focused_review' ELSE 'automated_pass_confirmation' END,
    p_review_started_at, v_duration
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.record_pragma_final_corpus_researcher_item_review(uuid, text, text, timestamptz)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_pragma_final_corpus_researcher_item_review(uuid, text, text, timestamptz)
  TO authenticated, service_role;

ALTER TABLE public.pragma_final_corpus_generation_locks
  ADD COLUMN external_sampling_plan_id uuid
    REFERENCES public.pragma_gold_external_sampling_plans(id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.lock_pragma_final_corpus_generation(
  p_pack_id text,
  p_rationale_ko text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_readiness jsonb;
  v_release public.pragma_realization_pack_releases%ROWTYPE;
  v_attestation public.pragma_pack_manifest_attestations%ROWTYPE;
  v_plan_id uuid;
  v_existing public.pragma_final_corpus_generation_locks%ROWTYPE;
  v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only admins can lock final-corpus generation'; END IF;
  IF length(btrim(COALESCE(p_rationale_ko, ''))) = 0 THEN
    RAISE EXCEPTION 'A research rationale is required for the final-corpus lock';
  END IF;
  v_readiness := public.get_pragma_final_corpus_generation_readiness(p_pack_id);
  IF (v_readiness->>'generation_allowed')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Final corpus cannot be locked: %', v_readiness->'missing_requirements';
  END IF;
  v_plan_id := (v_readiness#>>'{requirements,external_content_validity,plan_id}')::uuid;
  SELECT * INTO v_release FROM public.pragma_realization_pack_releases
  WHERE id = (v_readiness#>>'{requirements,attested_release,release_id}')::uuid;
  SELECT * INTO v_attestation FROM public.pragma_pack_manifest_attestations
  WHERE id = v_release.manifest_attestation_id;

  PERFORM pg_advisory_xact_lock(hashtextextended('pragma-final-corpus-lock:' || p_pack_id, 0));
  SELECT * INTO v_existing FROM public.pragma_final_corpus_generation_locks
  WHERE pack_release_id = v_release.id;
  IF v_existing.id IS NOT NULL THEN
    IF v_existing.external_sampling_plan_id IS DISTINCT FROM v_plan_id THEN
      RAISE EXCEPTION 'Existing generation lock predates or conflicts with the preregistered external sample';
    END IF;
    RETURN v_existing.id;
  END IF;

  INSERT INTO public.pragma_final_corpus_generation_locks (
    pack_id, pack_version, pack_release_id, manifest_attestation_id,
    artifact_hash, prompt_snapshot_hash, evidence_snapshot_hash, source_commit_ref,
    scope_speech_acts, readiness_snapshot, readiness_snapshot_hash,
    rationale_ko, locked_by, external_sampling_plan_id
  ) VALUES (
    v_release.pack_id, v_release.pack_version, v_release.id, v_attestation.id,
    v_release.artifact_hash, v_release.prompt_snapshot_hash,
    v_release.evidence_snapshot_hash, v_release.source_commit_ref,
    v_attestation.scope_speech_acts, v_readiness,
    encode(extensions.digest(convert_to(v_readiness::text, 'UTF8'), 'sha256'::text), 'hex'),
    p_rationale_ko, auth.uid(), v_plan_id
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.lock_pragma_final_corpus_generation(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lock_pragma_final_corpus_generation(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_pragma_final_corpus_generation_readiness(p_pack_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_known text[] := ARRAY[
    'request','refusal','apology','thanks','proposal',
    'agreement','opposition','compliment','complaint'
  ];
  v_release public.pragma_realization_pack_releases%ROWTYPE;
  v_attestation public.pragma_pack_manifest_attestations%ROWTYPE;
  v_researcher_gold bigint := 0;
  v_min_researcher_per_act bigint := 0;
  v_plan public.pragma_gold_external_sampling_plans%ROWTYPE;
  v_external_status jsonb := jsonb_build_object('passed', false, 'status', 'not_registered');
  v_regression_id uuid;
  v_rls_verification_id uuid;
  v_missing text[] := '{}';
BEGIN
  IF NOT public.is_admin() AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Only admins or the service role can inspect final-corpus readiness';
  END IF;
  SELECT release.* INTO v_release
  FROM public.pragma_realization_pack_releases release
  JOIN public.pragma_pack_manifest_attestations attestation
    ON attestation.id = release.manifest_attestation_id
   AND attestation.pack_id = release.pack_id
   AND attestation.pack_version = release.pack_version
   AND attestation.artifact_hash = release.artifact_hash
   AND attestation.prompt_snapshot_hash = release.prompt_snapshot_hash
   AND attestation.evidence_snapshot_hash = release.evidence_snapshot_hash
   AND attestation.source_commit_ref = release.source_commit_ref
  WHERE release.pack_id = p_pack_id
    AND NOT EXISTS (
      SELECT 1 FROM public.pragma_realization_pack_releases later
      WHERE later.supersedes_release_id = release.id
    )
  ORDER BY release.created_at DESC LIMIT 1;

  IF v_release.id IS NOT NULL THEN
    SELECT * INTO v_attestation FROM public.pragma_pack_manifest_attestations
    WHERE id = v_release.manifest_attestation_id;
    WITH current_cases AS (
      SELECT DISTINCT calibration.case_id,
        calibration.resolved_case_snapshot->>'speech_act' AS speech_act
      FROM public.pragma_gold_calibration_resolutions calibration
      WHERE calibration.resolution_status = 'researcher_approved'
        AND calibration.resolved_case_snapshot->>'realization_pack_id' = p_pack_id
        AND calibration.resolved_case_snapshot->>'realization_pack_version' = v_release.pack_version
        AND NOT EXISTS (
          SELECT 1 FROM public.pragma_gold_calibration_resolutions later
          WHERE later.case_id = calibration.case_id
            AND later.resolution_round > calibration.resolution_round
        )
    ), per_act AS (
      SELECT act.speech_act, count(current_cases.case_id) AS case_count
      FROM unnest(v_known) act(speech_act)
      LEFT JOIN current_cases ON current_cases.speech_act = act.speech_act
      GROUP BY act.speech_act
    )
    SELECT COALESCE(sum(case_count), 0), COALESCE(min(case_count), 0)
      INTO v_researcher_gold, v_min_researcher_per_act FROM per_act;

    SELECT * INTO v_plan FROM public.pragma_gold_external_sampling_plans
    WHERE realization_pack_id = p_pack_id AND realization_pack_version = v_release.pack_version;
    IF v_plan.id IS NOT NULL THEN
      v_external_status := public.get_pragma_gold_external_validation_status(v_plan.id);
    END IF;

    SELECT run.id INTO v_regression_id
    FROM public.pragma_gold_regression_runs run
    WHERE run.realization_pack_id = p_pack_id
      AND run.realization_pack_version = v_release.pack_version
      AND run.gate_status = 'pass'
      AND run.evaluation_purpose = 'operational_gate_check'
      AND run.is_quality_measurement = false
      AND run.source_authority = 'researcher_calibration'
      AND run.external_sampling_plan_id = v_plan.id
      AND cardinality(run.gold_resolution_ids) >= 30
      AND run.report->>'mode' = 'researcher_gold_operational_gate'
    ORDER BY run.created_at DESC LIMIT 1;

    SELECT verification.id INTO v_rls_verification_id
    FROM public.pragma_operational_verifications verification
    WHERE verification.verification_type = 'live_rls_role_smoke'
      AND verification.contract_version = 'pragma_live_rls_role_smoke_v1'
      AND verification.status = 'pass'
      AND verification.source_commit_ref = v_release.source_commit_ref
      AND verification.verified_at >= v_release.created_at
    ORDER BY verification.verified_at DESC LIMIT 1;
  END IF;

  IF v_release.id IS NULL THEN v_missing := array_append(v_missing, 'current_ci_attested_pack_release');
  ELSIF v_attestation.scope_speech_acts IS DISTINCT FROM v_known
     OR v_attestation.expansion_authorization_id IS NULL THEN
    v_missing := array_append(v_missing, 'authorized_nine_act_pack_scope');
  END IF;
  IF v_researcher_gold < 30 OR v_min_researcher_per_act < 3 THEN
    v_missing := array_append(v_missing, 'researcher_gold_population_30_and_three_per_act');
  END IF;
  IF v_plan.id IS NULL THEN v_missing := array_append(v_missing, 'seeded_external_sample_plan_before_generation');
  ELSIF COALESCE((v_external_status->>'passed')::boolean, false) IS NOT TRUE THEN
    v_missing := array_append(v_missing, 'external_content_validity_not_cleared');
  END IF;
  IF v_regression_id IS NULL THEN
    v_missing := array_append(v_missing, 'researcher_gold_30_system_judgment_gate');
  END IF;
  IF v_rls_verification_id IS NULL THEN
    v_missing := array_append(v_missing, 'live_three_role_rls_smoke_same_commit');
  END IF;

  RETURN jsonb_build_object(
    'schema_version', 'pragma_final_corpus_generation_readiness_v4',
    'evaluated_at', now(), 'pack_id', p_pack_id, 'pack_version', v_release.pack_version,
    'generation_allowed', cardinality(v_missing) = 0,
    'missing_requirements', to_jsonb(v_missing),
    'requirements', jsonb_build_object(
      'attested_release', jsonb_build_object(
        'passed', v_release.id IS NOT NULL, 'release_id', v_release.id,
        'attestation_id', v_attestation.id, 'source_commit_ref', v_release.source_commit_ref
      ),
      'nine_act_scope', jsonb_build_object(
        'passed', v_attestation.scope_speech_acts IS NOT DISTINCT FROM v_known
          AND v_attestation.expansion_authorization_id IS NOT NULL,
        'scope_speech_acts', to_jsonb(v_attestation.scope_speech_acts),
        'expansion_authorization_id', v_attestation.expansion_authorization_id
      ),
      'researcher_gold_population', jsonb_build_object(
        'passed', v_researcher_gold >= 30 AND v_min_researcher_per_act >= 3,
        'count', v_researcher_gold, 'required', 30,
        'minimum_per_speech_act', v_min_researcher_per_act, 'required_per_speech_act', 3
      ),
      'external_content_validity', jsonb_build_object(
        'passed', COALESCE((v_external_status->>'passed')::boolean, false),
        'plan_id', v_plan.id, 'initial_sample_count', 18,
        'selection_method', 'server_seeded_stratified_two_per_speech_act',
        'status', v_external_status->>'status',
        'conclusion_ko', v_external_status->>'conclusion_ko',
        'performance_statistics_allowed', false
      ),
      'system_judgment_gate', jsonb_build_object(
        'passed', v_regression_id IS NOT NULL, 'run_id', v_regression_id,
        'reference_case_count', v_researcher_gold,
        'evaluation_purpose', 'operational_gate_check', 'is_quality_measurement', false
      ),
      'live_rls_smoke', jsonb_build_object(
        'passed', v_rls_verification_id IS NOT NULL, 'verification_id', v_rls_verification_id
      )
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_pragma_final_corpus_generation_readiness(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_pragma_final_corpus_generation_readiness(text)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_pragma_final_corpus_release_readiness(p_run_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run public.pragma_final_corpus_generation_runs%ROWTYPE;
  v_lock public.pragma_final_corpus_generation_locks%ROWTYPE;
  v_closed boolean := false;
  v_current_pack boolean := false;
  v_item_count bigint := 0;
  v_item_key_count bigint := 0;
  v_core_hash_count bigint := 0;
  v_generated_count bigint := 0;
  v_researcher_approved_count bigint := 0;
  v_warning_review_count bigint := 0;
  v_regression_id uuid;
  v_external_status jsonb := jsonb_build_object('passed', false, 'status', 'not_registered');
  v_existing_release_id uuid;
  v_allowed boolean;
BEGIN
  IF NOT public.is_admin() AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Only admins or the service role can inspect final-corpus release readiness';
  END IF;
  SELECT * INTO v_run FROM public.pragma_final_corpus_generation_runs WHERE id = p_run_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Final-corpus generation run not found'; END IF;
  SELECT * INTO v_lock FROM public.pragma_final_corpus_generation_locks WHERE id = v_run.generation_lock_id;

  v_closed := EXISTS (
    SELECT 1 FROM public.pragma_final_corpus_generation_run_events event
    WHERE event.run_id = p_run_id AND event.event_type = 'closed'
  ) AND NOT EXISTS (
    SELECT 1 FROM public.pragma_final_corpus_generation_run_events event
    WHERE event.run_id = p_run_id AND event.event_type = 'aborted'
  );
  v_current_pack := NOT EXISTS (
    SELECT 1 FROM public.pragma_realization_pack_releases later
    WHERE later.supersedes_release_id = v_lock.pack_release_id
  );
  IF v_lock.external_sampling_plan_id IS NOT NULL THEN
    v_external_status := public.get_pragma_gold_external_validation_status(v_lock.external_sampling_plan_id);
  END IF;

  SELECT count(*), count(DISTINCT generation_item_key), count(DISTINCT core_snapshot_hash),
    count(*) FILTER (WHERE mission_content IS NOT NULL)
  INTO v_item_count, v_item_key_count, v_core_hash_count, v_generated_count
  FROM public.scenarios
  WHERE final_corpus_generation_run_id = p_run_id AND dataset_class = 'final_candidate';

  SELECT count(*), count(*) FILTER (WHERE review.automated_warning)
  INTO v_researcher_approved_count, v_warning_review_count
  FROM public.scenarios scenario
  JOIN public.mission_lineage_versions lineage
    ON lineage.scenario_id = scenario.scenario_id
   AND lineage.stage = 'reviewed' AND lineage.mission_content = scenario.mission_content
  JOIN public.pragma_final_corpus_researcher_item_reviews review
    ON review.lineage_version_id = lineage.id
   AND review.generation_run_id = p_run_id
   AND review.scenario_id = scenario.scenario_id
   AND review.verdict = 'approve'
   AND review.review_started_at IS NOT NULL
   AND review.review_duration_seconds IS NOT NULL
   AND review.automated_warning IS NOT NULL
   AND review.attention_mode = CASE WHEN review.automated_warning
        THEN 'warning_focused_review' ELSE 'automated_pass_confirmation' END
  WHERE scenario.final_corpus_generation_run_id = p_run_id
    AND scenario.dataset_class = 'final_candidate'
    AND scenario.mission_status = 'reviewed'
    AND NOT EXISTS (
      SELECT 1 FROM public.mission_lineage_versions later
      WHERE later.scenario_id = lineage.scenario_id AND later.version_no > lineage.version_no
    );

  SELECT run.id INTO v_regression_id
  FROM public.pragma_gold_regression_runs run
  WHERE run.realization_pack_id = v_lock.pack_id
    AND run.realization_pack_version = v_lock.pack_version
    AND run.gate_status = 'pass'
    AND run.evaluation_purpose = 'operational_gate_check'
    AND run.is_quality_measurement = false
    AND run.source_authority = 'researcher_calibration'
    AND run.external_sampling_plan_id = v_lock.external_sampling_plan_id
    AND cardinality(run.gold_resolution_ids) >= 30
    AND run.report->>'mode' = 'researcher_gold_operational_gate'
  ORDER BY run.created_at DESC LIMIT 1;

  SELECT id INTO v_existing_release_id FROM public.pragma_final_corpus_releases
  WHERE generation_run_id = p_run_id;
  v_allowed := v_closed AND v_current_pack
    AND v_item_count = v_run.target_count
    AND v_item_key_count = v_run.target_count
    AND v_core_hash_count = v_run.target_count
    AND v_generated_count = v_run.target_count
    AND v_researcher_approved_count = v_run.target_count
    AND COALESCE((v_external_status->>'passed')::boolean, false)
    AND v_regression_id IS NOT NULL AND v_existing_release_id IS NULL;

  RETURN jsonb_build_object(
    'schema_version', 'pragma_final_corpus_release_readiness_v3',
    'run_id', p_run_id, 'pack_id', v_lock.pack_id, 'pack_version', v_lock.pack_version,
    'target_count', v_run.target_count, 'release_allowed', v_allowed,
    'existing_release_id', v_existing_release_id,
    'requirements', jsonb_build_object(
      'core_run_closed', jsonb_build_object('passed', v_closed),
      'pack_lock_current', jsonb_build_object('passed', v_current_pack),
      'exact_locked_cores', jsonb_build_object(
        'passed', v_item_count = v_run.target_count
          AND v_item_key_count = v_run.target_count AND v_core_hash_count = v_run.target_count,
        'count', v_item_count
      ),
      'missions_generated', jsonb_build_object(
        'passed', v_generated_count = v_run.target_count, 'count', v_generated_count
      ),
      'automated_pass_confirmation_and_warning_review', jsonb_build_object(
        'passed', v_researcher_approved_count = v_run.target_count,
        'count', v_researcher_approved_count, 'required', v_run.target_count,
        'warning_focused_count', v_warning_review_count,
        'claim', 'all_automated_results_confirmed_and_warnings_focused_not_full_manual_precision_review'
      ),
      'system_judgment_gate', jsonb_build_object(
        'passed', v_regression_id IS NOT NULL, 'regression_id', v_regression_id,
        'reference_case_count', 30, 'is_quality_measurement', false
      ),
      'external_content_validity', jsonb_build_object(
        'passed', COALESCE((v_external_status->>'passed')::boolean, false),
        'plan_id', v_lock.external_sampling_plan_id,
        'initial_sample_count', 18, 'status', v_external_status->>'status',
        'conclusion_ko', v_external_status->>'conclusion_ko',
        'performance_statistics_allowed', false
      ),
      -- Compatibility key consumed by the existing atomic release RPC.
      'bounded_external_gold_gate', jsonb_build_object(
        'passed', v_regression_id IS NOT NULL
          AND COALESCE((v_external_status->>'passed')::boolean, false),
        'regression_id', v_regression_id,
        'external_sampling_plan_id', v_lock.external_sampling_plan_id,
        'is_quality_measurement', false
      ),
      'not_previously_released', jsonb_build_object('passed', v_existing_release_id IS NULL)
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_pragma_final_corpus_release_readiness(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_pragma_final_corpus_release_readiness(uuid)
  TO authenticated, service_role;
