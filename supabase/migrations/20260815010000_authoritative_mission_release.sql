-- PRAGMA moat v1.5: expert-approved Gold regression and authoritative mission release.
-- `reviewed` now means internal review / eligible for expert assignment. Covered missions
-- become learner-runnable only after a released lineage snapshot is appended by the RPC.
-- Existing not-covered missions keep the legacy reviewed behavior.

CREATE TABLE public.pragma_gold_regression_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_version text NOT NULL CHECK (schema_version = 'pragma_gold_regression_run_v1'),
  realization_pack_id text NOT NULL,
  realization_pack_version text NOT NULL,
  gold_resolution_ids uuid[] NOT NULL CHECK (cardinality(gold_resolution_ids) >= 30),
  gold_case_snapshots jsonb NOT NULL,
  observations jsonb NOT NULL,
  evaluator_version text NOT NULL CHECK (length(btrim(evaluator_version)) > 0),
  prompt_snapshot_hash text NOT NULL CHECK (length(btrim(prompt_snapshot_hash)) > 0),
  report jsonb NOT NULL,
  gate_status text NOT NULL CHECK (gate_status IN ('pass', 'fail')),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX pragma_gold_regression_runs_pack_idx
  ON public.pragma_gold_regression_runs(realization_pack_id, realization_pack_version, created_at DESC);

GRANT SELECT ON public.pragma_gold_regression_runs TO authenticated;
GRANT ALL ON public.pragma_gold_regression_runs TO service_role;
ALTER TABLE public.pragma_gold_regression_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY gold_regression_admin_read
  ON public.pragma_gold_regression_runs FOR SELECT TO authenticated
  USING (public.is_admin());

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
  v_requested integer := cardinality(p_gold_resolution_ids);
  v_selected integer;
  v_calibrations integer;
  v_pack_count integer;
  v_pack_id text;
  v_pack_version text;
  v_snapshots jsonb;
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
    RAISE EXCEPTION 'Only admins can record Gold regression runs';
  END IF;
  IF v_requested < 30 OR v_requested <> (
    SELECT count(DISTINCT resolution_id) FROM unnest(p_gold_resolution_ids) resolution_id
  ) THEN
    RAISE EXCEPTION 'expert release regression requires at least 30 distinct Gold resolutions';
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
    RAISE EXCEPTION 'Gold regression observations require case, A/B/C, band, and semantic predictions';
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
    RAISE EXCEPTION 'Gold regression requires authoritative expert-approved cases from one pack version';
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
    'mode', 'expert_release_gate',
    'case_count', v_selected,
    'expected_observation_count', v_expected,
    'received_observation_count', v_received,
    'duplicate_key_count', v_duplicate,
    'unknown_key_count', v_unknown,
    'missing_key_count', v_missing,
    'band_accuracy', v_band_accuracy,
    'semantic_accuracy', v_semantic_accuracy,
    'minimum_band_accuracy', 0.90,
    'minimum_semantic_accuracy', 0.95,
    'require_complete_coverage', true,
    'require_semantic_labels', true,
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

REVOKE INSERT, UPDATE, DELETE ON public.pragma_gold_regression_runs FROM authenticated, anon;
REVOKE ALL ON FUNCTION public.record_gold_regression_run(uuid[], jsonb, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_gold_regression_run(uuid[], jsonb, text, text)
  TO authenticated, service_role;

ALTER TABLE public.scenarios
  ADD COLUMN release_gate_mode text NOT NULL DEFAULT 'legacy_reviewed'
    CHECK (release_gate_mode IN ('legacy_reviewed', 'expert_v1')),
  ADD COLUMN released_lineage_version_id uuid
    REFERENCES public.mission_lineage_versions(id) ON DELETE RESTRICT;

ALTER TABLE public.mission_lineage_versions
  ADD COLUMN release_resolution_id uuid
    REFERENCES public.mission_review_resolutions(id) ON DELETE RESTRICT,
  ADD COLUMN gold_regression_run_id uuid
    REFERENCES public.pragma_gold_regression_runs(id) ON DELETE RESTRICT,
  ADD COLUMN released_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  ADD COLUMN released_at timestamptz;

CREATE UNIQUE INDEX mission_lineage_one_release_resolution_idx
  ON public.mission_lineage_versions(release_resolution_id)
  WHERE release_resolution_id IS NOT NULL;

ALTER TABLE public.mission_lineage_versions
  ADD CONSTRAINT mission_lineage_release_evidence_ck CHECK (
    (stage = 'released' AND release_resolution_id IS NOT NULL
      AND gold_regression_run_id IS NOT NULL AND released_by IS NOT NULL AND released_at IS NOT NULL)
    OR
    (stage <> 'released' AND release_resolution_id IS NULL
      AND gold_regression_run_id IS NULL AND released_by IS NULL AND released_at IS NULL)
  );

UPDATE public.scenarios scenario
SET release_gate_mode = 'expert_v1'
WHERE EXISTS (
  SELECT 1 FROM public.mission_lineage_versions lineage
  WHERE lineage.scenario_id = scenario.scenario_id AND lineage.coverage_status = 'covered'
);

ALTER TABLE public.scenarios DROP CONSTRAINT IF EXISTS scenarios_mission_ck;
ALTER TABLE public.scenarios ADD CONSTRAINT scenarios_mission_ck
  CHECK (
    (mission_content IS NULL AND mission_status IS NULL)
    OR
    (mission_content IS NOT NULL
      AND mission_status IN ('generated', 'reviewed', 'released')
      AND mission_content->>'schema_version' IN ('mission_v1','mission_v2','mission_v3','mission_v4','mission_v5')
      AND target_feature IS NOT NULL
      AND target_feature_version IS NOT NULL)
  );

CREATE OR REPLACE FUNCTION public.mark_covered_mission_release_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.coverage_status = 'covered' THEN
    UPDATE public.scenarios SET release_gate_mode = 'expert_v1'
    WHERE scenario_id = NEW.scenario_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER mark_covered_mission_release_gate_trg
  AFTER INSERT ON public.mission_lineage_versions
  FOR EACH ROW EXECUTE FUNCTION public.mark_covered_mission_release_gate();

CREATE OR REPLACE FUNCTION public.validate_released_mission_lineage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent public.mission_lineage_versions%ROWTYPE;
  v_resolution public.mission_review_resolutions%ROWTYPE;
  v_regression public.pragma_gold_regression_runs%ROWTYPE;
  v_reviewers integer;
  v_agree integer;
BEGIN
  IF NEW.stage <> 'released' THEN RETURN NEW; END IF;
  SELECT * INTO v_parent FROM public.mission_lineage_versions WHERE id = NEW.parent_version_id;
  SELECT * INTO v_resolution FROM public.mission_review_resolutions WHERE id = NEW.release_resolution_id;
  SELECT * INTO v_regression FROM public.pragma_gold_regression_runs WHERE id = NEW.gold_regression_run_id;
  IF NOT FOUND OR v_parent.stage <> 'reviewed' OR v_parent.coverage_status <> 'covered'
     OR v_parent.item_lineage IS NULL
     OR NEW.scenario_id IS DISTINCT FROM v_parent.scenario_id
     OR NEW.version_no IS DISTINCT FROM v_parent.version_no + 1
     OR NEW.mission_content IS DISTINCT FROM v_parent.mission_content
     OR NEW.mission_content_hash IS DISTINCT FROM v_parent.mission_content_hash
     OR v_resolution.lineage_version_id IS DISTINCT FROM v_parent.id
     OR v_resolution.final_verdict <> 'approve'
     OR v_resolution.resolution_status NOT IN ('unanimous', 'consensus_after_discussion')
     OR v_regression.gate_status <> 'pass'
     OR v_regression.realization_pack_id IS DISTINCT FROM v_parent.realization_pack_id
     OR v_regression.realization_pack_version IS DISTINCT FROM v_parent.realization_pack_version
  THEN
    RAISE EXCEPTION 'released mission requires matching reviewed lineage, expert approval, and passing Gold regression';
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
CREATE TRIGGER validate_released_mission_lineage_trg
  BEFORE INSERT ON public.mission_lineage_versions
  FOR EACH ROW EXECUTE FUNCTION public.validate_released_mission_lineage();

CREATE OR REPLACE FUNCTION public.release_mission(
  p_scenario_id uuid,
  p_reviewed_lineage_id uuid,
  p_resolution_id uuid,
  p_gold_regression_run_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent public.mission_lineage_versions%ROWTYPE;
  v_new_id uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only admins can release missions'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_scenario_id::text, 0));
  SELECT * INTO v_parent FROM public.mission_lineage_versions
  WHERE id = p_reviewed_lineage_id AND scenario_id = p_scenario_id;
  IF NOT FOUND OR v_parent.stage <> 'reviewed' OR v_parent.coverage_status <> 'covered' THEN
    RAISE EXCEPTION 'release requires a covered reviewed lineage';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.scenarios
    WHERE scenario_id = p_scenario_id AND mission_status = 'reviewed'
      AND release_gate_mode = 'expert_v1' AND mission_content = v_parent.mission_content
  ) THEN
    RAISE EXCEPTION 'scenario current state does not match the reviewed lineage';
  END IF;

  INSERT INTO public.mission_lineage_versions (
    scenario_id, version_no, parent_version_id, stage,
    mission_content, item_lineage, mission_content_hash,
    realization_pack_id, realization_pack_version, coverage_status,
    rule_scope_ids, risk_scope_ids, evidence_scope_ids,
    generation_provider, generation_model, prompt_version,
    prompt_snapshot_hash, prompt_instance_hash, generation_attempt,
    validation_result, ai_quality_result, actor_id, reviewed_by, reviewed_at,
    release_resolution_id, gold_regression_run_id, released_by, released_at
  ) VALUES (
    v_parent.scenario_id, v_parent.version_no + 1, v_parent.id, 'released',
    v_parent.mission_content, v_parent.item_lineage, v_parent.mission_content_hash,
    v_parent.realization_pack_id, v_parent.realization_pack_version, v_parent.coverage_status,
    v_parent.rule_scope_ids, v_parent.risk_scope_ids, v_parent.evidence_scope_ids,
    v_parent.generation_provider, v_parent.generation_model, v_parent.prompt_version,
    v_parent.prompt_snapshot_hash, v_parent.prompt_instance_hash, v_parent.generation_attempt,
    v_parent.validation_result, v_parent.ai_quality_result, auth.uid(), v_parent.reviewed_by, v_parent.reviewed_at,
    p_resolution_id, p_gold_regression_run_id, auth.uid(), now()
  ) RETURNING id INTO v_new_id;

  UPDATE public.scenarios
  SET mission_status = 'released', released_lineage_version_id = v_new_id
  WHERE scenario_id = p_scenario_id AND mission_status = 'reviewed';
  IF NOT FOUND THEN RAISE EXCEPTION 'scenario release state changed concurrently'; END IF;
  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.release_mission(uuid, uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.release_mission(uuid, uuid, uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.validate_scenario_release_pointer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.mission_status = 'released' AND NOT EXISTS (
    SELECT 1 FROM public.mission_lineage_versions lineage
    WHERE lineage.id = NEW.released_lineage_version_id
      AND lineage.scenario_id = NEW.scenario_id
      AND lineage.stage = 'released'
      AND lineage.mission_content = NEW.mission_content
  ) THEN
    RAISE EXCEPTION 'released scenario requires a matching released lineage pointer';
  END IF;
  IF NEW.release_gate_mode = 'expert_v1' AND NEW.mission_status = 'reviewed'
     AND NEW.released_lineage_version_id IS NOT NULL
  THEN
    RAISE EXCEPTION 'reviewed expert-gated scenario cannot point to a release';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validate_scenario_release_pointer_trg
  BEFORE INSERT OR UPDATE OF mission_status, released_lineage_version_id, mission_content
  ON public.scenarios FOR EACH ROW EXECUTE FUNCTION public.validate_scenario_release_pointer();

DROP POLICY IF EXISTS "Learners read approved coursework scenarios" ON public.scenarios;
CREATE POLICY "Learners read approved coursework scenarios"
  ON public.scenarios FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (
      content_format IS DISTINCT FROM 'scenario_core_v1'
      AND review_status = 'approved'::public.review_status
      AND usage_assignment = 'coursework_published'::public.usage_assignment
    )
  );

DROP POLICY IF EXISTS scenarios_learner_select_reviewed_course_mission ON public.scenarios;
CREATE POLICY scenarios_learner_select_released_course_mission
  ON public.scenarios FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (
      content_format = 'scenario_core_v1'
      AND public.has_completed_learner_profile()
      AND (
        (release_gate_mode = 'legacy_reviewed' AND mission_status = 'reviewed')
        OR
        (release_gate_mode = 'expert_v1' AND mission_status = 'released'
          AND released_lineage_version_id IS NOT NULL)
      )
      AND EXISTS (
        SELECT 1 FROM public.curriculum_week_scenarios assignment
        JOIN public.curriculum_outlines outline ON outline.id = assignment.outline_id
        WHERE assignment.scenario_id = scenarios.scenario_id AND outline.status = 'published'
      )
    )
  );

CREATE OR REPLACE FUNCTION public.reject_unreleased_covered_learner_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.lineage_version_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.mission_lineage_versions lineage
    WHERE lineage.id = NEW.lineage_version_id
      AND lineage.coverage_status = 'covered'
      AND lineage.stage <> 'released'
  ) THEN
    RAISE EXCEPTION 'covered learner events require the exact released lineage';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER reject_unreleased_covered_learner_event_trg
  BEFORE INSERT ON public.learner_mission_events
  FOR EACH ROW EXECUTE FUNCTION public.reject_unreleased_covered_learner_event();

REVOKE ALL ON FUNCTION public.mark_covered_mission_release_gate() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_released_mission_lineage() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_scenario_release_pointer() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_unreleased_covered_learner_event() FROM PUBLIC;
