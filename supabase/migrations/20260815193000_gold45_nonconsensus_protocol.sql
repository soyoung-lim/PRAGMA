-- PRAGMA moat v2.1: final nine-act Gold is exactly 45 (nine acts x five).
-- The initial external sample remains two per act (18), leaving three frozen
-- reserves per act. Final reviewer nonconsensus is a separate append-only
-- terminal event; it cannot be converted into approval by a research-lead
-- override or an automated vote.

ALTER TABLE public.pragma_gold_external_sampling_plans
  DROP CONSTRAINT pragma_gold_external_sampling_plans_protocol_version_check;
ALTER TABLE public.pragma_gold_external_sampling_plans
  ALTER COLUMN protocol_version SET DEFAULT 'seeded_stratified_18_gold45_nonconsensus_v2';
ALTER TABLE public.pragma_gold_external_sampling_plans
  ADD CONSTRAINT pragma_gold_external_sampling_plans_protocol_version_check
  CHECK (protocol_version IN (
    'seeded_stratified_18_escalate_all_reserve_v1',
    'seeded_stratified_18_gold45_nonconsensus_v2'
  ));

CREATE TABLE public.pragma_gold_nonconsensus_terminals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_version text NOT NULL DEFAULT 'pragma_gold_nonconsensus_terminal_v1'
    CHECK (schema_version = 'pragma_gold_nonconsensus_terminal_v1'),
  sampling_plan_id uuid NOT NULL
    REFERENCES public.pragma_gold_external_sampling_plans(id) ON DELETE RESTRICT,
  calibration_resolution_id uuid NOT NULL
    REFERENCES public.pragma_gold_calibration_resolutions(id) ON DELETE RESTRICT,
  review_round integer NOT NULL CHECK (review_round > 0),
  review_ids uuid[] NOT NULL CHECK (cardinality(review_ids) = 2),
  speech_act text NOT NULL CHECK (speech_act IN (
    'request','refusal','apology','thanks','proposal',
    'agreement','opposition','compliment','complaint'
  )),
  terminal_status text NOT NULL DEFAULT 'nonconsensus_excluded'
    CHECK (terminal_status = 'nonconsensus_excluded'),
  terminal_action text NOT NULL DEFAULT 'exclude_case_open_all_reserves_and_hold_release'
    CHECK (terminal_action = 'exclude_case_open_all_reserves_and_hold_release'),
  rationale_ko text NOT NULL CHECK (length(btrim(rationale_ko)) > 0),
  recorded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (calibration_resolution_id, review_round)
);

CREATE TRIGGER pragma_gold_nonconsensus_terminals_append_only
  BEFORE UPDATE OR DELETE ON public.pragma_gold_nonconsensus_terminals
  FOR EACH ROW EXECUTE FUNCTION public.reject_pragma_pack_manifest_attestation_mutation();
ALTER TABLE public.pragma_gold_nonconsensus_terminals ENABLE ROW LEVEL SECURITY;
CREATE POLICY pragma_gold_nonconsensus_terminals_admin_read
  ON public.pragma_gold_nonconsensus_terminals FOR SELECT TO authenticated
  USING (public.is_admin());
GRANT SELECT ON public.pragma_gold_nonconsensus_terminals TO authenticated, service_role;
GRANT ALL ON public.pragma_gold_nonconsensus_terminals TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.pragma_gold_nonconsensus_terminals FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.record_gold_nonconsensus_terminal(
  p_calibration_resolution_id uuid,
  p_review_round integer,
  p_review_ids uuid[],
  p_rationale_ko text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_calibration public.pragma_gold_calibration_resolutions%ROWTYPE;
  v_plan public.pragma_gold_external_sampling_plans%ROWTYPE;
  v_selection jsonb;
  v_review_count integer;
  v_reviewer_count integer;
  v_context_variants integer;
  v_candidate_variants integer;
  v_verdict_variants integer;
  v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only the research lead can record terminal Gold nonconsensus';
  END IF;
  IF cardinality(p_review_ids) <> 2 OR cardinality(p_review_ids) <> (
    SELECT count(DISTINCT review_id) FROM unnest(p_review_ids) review_id
  ) THEN
    RAISE EXCEPTION 'Terminal nonconsensus requires exactly two distinct review ids';
  END IF;

  SELECT * INTO v_calibration
  FROM public.pragma_gold_calibration_resolutions
  WHERE id = p_calibration_resolution_id
    AND resolution_status = 'researcher_approved';
  IF NOT FOUND THEN RAISE EXCEPTION 'Researcher-approved Gold case not found'; END IF;

  SELECT * INTO v_plan
  FROM public.pragma_gold_external_sampling_plans
  WHERE realization_pack_id = v_calibration.resolved_case_snapshot->>'realization_pack_id'
    AND realization_pack_version = v_calibration.resolved_case_snapshot->>'realization_pack_version';
  IF NOT FOUND OR v_plan.protocol_version <> 'seeded_stratified_18_gold45_nonconsensus_v2' THEN
    RAISE EXCEPTION 'Terminal nonconsensus requires the preregistered Gold45 v2 plan';
  END IF;

  SELECT item INTO v_selection
  FROM jsonb_array_elements(v_plan.selection_snapshot) item
  WHERE item->>'calibration_resolution_id' = p_calibration_resolution_id::text;
  IF v_selection IS NULL THEN RAISE EXCEPTION 'Case is outside the frozen external sample'; END IF;

  SELECT count(*), count(DISTINCT reviewer_user_id),
    count(DISTINCT context_assessment::text),
    count(DISTINCT candidate_assessments::text),
    count(DISTINCT overall_verdict)
  INTO v_review_count, v_reviewer_count, v_context_variants,
    v_candidate_variants, v_verdict_variants
  FROM public.pragma_gold_expert_reviews
  WHERE id = ANY(p_review_ids)
    AND calibration_resolution_id = p_calibration_resolution_id
    AND review_round = p_review_round;
  IF v_review_count <> 2 OR v_reviewer_count <> 2 THEN
    RAISE EXCEPTION 'Terminal nonconsensus requires two same-round independent reviews';
  END IF;
  IF v_context_variants = 1 AND v_candidate_variants = 1 AND v_verdict_variants = 1 THEN
    RAISE EXCEPTION 'Identical expert judgments cannot be recorded as nonconsensus';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.pragma_gold_expert_resolutions resolution
    WHERE resolution.calibration_resolution_id = p_calibration_resolution_id
      AND resolution.review_round = p_review_round
      AND resolution.final_status = 'expert_approved'
  ) THEN
    RAISE EXCEPTION 'An expert-approved resolution already exists for this round';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.pragma_gold_regression_runs run
    WHERE run.external_sampling_plan_id = v_plan.id
  ) THEN
    RAISE EXCEPTION 'The external protocol is frozen after its system gate is recorded';
  END IF;

  INSERT INTO public.pragma_gold_nonconsensus_terminals (
    sampling_plan_id, calibration_resolution_id, review_round,
    review_ids, speech_act, rationale_ko, recorded_by
  ) VALUES (
    v_plan.id, p_calibration_resolution_id, p_review_round,
    p_review_ids, v_selection->>'speech_act', p_rationale_ko, auth.uid()
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.record_gold_nonconsensus_terminal(uuid, integer, uuid[], text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_gold_nonconsensus_terminal(uuid, integer, uuid[], text)
  TO authenticated, service_role;

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
  v_max_per_act integer;
  v_population_hash text;
  v_seed text;
  v_selection jsonb;
  v_initial uuid[];
  v_reserve uuid[];
  v_id uuid;
  v_existing_protocol text;
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

  SELECT id, protocol_version INTO v_id, v_existing_protocol
  FROM public.pragma_gold_external_sampling_plans
  WHERE realization_pack_id = p_pack_id AND realization_pack_version = v_pack_version;
  IF v_id IS NOT NULL THEN
    IF v_existing_protocol = 'seeded_stratified_18_gold45_nonconsensus_v2' THEN RETURN v_id; END IF;
    RAISE EXCEPTION 'The current pack has a legacy sampling plan; publish a new pack version for the preregistered Gold45 protocol';
  END IF;

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

  SELECT min(case_count), max(case_count) INTO v_min_per_act, v_max_per_act
  FROM (
    SELECT act.speech_act, count(candidate.snapshot_item) AS case_count
    FROM unnest(v_known) act(speech_act)
    LEFT JOIN LATERAL (
      SELECT element.value::jsonb AS snapshot_item
      FROM jsonb_array_elements(COALESCE(v_population, '[]'::jsonb)) AS element(value)
      WHERE element.value::jsonb->>'speech_act' = act.speech_act
    ) candidate ON true
    GROUP BY act.speech_act
  ) coverage;
  IF v_population_count <> 45 OR COALESCE(v_min_per_act, 0) <> 5
     OR COALESCE(v_max_per_act, 0) <> 5 THEN
    RAISE EXCEPTION 'Gold45 sampling requires exactly 45 current cases and exactly five per speech act';
  END IF;

  v_population_hash := encode(extensions.digest(
    convert_to(v_population::text, 'UTF8'), 'sha256'::text
  ), 'hex');
  v_seed := encode(extensions.digest(convert_to(
    p_pack_id || ':' || v_pack_version || ':' || v_population_hash ||
    ':seeded_stratified_18_gold45_nonconsensus_v2', 'UTF8'
  ), 'sha256'::text), 'hex');

  WITH population AS (
    SELECT element.value::jsonb AS snapshot_item
    FROM jsonb_array_elements(v_population) AS element(value)
  ), ranked AS (
    SELECT population.snapshot_item,
      row_number() OVER (
        PARTITION BY population.snapshot_item::jsonb->>'speech_act'
        ORDER BY encode(extensions.digest(convert_to(
          v_seed || ':' || (population.snapshot_item::jsonb->>'calibration_resolution_id'), 'UTF8'
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
    array_agg((ranked.snapshot_item::jsonb->>'calibration_resolution_id')::uuid
      ORDER BY array_position(v_known, ranked.snapshot_item::jsonb->>'speech_act'), ranked.rank_in_act)
      FILTER (WHERE ranked.rank_in_act > 2)
  INTO v_selection, v_initial, v_reserve
  FROM ranked;

  INSERT INTO public.pragma_gold_external_sampling_plans (
    protocol_version, realization_pack_id, realization_pack_version,
    population_snapshot, population_snapshot_hash, sampling_seed,
    selection_snapshot, initial_resolution_ids, reserve_resolution_ids,
    escalation_rule, created_by
  ) VALUES (
    'seeded_stratified_18_gold45_nonconsensus_v2', p_pack_id, v_pack_version,
    v_population, v_population_hash, v_seed,
    v_selection, v_initial, v_reserve,
    jsonb_build_object(
      'registered_before_final_generation', true,
      'population', 'nine_speech_acts_five_cases_each',
      'initial_sample', 'two_seeded_cases_per_speech_act',
      'reserve_cases_per_speech_act', 3,
      'trigger_case_count', 1,
      'trigger', 'any_initial_reviewer_non_approve_or_latest_resolution_not_expert_approved_or_terminal_nonconsensus',
      'action', 'review_all_three_frozen_reserve_cases_for_flagged_speech_act',
      'terminal_nonconsensus', 'exclude_case_open_all_reserves_and_hold_release',
      'researcher_override_allowed', false,
      'automated_majority_vote_allowed', false,
      'second_failure', 'hold_speech_act_and_atomic_final_corpus_release',
      'performance_statistics_allowed', false,
      'pass_conclusion_ko', '사전 고정된 층화표본의 독립 확인에서 공개를 막을 이상이나 최종 불합의가 발견되지 않았다.'
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
  v_terminal text[] := '{}';
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

  SELECT COALESCE(array_agg(DISTINCT terminal.speech_act), '{}'::text[])
  INTO v_terminal
  FROM public.pragma_gold_nonconsensus_terminals terminal
  WHERE terminal.sampling_plan_id = v_plan.id;

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
  ), raised AS (
    SELECT initial.speech_act
    FROM initial_cases initial
    LEFT JOIN latest_resolution latest ON latest.calibration_resolution_id = initial.calibration_id
    WHERE EXISTS (
        SELECT 1 FROM public.pragma_gold_expert_reviews review
        WHERE review.calibration_resolution_id = initial.calibration_id
          AND review.overall_verdict <> 'approve'
      ) OR (latest.calibration_resolution_id IS NOT NULL AND (
        latest.final_status <> 'expert_approved'
        OR latest.resolution_method NOT IN ('unanimous','consensus_after_discussion')
      ))
    UNION SELECT unnest(v_terminal)
  )
  SELECT COALESCE(array_agg(DISTINCT speech_act), '{}'::text[])
  INTO v_flagged FROM raised;

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
    SELECT DISTINCT ON (resolution.calibration_resolution_id) resolution.*
    FROM public.pragma_gold_expert_resolutions resolution
    JOIN required ON required.calibration_id = resolution.calibration_resolution_id
    ORDER BY resolution.calibration_resolution_id,
      resolution.review_round DESC, resolution.resolution_revision DESC
  ), state AS (
    SELECT latest_round.*,
      resolution.id AS resolution_id, resolution.final_status, resolution.resolution_method,
      (SELECT count(DISTINCT assignment.reviewer_user_id)
       FROM public.pragma_gold_expert_review_assignments assignment
       WHERE assignment.calibration_resolution_id = latest_round.calibration_id
         AND assignment.sampling_plan_id = v_plan.id
         AND assignment.review_round = latest_round.review_round) AS assignment_count,
      (SELECT count(DISTINCT review.reviewer_user_id)
       FROM public.pragma_gold_expert_reviews review
       WHERE review.calibration_resolution_id = latest_round.calibration_id
         AND review.review_round = latest_round.review_round) AS review_count,
      (SELECT count(*) FROM public.pragma_gold_expert_reviews review
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
      WHERE review_round IS NOT NULL AND assignment_count = 2 AND review_count = 2
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

  SELECT COALESCE(array_agg(DISTINCT act), '{}'::text[]) INTO v_blocking
  FROM unnest(v_blocking || v_terminal) act;
  v_pass := v_plan.protocol_version = 'seeded_stratified_18_gold45_nonconsensus_v2'
    AND jsonb_array_length(v_plan.population_snapshot) = 45
    AND v_required_count >= 18
    AND v_complete_count = v_required_count
    AND cardinality(v_blocking) = 0;
  v_status := CASE
    WHEN v_pass THEN 'pass'
    WHEN cardinality(v_blocking) > 0 THEN 'blocked'
    WHEN cardinality(v_flagged) > 0 THEN 'expansion_required'
    ELSE 'pending_initial'
  END;
  v_conclusion := CASE WHEN v_pass
    THEN '사전 고정된 층화표본의 독립 확인에서 공개를 막을 이상이나 최종 불합의가 발견되지 않았다.'
    WHEN cardinality(v_terminal) > 0
    THEN '두 전문가의 최종 불합의가 기록되어 해당 사례와 현재 pack의 최종 corpus 공개를 보류한다.'
    WHEN v_status = 'blocked'
    THEN '추가 확인에서도 이상이 발견되어 해당 화행과 이를 포함한 최종 corpus 공개를 보류한다.'
    ELSE '외부 내용타당성 확인이 아직 완료되지 않았다.' END;

  RETURN jsonb_build_object(
    'schema_version', 'pragma_gold_external_validation_status_v2',
    'plan_id', v_plan.id, 'protocol_version', v_plan.protocol_version,
    'status', v_status, 'passed', v_pass,
    'population_count', jsonb_array_length(v_plan.population_snapshot),
    'required_population_count', 45, 'required_per_speech_act', 5,
    'initial_sample_count', 18, 'reserve_per_speech_act', 3,
    'required_case_count', v_required_count, 'completed_case_count', v_complete_count,
    'flagged_speech_acts', to_jsonb(v_flagged),
    'terminal_nonconsensus_speech_acts', to_jsonb(v_terminal),
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

CREATE OR REPLACE FUNCTION public.enforce_gold45_regression_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_min_per_act integer;
  v_max_per_act integer;
  v_protocol text;
BEGIN
  IF NEW.source_authority IS DISTINCT FROM 'researcher_calibration'
     OR NEW.evaluation_purpose IS DISTINCT FROM 'operational_gate_check' THEN
    RETURN NEW;
  END IF;
  IF cardinality(NEW.gold_resolution_ids) <> 45
     OR jsonb_array_length(NEW.gold_case_snapshots) <> 45 THEN
    RAISE EXCEPTION 'Final system judgment gate requires the exact frozen Gold45 population';
  END IF;
  SELECT min(case_count), max(case_count) INTO v_min_per_act, v_max_per_act
  FROM (
    SELECT act.speech_act, count(snapshot) AS case_count
    FROM unnest(ARRAY[
      'request','refusal','apology','thanks','proposal',
      'agreement','opposition','compliment','complaint'
    ]) act(speech_act)
    LEFT JOIN LATERAL (
      SELECT value AS snapshot FROM jsonb_array_elements(NEW.gold_case_snapshots)
      WHERE value->>'speech_act' = act.speech_act
    ) selected ON true
    GROUP BY act.speech_act
  ) coverage;
  IF v_min_per_act <> 5 OR v_max_per_act <> 5 THEN
    RAISE EXCEPTION 'Final system judgment gate requires exactly five cases for every speech act';
  END IF;
  SELECT protocol_version INTO v_protocol
  FROM public.pragma_gold_external_sampling_plans
  WHERE id = NEW.external_sampling_plan_id;
  IF v_protocol IS DISTINCT FROM 'seeded_stratified_18_gold45_nonconsensus_v2' THEN
    RAISE EXCEPTION 'Final system judgment gate requires the preregistered Gold45 v2 plan';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER enforce_gold45_regression_insert_trg
  BEFORE INSERT ON public.pragma_gold_regression_runs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_gold45_regression_insert();
REVOKE ALL ON FUNCTION public.enforce_gold45_regression_insert() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.enforce_gold45_generation_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.pragma_gold_external_sampling_plans%ROWTYPE;
BEGIN
  SELECT * INTO v_plan FROM public.pragma_gold_external_sampling_plans
  WHERE id = NEW.external_sampling_plan_id;
  IF NOT FOUND
     OR v_plan.protocol_version <> 'seeded_stratified_18_gold45_nonconsensus_v2'
     OR jsonb_array_length(v_plan.population_snapshot) <> 45
     OR cardinality(v_plan.initial_resolution_ids) <> 18
     OR cardinality(v_plan.reserve_resolution_ids) <> 27 THEN
    RAISE EXCEPTION 'Final-corpus generation lock requires Gold45 with 18 initial and 27 frozen reserve cases';
  END IF;
  IF COALESCE((public.get_pragma_gold_external_validation_status(v_plan.id)->>'passed')::boolean, false)
     IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Final-corpus generation lock requires cleared external validation with no terminal nonconsensus';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER enforce_gold45_generation_lock_trg
  BEFORE INSERT ON public.pragma_final_corpus_generation_locks
  FOR EACH ROW EXECUTE FUNCTION public.enforce_gold45_generation_lock();
REVOKE ALL ON FUNCTION public.enforce_gold45_generation_lock() FROM PUBLIC;

-- Keep existing audited function bodies, but close their legacy 30/3 thresholds.
DO $$
DECLARE
  v_definition text;
  v_updated text;
BEGIN
  SELECT pg_get_functiondef('public.record_gold_regression_run(uuid[],jsonb,text,text)'::regprocedure)
    INTO v_definition;
  v_updated := replace(v_definition,
    'IF v_requested < 30 OR v_requested <> (',
    'IF v_requested <> 45 OR v_requested <> (');
  v_updated := replace(v_updated,
    'System judgment gate requires at least 30 distinct researcher-confirmed Gold cases',
    'System judgment gate requires exactly 45 distinct researcher-confirmed Gold cases');
  v_updated := replace(v_updated,
    'IF v_min_per_act < 3 THEN RAISE EXCEPTION ''System gate requires at least three cases for every speech act''; END IF;',
    'IF v_min_per_act <> 5 THEN RAISE EXCEPTION ''System gate requires exactly five cases for every speech act''; END IF;');
  IF v_updated = v_definition THEN RAISE EXCEPTION 'Gold regression threshold patch did not match'; END IF;
  EXECUTE v_updated;

  SELECT pg_get_functiondef('public.get_pragma_final_corpus_generation_readiness(text)'::regprocedure)
    INTO v_definition;
  v_updated := replace(v_definition, 'cardinality(run.gold_resolution_ids) >= 30', 'cardinality(run.gold_resolution_ids) = 45');
  v_updated := replace(v_updated,
    'IF v_researcher_gold < 30 OR v_min_researcher_per_act < 3 THEN',
    'IF v_researcher_gold <> 45 OR v_min_researcher_per_act <> 5 THEN');
  v_updated := replace(v_updated, 'researcher_gold_population_30_and_three_per_act', 'researcher_gold_population_45_and_five_per_act');
  v_updated := replace(v_updated, 'researcher_gold_30_system_judgment_gate', 'researcher_gold_45_system_judgment_gate');
  v_updated := replace(v_updated, '''count'', v_researcher_gold, ''required'', 30', '''count'', v_researcher_gold, ''required'', 45');
  v_updated := replace(v_updated, '''required_per_speech_act'', 3', '''required_per_speech_act'', 5');
  IF v_updated = v_definition THEN RAISE EXCEPTION 'Final generation readiness threshold patch did not match'; END IF;
  EXECUTE v_updated;

  SELECT pg_get_functiondef('public.get_pragma_final_corpus_release_readiness(uuid)'::regprocedure)
    INTO v_definition;
  v_updated := replace(v_definition, 'cardinality(run.gold_resolution_ids) >= 30', 'cardinality(run.gold_resolution_ids) = 45');
  v_updated := replace(v_updated, '''reference_case_count'', 30', '''reference_case_count'', 45');
  IF v_updated = v_definition THEN RAISE EXCEPTION 'Final release readiness threshold patch did not match'; END IF;
  EXECUTE v_updated;
END;
$$;

COMMENT ON TABLE public.pragma_gold_nonconsensus_terminals IS
  'Preregistered terminal path when two blind Gold experts still disagree after discussion. Append-only; blocks current-pack release.';
