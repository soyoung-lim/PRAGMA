-- PRAGMA moat v1.8: bound external-expert work to a nine-act stratified sample.
-- The 504-item bank is checked automatically in full and reviewed by the research
-- lead in full. External experts independently judge 18 Gold cases (2 per act),
-- never all 504 missions. These observations are operational/content-validity
-- evidence, not a population accuracy estimate.

ALTER TABLE public.pragma_gold_regression_runs
  DROP CONSTRAINT IF EXISTS pragma_gold_regression_runs_gold_resolution_ids_check;
ALTER TABLE public.pragma_gold_regression_runs
  ADD CONSTRAINT pragma_gold_regression_runs_gold_resolution_ids_check
  CHECK (cardinality(gold_resolution_ids) >= 18);
ALTER TABLE public.pragma_gold_regression_runs
  ALTER COLUMN interpretation_note_ko SET DEFAULT
    '외부 전문가가 확인한 9화행 층화표본으로 품질 점검 자동화 장치의 작동 여부를 확인하는 운영 게이트입니다. 전체 시스템의 정확도나 일반화된 품질 측정치로 해석하거나 보고하지 않습니다.';

CREATE OR REPLACE FUNCTION public.enforce_pragma_gold_gate_boundary()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.evaluation_purpose := 'operational_gate_check';
  NEW.is_quality_measurement := false;
  NEW.interpretation_note_ko :=
    '외부 전문가가 확인한 9화행 층화표본으로 품질 점검 자동화 장치의 작동 여부를 확인하는 운영 게이트입니다. 전체 시스템의 정확도나 일반화된 품질 측정치로 해석하거나 보고하지 않습니다.';
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
  v_calibrations integer;
  v_pack_count integer;
  v_pack_id text;
  v_pack_version text;
  v_snapshots jsonb;
  v_min_per_act integer;
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
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can record Gold gate runs';
  END IF;
  IF v_requested < 18 OR v_requested <> (
    SELECT count(DISTINCT resolution_id) FROM unnest(p_gold_resolution_ids) resolution_id
  ) THEN
    RAISE EXCEPTION 'bounded expert Gold gate requires at least 18 distinct resolutions';
  END IF;
  IF jsonb_typeof(p_observations) IS DISTINCT FROM 'array' OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_observations) observation
    WHERE jsonb_typeof(observation) <> 'object'
      OR length(btrim(COALESCE(observation->>'case_id', ''))) = 0
      OR observation->>'candidate_id' NOT IN ('A', 'B', 'C')
      OR observation->>'predicted_band_code' NOT IN (
        'too_direct', 'within_band', 'too_indirect',
        'too_blunt', 'over_elaborate', 'insufficient', 'excessive'
      )
      OR observation->>'predicted_semantic_fidelity' NOT IN ('pass', 'fail')
  ) THEN
    RAISE EXCEPTION 'Gold observations require case, A/B/C, band, and semantic predictions';
  END IF;

  SELECT count(*), count(DISTINCT calibration_resolution_id),
         count(DISTINCT resolved_case_snapshot->>'realization_pack_id'),
         min(resolved_case_snapshot->>'realization_pack_id'),
         min(resolved_case_snapshot->>'realization_pack_version'),
         jsonb_agg(resolved_case_snapshot ORDER BY resolved_case_snapshot->>'case_id')
    INTO v_selected, v_calibrations, v_pack_count, v_pack_id, v_pack_version, v_snapshots
  FROM public.pragma_gold_expert_resolutions resolution
  WHERE resolution.id = ANY(p_gold_resolution_ids)
    AND resolution.final_status = 'expert_approved'
    AND resolution.resolution_method IN ('unanimous', 'consensus_after_discussion')
    AND NOT EXISTS (
      SELECT 1 FROM public.pragma_gold_expert_resolutions later
      WHERE later.calibration_resolution_id = resolution.calibration_resolution_id
        AND (
          later.review_round > resolution.review_round
          OR (later.review_round = resolution.review_round
            AND later.resolution_revision > resolution.resolution_revision)
        )
    );
  IF v_selected <> v_requested OR v_calibrations <> v_requested OR v_pack_count <> 1
     OR (SELECT count(DISTINCT snapshot->>'realization_pack_version')
         FROM jsonb_array_elements(v_snapshots) snapshot) <> 1
  THEN
    RAISE EXCEPTION 'Gold gate requires authoritative expert-approved cases from one pack version';
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
  IF v_min_per_act < 2 THEN
    RAISE EXCEPTION 'external Gold sample requires at least two cases for every one of nine speech acts';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.pragma_gold_expert_resolutions resolution
    WHERE resolution.id = ANY(p_gold_resolution_ids)
      AND resolution.resolution_method = 'consensus_after_discussion'
      AND (
        EXISTS (
          SELECT 1 FROM public.pragma_gold_expert_resolution_signoffs signoff
          WHERE signoff.resolution_id = resolution.id AND signoff.decision = 'disagree'
        )
        OR (SELECT count(DISTINCT review.reviewer_user_id)
            FROM public.pragma_gold_expert_reviews review
            WHERE review.id = ANY(resolution.review_ids))
           <> (SELECT count(DISTINCT signoff.reviewer_user_id)
               FROM public.pragma_gold_expert_resolution_signoffs signoff
               WHERE signoff.resolution_id = resolution.id AND signoff.decision = 'agree')
      )
  ) THEN
    RAISE EXCEPTION 'discussion Gold resolutions require every included expert to sign agree';
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
    (SELECT count(*) FROM observed o LEFT JOIN expected e USING (case_id, candidate_id)
      WHERE e.case_id IS NULL),
    (SELECT count(*) FROM expected e LEFT JOIN observed o USING (case_id, candidate_id)
      WHERE o.case_id IS NULL),
    (SELECT count(*) FROM expected e JOIN observed o USING (case_id, candidate_id)
      WHERE e.expected_band = o.predicted_band),
    (SELECT count(*) FROM expected e JOIN observed o USING (case_id, candidate_id)
      WHERE e.expected_semantic = o.predicted_semantic)
  INTO v_expected, v_received, v_duplicate, v_unknown, v_missing,
       v_band_matches, v_semantic_matches;

  v_band_accuracy := CASE WHEN v_expected = 0 THEN 0 ELSE v_band_matches::numeric / v_expected END;
  v_semantic_accuracy := CASE WHEN v_expected = 0 THEN 0 ELSE v_semantic_matches::numeric / v_expected END;
  v_gate := CASE WHEN v_received = v_expected AND v_duplicate = 0 AND v_unknown = 0 AND v_missing = 0
      AND v_band_accuracy >= 0.90 AND v_semantic_accuracy >= 0.95
    THEN 'pass' ELSE 'fail' END;
  v_report := jsonb_build_object(
    'mode', 'bounded_expert_operational_gate',
    'case_count', v_selected,
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
    'evaluation_purpose', 'operational_gate_check',
    'is_quality_measurement', false,
    'interpretation_note_ko',
      '외부 전문가가 확인한 9화행 층화표본으로 장치 작동 여부만 확인합니다. 전체 시스템 정확도나 일반화된 품질 측정치가 아닙니다.',
    'gate_status', v_gate
  );

  INSERT INTO public.pragma_gold_regression_runs (
    schema_version, realization_pack_id, realization_pack_version,
    gold_resolution_ids, gold_case_snapshots, observations,
    evaluator_version, prompt_snapshot_hash, report, gate_status, created_by
  ) VALUES (
    'pragma_gold_regression_run_v1', v_pack_id, v_pack_version,
    p_gold_resolution_ids, v_snapshots, p_observations,
    p_evaluator_version, p_prompt_snapshot_hash, v_report, v_gate, auth.uid()
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.record_gold_regression_run(uuid[], jsonb, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_gold_regression_run(uuid[], jsonb, text, text)
  TO authenticated, service_role;

CREATE TABLE public.pragma_final_corpus_researcher_item_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_version text NOT NULL DEFAULT 'pragma_final_corpus_researcher_item_review_v1'
    CHECK (schema_version = 'pragma_final_corpus_researcher_item_review_v1'),
  generation_run_id uuid NOT NULL
    REFERENCES public.pragma_final_corpus_generation_runs(id) ON DELETE RESTRICT,
  scenario_id uuid NOT NULL REFERENCES public.scenarios(scenario_id) ON DELETE RESTRICT,
  lineage_version_id uuid NOT NULL UNIQUE
    REFERENCES public.mission_lineage_versions(id) ON DELETE RESTRICT,
  verdict text NOT NULL CHECK (verdict IN ('approve','revise','reject')),
  automated_result_snapshot jsonb NOT NULL,
  rationale_ko text NOT NULL CHECK (length(btrim(rationale_ko)) > 0),
  reviewed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (generation_run_id, scenario_id, lineage_version_id)
);
CREATE INDEX pragma_final_corpus_researcher_item_reviews_run_idx
  ON public.pragma_final_corpus_researcher_item_reviews(generation_run_id, verdict, reviewed_at);
CREATE TRIGGER pragma_final_corpus_researcher_item_reviews_append_only
  BEFORE UPDATE OR DELETE ON public.pragma_final_corpus_researcher_item_reviews
  FOR EACH ROW EXECUTE FUNCTION public.reject_pragma_pack_manifest_attestation_mutation();
ALTER TABLE public.pragma_final_corpus_researcher_item_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY pragma_final_corpus_researcher_item_reviews_admin_read
  ON public.pragma_final_corpus_researcher_item_reviews FOR SELECT TO authenticated
  USING (public.is_admin());
GRANT SELECT ON public.pragma_final_corpus_researcher_item_reviews TO authenticated, service_role;
GRANT ALL ON public.pragma_final_corpus_researcher_item_reviews TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.pragma_final_corpus_researcher_item_reviews FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.record_pragma_final_corpus_researcher_item_review(
  p_lineage_version_id uuid,
  p_verdict text,
  p_rationale_ko text
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
  v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only the research lead can review final-corpus items'; END IF;
  IF p_verdict NOT IN ('approve','revise','reject') THEN RAISE EXCEPTION 'Invalid researcher verdict'; END IF;
  IF length(btrim(COALESCE(p_rationale_ko, ''))) = 0 THEN RAISE EXCEPTION 'Researcher rationale is required'; END IF;
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
    automated_result_snapshot, rationale_ko, reviewed_by
  ) VALUES (
    v_scenario.final_corpus_generation_run_id, v_scenario.scenario_id, v_reviewed_id, p_verdict,
    jsonb_build_object(
      'mission_item_result_id', v_result.id,
      'rule_result', v_result.rule_result,
      'quality_verdict', v_result.quality_verdict,
      'generation_attempt_count', v_result.generation_attempt_count
    ), p_rationale_ko, auth.uid()
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.record_pragma_final_corpus_researcher_item_review(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_pragma_final_corpus_researcher_item_review(uuid, text, text)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.reject_final_corpus_external_mission_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.mission_lineage_versions lineage
    JOIN public.scenarios scenario ON scenario.scenario_id = lineage.scenario_id
    WHERE lineage.id = NEW.lineage_version_id
      AND scenario.dataset_class IN ('final_candidate','final_release')
  ) THEN
    RAISE EXCEPTION 'External experts validate the bounded Gold sample, not all 504 final missions';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER reject_final_corpus_external_mission_assignment_trg
  BEFORE INSERT ON public.mission_expert_review_assignments
  FOR EACH ROW EXECUTE FUNCTION public.reject_final_corpus_external_mission_assignment();
REVOKE ALL ON FUNCTION public.reject_final_corpus_external_mission_assignment() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.mission_lineage_versions
  ADD COLUMN researcher_item_review_id uuid
    REFERENCES public.pragma_final_corpus_researcher_item_reviews(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX mission_lineage_one_researcher_item_review_idx
  ON public.mission_lineage_versions(researcher_item_review_id)
  WHERE researcher_item_review_id IS NOT NULL;
ALTER TABLE public.mission_lineage_versions
  DROP CONSTRAINT mission_lineage_release_evidence_ck;
ALTER TABLE public.mission_lineage_versions
  ADD CONSTRAINT mission_lineage_release_evidence_ck CHECK (
    (stage = 'released'
      AND num_nonnulls(release_resolution_id, researcher_item_review_id) = 1
      AND gold_regression_run_id IS NOT NULL
      AND released_by IS NOT NULL AND released_at IS NOT NULL)
    OR
    (stage <> 'released'
      AND release_resolution_id IS NULL AND researcher_item_review_id IS NULL
      AND gold_regression_run_id IS NULL
      AND released_by IS NULL AND released_at IS NULL)
  );

CREATE OR REPLACE FUNCTION public.validate_released_mission_lineage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent public.mission_lineage_versions%ROWTYPE;
  v_resolution public.mission_review_resolutions%ROWTYPE;
  v_researcher_review public.pragma_final_corpus_researcher_item_reviews%ROWTYPE;
  v_regression public.pragma_gold_regression_runs%ROWTYPE;
  v_reviewers integer;
  v_agree integer;
BEGIN
  IF NEW.stage <> 'released' THEN RETURN NEW; END IF;
  SELECT * INTO v_parent FROM public.mission_lineage_versions WHERE id = NEW.parent_version_id;
  SELECT * INTO v_regression FROM public.pragma_gold_regression_runs WHERE id = NEW.gold_regression_run_id;
  IF v_parent.id IS NULL OR v_parent.stage <> 'reviewed' OR v_parent.coverage_status <> 'covered'
     OR v_parent.item_lineage IS NULL
     OR NEW.scenario_id IS DISTINCT FROM v_parent.scenario_id
     OR NEW.version_no IS DISTINCT FROM v_parent.version_no + 1
     OR NEW.mission_content IS DISTINCT FROM v_parent.mission_content
     OR NEW.mission_content_hash IS DISTINCT FROM v_parent.mission_content_hash
     OR v_regression.gate_status <> 'pass'
     OR v_regression.evaluation_purpose <> 'operational_gate_check'
     OR v_regression.is_quality_measurement IS DISTINCT FROM false
     OR v_regression.realization_pack_id IS DISTINCT FROM v_parent.realization_pack_id
     OR v_regression.realization_pack_version IS DISTINCT FROM v_parent.realization_pack_version
  THEN
    RAISE EXCEPTION 'released mission requires exact reviewed lineage and a matching operational Gold gate';
  END IF;

  IF NEW.researcher_item_review_id IS NOT NULL THEN
    SELECT * INTO v_researcher_review
    FROM public.pragma_final_corpus_researcher_item_reviews
    WHERE id = NEW.researcher_item_review_id;
    IF v_researcher_review.id IS NULL
       OR v_researcher_review.lineage_version_id IS DISTINCT FROM v_parent.id
       OR v_researcher_review.scenario_id IS DISTINCT FROM v_parent.scenario_id
       OR v_researcher_review.verdict <> 'approve'
       OR NOT EXISTS (
         SELECT 1 FROM public.scenarios scenario
         WHERE scenario.scenario_id = v_parent.scenario_id
           AND scenario.final_corpus_generation_run_id = v_researcher_review.generation_run_id
           AND scenario.dataset_class = 'final_candidate'
       )
    THEN RAISE EXCEPTION 'final-corpus release requires the exact approved researcher item review'; END IF;
    RETURN NEW;
  END IF;

  SELECT * INTO v_resolution FROM public.mission_review_resolutions WHERE id = NEW.release_resolution_id;
  IF v_resolution.id IS NULL
     OR v_resolution.lineage_version_id IS DISTINCT FROM v_parent.id
     OR v_resolution.final_verdict <> 'approve'
     OR v_resolution.resolution_status NOT IN ('unanimous', 'consensus_after_discussion')
  THEN
    RAISE EXCEPTION 'non-corpus release requires the matching external-expert resolution';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.mission_review_resolutions later
    WHERE later.lineage_version_id = v_parent.id
      AND later.review_round = v_resolution.review_round
      AND later.resolution_revision > v_resolution.resolution_revision
  ) OR v_resolution.review_round IS DISTINCT FROM (
    SELECT max(review_round) FROM public.mission_expert_review_assignments
    WHERE lineage_version_id = v_parent.id
  ) THEN
    RAISE EXCEPTION 'mission release resolution must be the authoritative latest expert round';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_each(v_resolution.resolved_candidate_bands) band
    WHERE band.value->>'band_code' = 'uncertain'
  ) OR EXISTS (
    SELECT 1 FROM jsonb_each(v_resolution.resolved_lineage_claims) claim
    WHERE claim.value->>'verdict' <> 'supported'
      OR COALESCE(claim.value->'final_rule_ids', '[]'::jsonb)
         || COALESCE(claim.value->'final_risk_ids', '[]'::jsonb) = '[]'::jsonb
  ) THEN
    RAISE EXCEPTION 'released mission cannot contain uncertain, revised, rejected, or unattributed claims';
  END IF;
  IF v_resolution.resolution_status = 'consensus_after_discussion' THEN
    SELECT count(DISTINCT review.reviewer_user_id) INTO v_reviewers
    FROM public.mission_expert_reviews review WHERE review.id = ANY(v_resolution.review_ids);
    SELECT count(DISTINCT signoff.reviewer_user_id) INTO v_agree
    FROM public.mission_review_resolution_signoffs signoff
    WHERE signoff.resolution_id = v_resolution.id AND signoff.decision = 'agree';
    IF v_reviewers <> v_agree OR EXISTS (
      SELECT 1 FROM public.mission_review_resolution_signoffs signoff
      WHERE signoff.resolution_id = v_resolution.id AND signoff.decision = 'disagree'
    ) THEN
      RAISE EXCEPTION 'discussion mission resolution requires every included expert to sign agree';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_released_mission_lineage() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.pragma_final_corpus_release_items
  ALTER COLUMN release_resolution_id DROP NOT NULL,
  ADD COLUMN researcher_item_review_id uuid
    REFERENCES public.pragma_final_corpus_researcher_item_reviews(id) ON DELETE RESTRICT;
ALTER TABLE public.pragma_final_corpus_release_items
  ADD CONSTRAINT pragma_final_corpus_release_item_authority_ck
  CHECK (num_nonnulls(release_resolution_id, researcher_item_review_id) = 1);
CREATE UNIQUE INDEX pragma_final_corpus_release_items_researcher_review_idx
  ON public.pragma_final_corpus_release_items(researcher_item_review_id)
  WHERE researcher_item_review_id IS NOT NULL;

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
  v_regression_id uuid;
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

  SELECT count(*), count(DISTINCT generation_item_key), count(DISTINCT core_snapshot_hash),
         count(*) FILTER (WHERE mission_content IS NOT NULL)
    INTO v_item_count, v_item_key_count, v_core_hash_count, v_generated_count
  FROM public.scenarios
  WHERE final_corpus_generation_run_id = p_run_id
    AND dataset_class = 'final_candidate';

  SELECT count(*) INTO v_researcher_approved_count
  FROM public.scenarios scenario
  JOIN public.mission_lineage_versions lineage
    ON lineage.scenario_id = scenario.scenario_id
   AND lineage.stage = 'reviewed'
   AND lineage.mission_content = scenario.mission_content
  JOIN public.pragma_final_corpus_researcher_item_reviews review
    ON review.lineage_version_id = lineage.id
   AND review.generation_run_id = p_run_id
   AND review.scenario_id = scenario.scenario_id
   AND review.verdict = 'approve'
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
    AND cardinality(run.gold_resolution_ids) >= 18
    AND (
      SELECT min(case_count) FROM (
        SELECT act.speech_act, count(snapshot) AS case_count
        FROM unnest(ARRAY[
          'request','refusal','apology','thanks','proposal',
          'agreement','opposition','compliment','complaint'
        ]) act(speech_act)
        LEFT JOIN LATERAL (
          SELECT value AS snapshot FROM jsonb_array_elements(run.gold_case_snapshots)
          WHERE value->>'speech_act' = act.speech_act
        ) selected ON true
        GROUP BY act.speech_act
      ) per_act
    ) >= 2
  ORDER BY run.created_at DESC LIMIT 1;

  SELECT id INTO v_existing_release_id
  FROM public.pragma_final_corpus_releases WHERE generation_run_id = p_run_id;
  v_allowed := v_closed AND v_current_pack
    AND v_item_count = v_run.target_count
    AND v_item_key_count = v_run.target_count
    AND v_core_hash_count = v_run.target_count
    AND v_generated_count = v_run.target_count
    AND v_researcher_approved_count = v_run.target_count
    AND v_regression_id IS NOT NULL
    AND v_existing_release_id IS NULL;

  RETURN jsonb_build_object(
    'schema_version', 'pragma_final_corpus_release_readiness_v2',
    'run_id', p_run_id,
    'pack_id', v_lock.pack_id,
    'pack_version', v_lock.pack_version,
    'target_count', v_run.target_count,
    'release_allowed', v_allowed,
    'existing_release_id', v_existing_release_id,
    'requirements', jsonb_build_object(
      'core_run_closed', jsonb_build_object('passed', v_closed),
      'pack_lock_current', jsonb_build_object('passed', v_current_pack),
      'exact_locked_cores', jsonb_build_object(
        'passed', v_item_count = v_run.target_count
          AND v_item_key_count = v_run.target_count
          AND v_core_hash_count = v_run.target_count,
        'count', v_item_count
      ),
      'missions_generated', jsonb_build_object(
        'passed', v_generated_count = v_run.target_count, 'count', v_generated_count
      ),
      'automated_and_researcher_full_review', jsonb_build_object(
        'passed', v_researcher_approved_count = v_run.target_count,
        'count', v_researcher_approved_count,
        'required', v_run.target_count
      ),
      'bounded_external_gold_gate', jsonb_build_object(
        'passed', v_regression_id IS NOT NULL,
        'regression_id', v_regression_id,
        'sample_size', 18,
        'minimum_per_speech_act', 2,
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

CREATE OR REPLACE FUNCTION public.release_pragma_final_corpus(
  p_run_id uuid,
  p_rationale_ko text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run public.pragma_final_corpus_generation_runs%ROWTYPE;
  v_lock public.pragma_final_corpus_generation_locks%ROWTYPE;
  v_readiness jsonb;
  v_regression_id uuid;
  v_manifest jsonb;
  v_manifest_hash text;
  v_release_id uuid;
  v_inserted integer;
  v_updated integer;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only the teaching/research lead can release the final corpus'; END IF;
  IF length(btrim(COALESCE(p_rationale_ko, ''))) = 0 THEN
    RAISE EXCEPTION 'Final-corpus release rationale is required';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('pragma-final-corpus-release:' || p_run_id::text, 0));
  SELECT * INTO v_run FROM public.pragma_final_corpus_generation_runs WHERE id = p_run_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Final-corpus generation run not found'; END IF;
  SELECT * INTO v_lock FROM public.pragma_final_corpus_generation_locks WHERE id = v_run.generation_lock_id;
  v_readiness := public.get_pragma_final_corpus_release_readiness(p_run_id);
  IF COALESCE((v_readiness->>'release_allowed')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'All 504 automated checks and researcher item approvals are required before release';
  END IF;
  v_regression_id := (v_readiness#>>'{requirements,bounded_external_gold_gate,regression_id}')::uuid;

  INSERT INTO public.mission_lineage_versions (
    scenario_id, version_no, parent_version_id, stage,
    mission_content, item_lineage, mission_content_hash,
    realization_pack_id, realization_pack_version, coverage_status,
    rule_scope_ids, risk_scope_ids, evidence_scope_ids,
    generation_provider, generation_model, prompt_version,
    prompt_snapshot_hash, prompt_instance_hash, generation_attempt,
    validation_result, ai_quality_result, actor_id, reviewed_by, reviewed_at,
    researcher_item_review_id, gold_regression_run_id, released_by, released_at
  )
  SELECT parent.scenario_id, parent.version_no + 1, parent.id, 'released',
    parent.mission_content, parent.item_lineage, parent.mission_content_hash,
    parent.realization_pack_id, parent.realization_pack_version, parent.coverage_status,
    parent.rule_scope_ids, parent.risk_scope_ids, parent.evidence_scope_ids,
    parent.generation_provider, parent.generation_model, parent.prompt_version,
    parent.prompt_snapshot_hash, parent.prompt_instance_hash, parent.generation_attempt,
    parent.validation_result, parent.ai_quality_result, auth.uid(), parent.reviewed_by, parent.reviewed_at,
    review.id, v_regression_id, auth.uid(), now()
  FROM public.scenarios scenario
  JOIN public.mission_lineage_versions parent
    ON parent.scenario_id = scenario.scenario_id
   AND parent.stage = 'reviewed'
   AND parent.mission_content = scenario.mission_content
  JOIN public.pragma_final_corpus_researcher_item_reviews review
    ON review.lineage_version_id = parent.id
   AND review.generation_run_id = p_run_id
   AND review.verdict = 'approve'
  WHERE scenario.final_corpus_generation_run_id = p_run_id
    AND scenario.dataset_class = 'final_candidate'
    AND scenario.mission_status = 'reviewed'
    AND NOT EXISTS (
      SELECT 1 FROM public.mission_lineage_versions later
      WHERE later.scenario_id = parent.scenario_id AND later.version_no > parent.version_no
    );
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted <> v_run.target_count THEN
    RAISE EXCEPTION 'Final release must create exactly 504 researcher-authorized lineage snapshots';
  END IF;

  UPDATE public.scenarios scenario
  SET mission_status = 'released', released_lineage_version_id = released.id
  FROM public.mission_lineage_versions released
  WHERE scenario.final_corpus_generation_run_id = p_run_id
    AND scenario.dataset_class = 'final_candidate'
    AND released.scenario_id = scenario.scenario_id
    AND released.stage = 'released'
    AND released.researcher_item_review_id IS NOT NULL;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> v_run.target_count THEN RAISE EXCEPTION 'All 504 scenario pointers must advance atomically'; END IF;

  SELECT jsonb_build_object(
    'schema_version', 'pragma_final_corpus_manifest_v2',
    'review_protocol', 'automated_full_plus_researcher_full_external_gold_18',
    'plan_version', v_run.plan_version,
    'plan_snapshot_hash', v_run.plan_snapshot_hash,
    'generation_run_id', v_run.id,
    'generation_lock_id', v_lock.id,
    'pack_release_id', v_lock.pack_release_id,
    'pack_id', v_lock.pack_id,
    'pack_version', v_lock.pack_version,
    'source_commit_ref', v_lock.source_commit_ref,
    'item_count', v_run.target_count,
    'items', jsonb_agg(jsonb_build_object(
      'ordinal', (plan_item->>'ordinal')::integer,
      'item_key', scenario.generation_item_key,
      'scenario_id', scenario.scenario_id,
      'core_snapshot_hash', scenario.core_snapshot_hash,
      'released_lineage_version_id', lineage.id,
      'mission_content_hash', lineage.mission_content_hash,
      'mission_prompt_snapshot_hash', lineage.prompt_snapshot_hash,
      'researcher_item_review_id', lineage.researcher_item_review_id,
      'gold_regression_run_id', lineage.gold_regression_run_id
    ) ORDER BY (plan_item->>'ordinal')::integer)
  ) INTO v_manifest
  FROM jsonb_array_elements(v_run.plan_snapshot->'items') plan_item
  JOIN public.scenarios scenario
    ON scenario.final_corpus_generation_run_id = v_run.id
   AND scenario.generation_item_key = plan_item->>'item_key'
  JOIN public.mission_lineage_versions lineage ON lineage.id = scenario.released_lineage_version_id;

  IF jsonb_array_length(v_manifest->'items') <> v_run.target_count THEN
    RAISE EXCEPTION 'Final-corpus manifest is incomplete';
  END IF;
  v_manifest_hash := encode(extensions.digest(convert_to(v_manifest::text, 'UTF8'), 'sha256'::text), 'hex');
  INSERT INTO public.pragma_final_corpus_releases (
    generation_run_id, generation_lock_id, pack_release_id, item_count,
    manifest_snapshot, manifest_snapshot_hash, rationale_ko, released_by
  ) VALUES (
    v_run.id, v_lock.id, v_lock.pack_release_id, v_run.target_count,
    v_manifest, v_manifest_hash, p_rationale_ko, auth.uid()
  ) RETURNING id INTO v_release_id;

  INSERT INTO public.pragma_final_corpus_release_items (
    release_id, ordinal, scenario_id, generation_item_key, core_snapshot_hash,
    released_lineage_version_id, mission_content_hash, mission_prompt_snapshot_hash,
    release_resolution_id, researcher_item_review_id, gold_regression_run_id
  )
  SELECT v_release_id, (plan_item->>'ordinal')::integer, scenario.scenario_id,
         scenario.generation_item_key, scenario.core_snapshot_hash,
         lineage.id, lineage.mission_content_hash, lineage.prompt_snapshot_hash,
         NULL, lineage.researcher_item_review_id, lineage.gold_regression_run_id
  FROM jsonb_array_elements(v_run.plan_snapshot->'items') plan_item
  JOIN public.scenarios scenario
    ON scenario.final_corpus_generation_run_id = v_run.id
   AND scenario.generation_item_key = plan_item->>'item_key'
  JOIN public.mission_lineage_versions lineage ON lineage.id = scenario.released_lineage_version_id
  ORDER BY (plan_item->>'ordinal')::integer;

  UPDATE public.scenarios
  SET dataset_class = 'final_release', final_corpus_release_id = v_release_id
  WHERE final_corpus_generation_run_id = p_run_id AND dataset_class = 'final_candidate';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> v_run.target_count THEN
    RAISE EXCEPTION 'Final-corpus release must atomically promote all 504 scenarios';
  END IF;
  RETURN v_release_id;
END;
$$;
REVOKE ALL ON FUNCTION public.release_pragma_final_corpus(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.release_pragma_final_corpus(uuid, text)
  TO authenticated, service_role;

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
  v_expert_gold bigint := 0;
  v_min_expert_per_act bigint := 0;
  v_regression_id uuid;
  v_min_regression_per_act bigint := 0;
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

    WITH current_cases AS (
      SELECT DISTINCT calibration.case_id,
        expert.resolved_case_snapshot->>'speech_act' AS speech_act
      FROM public.pragma_gold_expert_resolutions expert
      JOIN public.pragma_gold_calibration_resolutions calibration
        ON calibration.id = expert.calibration_resolution_id
      WHERE expert.final_status = 'expert_approved'
        AND expert.resolved_case_snapshot->>'realization_pack_id' = p_pack_id
        AND expert.resolved_case_snapshot->>'realization_pack_version' = v_release.pack_version
        AND NOT EXISTS (
          SELECT 1 FROM public.pragma_gold_expert_resolutions later
          WHERE later.calibration_resolution_id = expert.calibration_resolution_id
            AND (later.review_round > expert.review_round OR
              (later.review_round = expert.review_round
                AND later.resolution_revision > expert.resolution_revision))
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.pragma_gold_calibration_resolutions later_calibration
          WHERE later_calibration.case_id = calibration.case_id
            AND later_calibration.resolution_round > calibration.resolution_round
        )
    ), per_act AS (
      SELECT act.speech_act, count(current_cases.case_id) AS case_count
      FROM unnest(v_known) act(speech_act)
      LEFT JOIN current_cases ON current_cases.speech_act = act.speech_act
      GROUP BY act.speech_act
    )
    SELECT COALESCE(sum(case_count), 0), COALESCE(min(case_count), 0)
      INTO v_expert_gold, v_min_expert_per_act FROM per_act;

    SELECT run.id, coverage.minimum_per_speech_act
      INTO v_regression_id, v_min_regression_per_act
    FROM public.pragma_gold_regression_runs run
    CROSS JOIN LATERAL (
      SELECT COALESCE(min(per_act.case_count), 0) AS minimum_per_speech_act
      FROM (
        SELECT act.speech_act,
          (SELECT count(DISTINCT snapshot->>'case_id')
           FROM jsonb_array_elements(run.gold_case_snapshots) snapshot
           WHERE snapshot->>'speech_act' = act.speech_act) AS case_count
        FROM unnest(v_known) act(speech_act)
      ) per_act
    ) coverage
    WHERE run.realization_pack_id = p_pack_id
      AND run.realization_pack_version = v_release.pack_version
      AND run.gate_status = 'pass'
      AND run.evaluation_purpose = 'operational_gate_check'
      AND run.is_quality_measurement = false
      AND cardinality(run.gold_resolution_ids) >= 18
      AND coverage.minimum_per_speech_act >= 2
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

  IF v_release.id IS NULL THEN
    v_missing := array_append(v_missing, 'current_ci_attested_pack_release');
  ELSIF v_attestation.scope_speech_acts IS DISTINCT FROM v_known
     OR v_attestation.expansion_authorization_id IS NULL THEN
    v_missing := array_append(v_missing, 'authorized_nine_act_pack_scope');
  END IF;
  IF v_researcher_gold < 30 OR v_min_researcher_per_act < 3 THEN
    v_missing := array_append(v_missing, 'researcher_gold_30_and_three_per_act_current_pack');
  END IF;
  IF v_expert_gold < 18 OR v_min_expert_per_act < 2 THEN
    v_missing := array_append(v_missing, 'bounded_expert_gold_18_and_two_per_act_current_pack');
  END IF;
  IF v_regression_id IS NULL OR v_min_regression_per_act < 2 THEN
    v_missing := array_append(v_missing, 'passing_bounded_gold_gate_two_per_act_current_pack');
  END IF;
  IF v_rls_verification_id IS NULL THEN
    v_missing := array_append(v_missing, 'live_three_role_rls_smoke_same_commit');
  END IF;

  RETURN jsonb_build_object(
    'schema_version', 'pragma_final_corpus_generation_readiness_v3',
    'evaluated_at', now(),
    'pack_id', p_pack_id,
    'pack_version', v_release.pack_version,
    'generation_allowed', cardinality(v_missing) = 0,
    'missing_requirements', to_jsonb(v_missing),
    'requirements', jsonb_build_object(
      'attested_release', jsonb_build_object(
        'passed', v_release.id IS NOT NULL,
        'release_id', v_release.id,
        'attestation_id', v_attestation.id,
        'source_commit_ref', v_release.source_commit_ref
      ),
      'nine_act_scope', jsonb_build_object(
        'passed', v_attestation.scope_speech_acts IS NOT DISTINCT FROM v_known
          AND v_attestation.expansion_authorization_id IS NOT NULL,
        'scope_speech_acts', to_jsonb(v_attestation.scope_speech_acts),
        'expansion_authorization_id', v_attestation.expansion_authorization_id
      ),
      'researcher_gold', jsonb_build_object(
        'passed', v_researcher_gold >= 30 AND v_min_researcher_per_act >= 3,
        'count', v_researcher_gold, 'required', 30,
        'minimum_per_speech_act', v_min_researcher_per_act, 'required_per_speech_act', 3
      ),
      'expert_gold', jsonb_build_object(
        'passed', v_expert_gold >= 18 AND v_min_expert_per_act >= 2,
        'count', v_expert_gold, 'required', 18,
        'minimum_per_speech_act', v_min_expert_per_act, 'required_per_speech_act', 2,
        'target_minutes_per_reviewer', jsonb_build_array(45, 60)
      ),
      'gold_regression', jsonb_build_object(
        'passed', v_regression_id IS NOT NULL AND v_min_regression_per_act >= 2,
        'run_id', v_regression_id,
        'evaluation_purpose', 'operational_gate_check',
        'is_quality_measurement', false,
        'minimum_per_speech_act', v_min_regression_per_act, 'required_per_speech_act', 2
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

CREATE OR REPLACE FUNCTION public.get_pragma_moat_expansion_readiness(
  p_pack_id text DEFAULT 'pragma_ko_zh_request_refusal_thanks_v1'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_release public.pragma_realization_pack_releases%ROWTYPE;
  v_researcher_gold bigint := 0;
  v_request_released bigint := 0;
  v_refusal_released bigint := 0;
  v_thanks_released bigint := 0;
  v_request_participants bigint := 0;
  v_refusal_participants bigint := 0;
  v_thanks_participants bigint := 0;
  v_first_completion timestamptz;
  v_latest_completion timestamptz;
  v_refresh_id uuid;
  v_rls_verification_id uuid;
  v_missing text[] := '{}';
BEGIN
  IF NOT public.is_admin() AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Only admins or the service role can inspect moat expansion readiness';
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
    SELECT count(DISTINCT resolution.case_id) INTO v_researcher_gold
    FROM public.pragma_gold_calibration_resolutions resolution
    WHERE resolution.resolution_status = 'researcher_approved'
      AND resolution.resolved_case_snapshot->>'realization_pack_id' = p_pack_id
      AND resolution.resolved_case_snapshot->>'realization_pack_version' = v_release.pack_version
      AND NOT EXISTS (
        SELECT 1 FROM public.pragma_gold_calibration_resolutions later
        WHERE later.case_id = resolution.case_id
          AND later.resolution_round > resolution.resolution_round
      );

    SELECT
      count(DISTINCT lineage.scenario_id) FILTER (WHERE scenario.speech_act = 'request'::public.speech_act),
      count(DISTINCT lineage.scenario_id) FILTER (WHERE scenario.speech_act = 'refusal'::public.speech_act),
      count(DISTINCT lineage.scenario_id) FILTER (WHERE scenario.speech_act = 'thanks'::public.speech_act)
      INTO v_request_released, v_refusal_released, v_thanks_released
    FROM public.mission_lineage_versions lineage
    JOIN public.scenarios scenario ON scenario.scenario_id = lineage.scenario_id
    WHERE lineage.stage = 'reviewed'
      AND lineage.coverage_status = 'covered'
      AND lineage.realization_pack_id = p_pack_id
      AND lineage.realization_pack_version = v_release.pack_version
      AND scenario.mission_status = 'reviewed'
      AND scenario.mission_content = lineage.mission_content
      AND scenario.language_direction = 'ko_zh';

    SELECT verification.id INTO v_rls_verification_id
    FROM public.pragma_operational_verifications verification
    WHERE verification.verification_type = 'live_rls_role_smoke'
      AND verification.contract_version = 'pragma_live_rls_role_smoke_v1'
      AND verification.status = 'pass'
      AND verification.source_commit_ref = v_release.source_commit_ref
      AND verification.verified_at >= v_release.created_at
    ORDER BY verification.verified_at DESC LIMIT 1;
  END IF;

  IF v_release.id IS NULL THEN v_missing := array_append(v_missing, 'ci_attested_pack_release'); END IF;
  IF v_researcher_gold < 30 THEN v_missing := array_append(v_missing, 'researcher_approved_gold_30'); END IF;
  IF v_request_released < 1 OR v_refusal_released < 1 OR v_thanks_released < 1 THEN
    v_missing := array_append(v_missing, 'researcher_reviewed_vertical_slice_all_three_acts');
  END IF;
  IF v_rls_verification_id IS NULL THEN v_missing := array_append(v_missing, 'live_three_role_rls_smoke'); END IF;

  RETURN jsonb_build_object(
    'schema_version', 'pragma_moat_expansion_readiness_v2',
    'evaluated_at', now(), 'pack_id', p_pack_id, 'pack_version', v_release.pack_version,
    'expansion_allowed', cardinality(v_missing) = 0,
    'missing_requirements', to_jsonb(v_missing),
    'requirements', jsonb_build_object(
      'attested_pack_release', jsonb_build_object('passed', v_release.id IS NOT NULL, 'release_id', v_release.id),
      'researcher_gold', jsonb_build_object('passed', v_researcher_gold >= 30, 'count', v_researcher_gold, 'required', 30),
      'expert_gold', jsonb_build_object(
        'passed', true, 'required', 0,
        'deferred_to_final_nine_act_pack', true,
        'note_ko', '외부 전문가는 9화행 확정 후 화행별 2개, 총 18개를 한 번만 확인합니다.'
      ),
      'gold_regression', jsonb_build_object(
        'passed', true, 'deferred_to_final_nine_act_pack', true,
        'is_quality_measurement', false
      ),
      'released_vertical_slice', jsonb_build_object(
        'passed', v_request_released >= 1 AND v_refusal_released >= 1 AND v_thanks_released >= 1,
        'stage', 'researcher_reviewed_test_only',
        'counts', jsonb_build_object('request', v_request_released, 'refusal', v_refusal_released, 'thanks', v_thanks_released)
      ),
      'consented_completion_sample', jsonb_build_object(
        'passed', true, 'deferred_to_post_release', true,
        'note_ko', '학습자 표본은 정식 9화행 자료 공개 후 개선 순환 근거로 수집합니다.'
      ),
      'flywheel_refresh', jsonb_build_object('passed', true, 'deferred_to_post_release', true),
      'live_rls_smoke', jsonb_build_object('passed', v_rls_verification_id IS NOT NULL, 'verification_id', v_rls_verification_id)
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_pragma_moat_expansion_readiness(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_pragma_moat_expansion_readiness(text)
  TO authenticated, service_role;
