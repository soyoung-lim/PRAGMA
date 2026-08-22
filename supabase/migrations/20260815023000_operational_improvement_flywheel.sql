-- PRAGMA moat v1.6: operational, evidence-linked data improvement flywheel.
-- Learner dissent, expert disagreement, and persisted Gold drift are materialized by
-- one server contract. They never mutate rules automatically. A human-approved candidate,
-- immutable pack release manifest, expert-approved Gold impact, and passing regression are
-- all required before an applied decision can close the loop.

ALTER TABLE public.pragma_improvement_candidates
  ADD COLUMN analysis_contract_version text NOT NULL DEFAULT 'pragma_improvement_signal_v2',
  ADD COLUMN evidence_fingerprint text,
  ADD COLUMN source_window_start timestamptz,
  ADD COLUMN source_window_end timestamptz;

UPDATE public.pragma_improvement_candidates
SET evidence_fingerprint = encode(
  extensions.digest(convert_to(candidate_key, 'UTF8'), 'sha256'::text),
  'hex'
)
WHERE evidence_fingerprint IS NULL;

ALTER TABLE public.pragma_improvement_candidates
  ALTER COLUMN evidence_fingerprint SET NOT NULL,
  ADD CONSTRAINT pragma_improvement_source_refs_array
    CHECK (jsonb_typeof(source_refs) = 'array'),
  ADD CONSTRAINT pragma_improvement_metrics_object
    CHECK (jsonb_typeof(metrics) = 'object'),
  ADD CONSTRAINT pragma_improvement_pack_pair
    CHECK ((realization_pack_id IS NULL) = (realization_pack_version IS NULL)),
  ADD CONSTRAINT pragma_improvement_window_order
    CHECK (source_window_start IS NULL OR source_window_end IS NULL OR source_window_start <= source_window_end);

CREATE TABLE public.pragma_improvement_candidate_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.pragma_improvement_candidates(id) ON DELETE RESTRICT,
  source_type text NOT NULL CHECK (source_type IN (
    'learner_mission_event',
    'mission_expert_review',
    'mission_candidate_disagreement',
    'mission_claim_disagreement',
    'gold_regression_run',
    'gold_regression_mismatch'
  )),
  source_id uuid NOT NULL,
  source_field text NOT NULL DEFAULT '',
  source_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(source_snapshot) = 'object'),
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (candidate_id, source_type, source_id, source_field),
  -- One observation may support only one immutable candidate batch. New evidence creates
  -- a new batch; old evidence cannot be recycled to inflate repeated signals.
  UNIQUE (source_type, source_id, source_field)
);

CREATE INDEX pragma_improvement_sources_candidate_idx
  ON public.pragma_improvement_candidate_sources(candidate_id, source_type);

CREATE TABLE public.pragma_improvement_refresh_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_version text NOT NULL CHECK (contract_version = 'pragma_improvement_materializer_v1'),
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL CHECK (window_start < window_end),
  thresholds jsonb NOT NULL CHECK (jsonb_typeof(thresholds) = 'object'),
  created_candidate_ids uuid[] NOT NULL DEFAULT '{}',
  created_counts jsonb NOT NULL CHECK (jsonb_typeof(created_counts) = 'object'),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.pragma_realization_pack_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id text NOT NULL,
  pack_version text NOT NULL CHECK (pack_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  artifact_hash text NOT NULL CHECK (artifact_hash ~ '^[0-9a-f]{64}$'),
  prompt_snapshot_hash text NOT NULL CHECK (prompt_snapshot_hash ~ '^[0-9a-f]{64}$'),
  evidence_snapshot_hash text NOT NULL CHECK (evidence_snapshot_hash ~ '^[0-9a-f]{64}$'),
  source_commit_ref text NOT NULL CHECK (length(btrim(source_commit_ref)) > 0),
  release_note_ko text NOT NULL CHECK (length(btrim(release_note_ko)) > 0),
  source_candidate_id uuid REFERENCES public.pragma_improvement_candidates(id) ON DELETE RESTRICT,
  supersedes_release_id uuid REFERENCES public.pragma_realization_pack_releases(id) ON DELETE RESTRICT,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pack_id, pack_version),
  UNIQUE (supersedes_release_id)
);

CREATE UNIQUE INDEX pragma_pack_release_one_candidate_idx
  ON public.pragma_realization_pack_releases(source_candidate_id)
  WHERE source_candidate_id IS NOT NULL;

ALTER TABLE public.pragma_improvement_decisions
  ADD COLUMN decision_contract_version text NOT NULL DEFAULT 'pragma_improvement_decision_v2',
  ADD COLUMN candidate_evidence_fingerprint text,
  ADD COLUMN resulting_pack_release_id uuid
    REFERENCES public.pragma_realization_pack_releases(id) ON DELETE RESTRICT,
  ADD COLUMN resulting_gold_resolution_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN gold_regression_run_id uuid
    REFERENCES public.pragma_gold_regression_runs(id) ON DELETE RESTRICT,
  ADD CONSTRAINT pragma_improvement_applied_authority_v2 CHECK (
    decision <> 'applied'
    OR (
      candidate_evidence_fingerprint IS NOT NULL
      AND resulting_pack_release_id IS NOT NULL
      AND cardinality(resulting_gold_resolution_ids) > 0
      AND gold_regression_run_id IS NOT NULL
    )
  ) NOT VALID;

GRANT SELECT ON public.pragma_improvement_candidate_sources,
  public.pragma_improvement_refresh_runs,
  public.pragma_realization_pack_releases TO authenticated;
GRANT ALL ON public.pragma_improvement_candidate_sources,
  public.pragma_improvement_refresh_runs,
  public.pragma_realization_pack_releases TO service_role;

REVOKE INSERT ON public.pragma_improvement_candidates,
  public.pragma_improvement_decisions FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.pragma_improvement_candidate_sources,
  public.pragma_improvement_refresh_runs,
  public.pragma_realization_pack_releases FROM authenticated, anon;

DROP POLICY IF EXISTS "admin_insert_improvement_candidates" ON public.pragma_improvement_candidates;
DROP POLICY IF EXISTS "admin_insert_improvement_decisions" ON public.pragma_improvement_decisions;

ALTER TABLE public.pragma_improvement_candidate_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pragma_improvement_refresh_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pragma_realization_pack_releases ENABLE ROW LEVEL SECURITY;

CREATE POLICY improvement_sources_admin_read
  ON public.pragma_improvement_candidate_sources FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY improvement_refresh_admin_read
  ON public.pragma_improvement_refresh_runs FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY realization_pack_releases_admin_read
  ON public.pragma_realization_pack_releases FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.pragma_semver_is_greater(p_new text, p_old text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
DECLARE
  v_new integer[];
  v_old integer[];
BEGIN
  IF p_new !~ '^[0-9]+\.[0-9]+\.[0-9]+$' OR p_old !~ '^[0-9]+\.[0-9]+\.[0-9]+$' THEN
    RETURN false;
  END IF;
  v_new := string_to_array(p_new, '.')::integer[];
  v_old := string_to_array(p_old, '.')::integer[];
  RETURN (v_new[1], v_new[2], v_new[3]) > (v_old[1], v_old[2], v_old[3]);
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_pragma_realization_pack_release()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_previous public.pragma_realization_pack_releases%ROWTYPE;
  v_candidate public.pragma_improvement_candidates%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('pragma-pack:' || NEW.pack_id, 0));
  SELECT release.* INTO v_previous
  FROM public.pragma_realization_pack_releases release
  WHERE release.pack_id = NEW.pack_id
    AND NOT EXISTS (
      SELECT 1 FROM public.pragma_realization_pack_releases later
      WHERE later.supersedes_release_id = release.id
    )
  ORDER BY release.created_at DESC LIMIT 1;

  IF NOT FOUND THEN
    IF NEW.source_candidate_id IS NOT NULL OR NEW.supersedes_release_id IS NOT NULL THEN
      RAISE EXCEPTION 'The first pack release must be an unlinked baseline manifest';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.supersedes_release_id IS DISTINCT FROM v_previous.id
     OR NEW.source_candidate_id IS NULL
     OR NOT public.pragma_semver_is_greater(NEW.pack_version, v_previous.pack_version)
  THEN
    RAISE EXCEPTION 'Pack releases must form a contiguous, strictly increasing candidate-linked chain';
  END IF;
  SELECT * INTO v_candidate FROM public.pragma_improvement_candidates WHERE id = NEW.source_candidate_id;
  IF NOT FOUND OR v_candidate.realization_pack_id IS DISTINCT FROM NEW.pack_id
     OR v_candidate.realization_pack_version IS DISTINCT FROM v_previous.pack_version
     OR NOT EXISTS (
       SELECT 1 FROM public.pragma_improvement_decisions decision
       WHERE decision.candidate_id = NEW.source_candidate_id AND decision.decision = 'approve'
     )
  THEN
    RAISE EXCEPTION 'Pack release candidate must be approved and scoped to the current pack';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_pragma_realization_pack_release_trg
  BEFORE INSERT ON public.pragma_realization_pack_releases
  FOR EACH ROW EXECUTE FUNCTION public.validate_pragma_realization_pack_release();

CREATE OR REPLACE FUNCTION public.materialize_pragma_improvement_candidates(
  p_window_start timestamptz DEFAULT now() - interval '180 days',
  p_window_end timestamptz DEFAULT now(),
  p_min_distinct_attempts integer DEFAULT 3,
  p_min_distinct_participants integer DEFAULT 3
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group record;
  v_candidate_id uuid;
  v_candidate_ids uuid[] := '{}';
  v_learner_count integer := 0;
  v_expert_count integer := 0;
  v_gold_count integer := 0;
  v_fingerprint text;
  v_candidate_keys text[];
  v_claim_keys text[];
  v_refs jsonb;
  v_mismatch_fields text[];
  v_refresh_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can materialize improvement candidates';
  END IF;
  IF p_window_start >= p_window_end OR p_min_distinct_attempts < 3
     OR p_min_distinct_participants < 3 THEN
    RAISE EXCEPTION 'A valid window and minimum 3 distinct attempts/participants are required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('pragma-improvement-materializer-v1', 0));

  -- Learner evidence is eligible only while consent is still current, and only when
  -- the event matches the exact released lineage, server-owned feature, speech act,
  -- direction, content hash, and a structured dissent payload.
  FOR v_group IN
    WITH eligible AS (
      SELECT event.id, event.attempt_id, event.profile_id, event.recorded_at,
             lineage.id AS lineage_version_id,
             lineage.mission_content->'unit'->>'target_feature' AS target_feature,
             lineage.mission_content_hash AS content_hash,
             lineage.realization_pack_id, lineage.realization_pack_version
      FROM public.learner_mission_events event
      JOIN public.profiles profile ON profile.id = event.profile_id
      JOIN public.mission_lineage_versions lineage
        ON lineage.id = event.lineage_version_id
       AND lineage.stage = 'released'
       AND lineage.coverage_status = 'covered'
       AND lineage.mission_content_hash = event.content_hash
       AND lineage.mission_content->'unit'->>'target_feature' = event.feature_id
       AND COALESCE(lineage.mission_content->>'direction', 'ko_zh') = event.direction
      JOIN public.scenarios scenario ON scenario.scenario_id = lineage.scenario_id
       AND scenario.speech_act::text = event.speech_act
      WHERE event.event_type = 'learner_dissent_submitted'
        AND event.recorded_at >= p_window_start AND event.recorded_at < p_window_end
        AND profile.consent_data_use = true
        AND profile.consent_anonymous_analysis = true
        AND profile.research_consent_version = event.consent_version
        AND jsonb_typeof(event.event_payload->'dissent') = 'object'
        AND event.event_payload->'dissent'->>'kind' = 'learner_dissent'
        AND length(btrim(COALESCE(event.event_payload->'dissent'->>'reason_ko', ''))) > 0
        AND NOT EXISTS (
          SELECT 1 FROM public.pragma_improvement_candidate_sources source
          WHERE source.source_type = 'learner_mission_event' AND source.source_id = event.id
        )
    )
    SELECT lineage_version_id, target_feature, content_hash,
           realization_pack_id, realization_pack_version,
           array_agg(id ORDER BY id) AS source_ids,
           count(DISTINCT attempt_id)::integer AS distinct_attempts,
           count(DISTINCT profile_id)::integer AS distinct_participants,
           min(recorded_at) AS window_start, max(recorded_at) AS window_end
    FROM eligible
    GROUP BY lineage_version_id, target_feature, content_hash,
             realization_pack_id, realization_pack_version
    HAVING count(DISTINCT attempt_id) >= p_min_distinct_attempts
       AND count(DISTINCT profile_id) >= p_min_distinct_participants
  LOOP
    v_fingerprint := encode(
      extensions.digest(convert_to(array_to_string(v_group.source_ids, ','), 'UTF8'), 'sha256'::text),
      'hex'
    );
    v_refs := (SELECT jsonb_agg('learner-event:' || source_id::text ORDER BY source_id)
               FROM unnest(v_group.source_ids) source_id);
    v_candidate_id := NULL;
    INSERT INTO public.pragma_improvement_candidates (
      candidate_key, signal_type, target_feature, content_hash,
      realization_pack_id, realization_pack_version, source_refs, metrics,
      suggested_action, created_by, analysis_contract_version,
      evidence_fingerprint, source_window_start, source_window_end
    ) VALUES (
      'learner:' || v_fingerprint,
      'learner_dissent_cluster', v_group.target_feature, v_group.content_hash,
      v_group.realization_pack_id, v_group.realization_pack_version, v_refs,
      jsonb_build_object(
        'lineage_version_id', v_group.lineage_version_id,
        'distinct_attempt_count', v_group.distinct_attempts,
        'distinct_participant_count', v_group.distinct_participants,
        'dissent_event_count', cardinality(v_group.source_ids),
        'minimum_distinct_attempts', p_min_distinct_attempts,
        'minimum_distinct_participants', p_min_distinct_participants
      ),
      'review_content_and_rule_scope', auth.uid(), 'pragma_improvement_signal_v2',
      v_fingerprint, v_group.window_start, v_group.window_end
    ) ON CONFLICT (candidate_key) DO NOTHING RETURNING id INTO v_candidate_id;
    IF v_candidate_id IS NOT NULL THEN
      INSERT INTO public.pragma_improvement_candidate_sources (
        candidate_id, source_type, source_id, source_snapshot
      )
      SELECT v_candidate_id, 'learner_mission_event', event.id,
             jsonb_build_object(
               'event_type', event.event_type,
               'lineage_version_id', event.lineage_version_id,
               'feature_id', v_group.target_feature,
               'content_hash', event.content_hash,
               'recorded_at', event.recorded_at
             )
      FROM public.learner_mission_events event
      WHERE event.id = ANY(v_group.source_ids);
      v_candidate_ids := array_append(v_candidate_ids, v_candidate_id);
      v_learner_count := v_learner_count + 1;
    END IF;
  END LOOP;

  -- Expert evidence is materialized only after every blind assignment in one round has
  -- submitted. Candidate-band and lineage-claim disagreement are both retained.
  FOR v_group IN
    SELECT review.lineage_version_id, review.review_round,
           lineage.mission_content->'unit'->>'target_feature' AS target_feature,
           lineage.mission_content_hash AS content_hash,
           lineage.realization_pack_id, lineage.realization_pack_version,
           array_agg(review.id ORDER BY review.id) AS source_ids,
           count(DISTINCT review.reviewer_user_id)::integer AS reviewer_count,
           count(DISTINCT review.overall_verdict)::integer AS overall_variant_count,
           count(DISTINCT review.candidate_band_assessments::text)::integer AS candidate_variant_count,
           count(DISTINCT review.lineage_claim_assessments::text)::integer AS claim_variant_count,
           min(review.submitted_at) AS window_start, max(review.submitted_at) AS window_end
    FROM public.mission_expert_reviews review
    JOIN public.mission_expert_review_assignments assignment
      ON assignment.id = review.assignment_id
     AND assignment.blind_review = true
     AND assignment.review_round = review.review_round
    JOIN public.mission_lineage_versions lineage
      ON lineage.id = review.lineage_version_id
     AND lineage.coverage_status = 'covered'
     AND lineage.realization_pack_id IS NOT NULL
    WHERE review.schema_version = 'mission_expert_review_v2'
      AND review.submitted_at >= p_window_start AND review.submitted_at < p_window_end
      AND NOT EXISTS (
        SELECT 1 FROM public.pragma_improvement_candidate_sources source
        WHERE source.source_type = 'mission_expert_review' AND source.source_id = review.id
      )
    GROUP BY review.lineage_version_id, review.review_round,
             lineage.mission_content, lineage.mission_content_hash,
             lineage.realization_pack_id, lineage.realization_pack_version
    HAVING count(DISTINCT review.reviewer_user_id) >= 2
       AND count(*) = (
         SELECT count(*) FROM public.mission_expert_review_assignments expected
         WHERE expected.lineage_version_id = review.lineage_version_id
           AND expected.review_round = review.review_round
           AND expected.blind_review = true
       )
       AND (
         count(DISTINCT review.overall_verdict) > 1
         OR count(DISTINCT review.candidate_band_assessments::text) > 1
         OR count(DISTINCT review.lineage_claim_assessments::text) > 1
       )
  LOOP
    SELECT COALESCE(array_agg(key ORDER BY key), '{}') INTO v_candidate_keys
    FROM (
      SELECT key
      FROM public.mission_expert_reviews review,
           LATERAL jsonb_object_keys(review.candidate_band_assessments) key
      WHERE review.id = ANY(v_group.source_ids)
      GROUP BY key
      HAVING count(DISTINCT (review.candidate_band_assessments->key)::text) > 1
    ) disagreement;
    SELECT COALESCE(array_agg(key ORDER BY key), '{}') INTO v_claim_keys
    FROM (
      SELECT key
      FROM public.mission_expert_reviews review,
           LATERAL jsonb_object_keys(review.lineage_claim_assessments) key
      WHERE review.id = ANY(v_group.source_ids)
      GROUP BY key
      HAVING count(DISTINCT (review.lineage_claim_assessments->key)::text) > 1
    ) disagreement;

    v_fingerprint := encode(extensions.digest(convert_to(
      v_group.lineage_version_id::text || ':' || v_group.review_round::text || ':' ||
      array_to_string(v_group.source_ids, ','), 'UTF8'), 'sha256'::text), 'hex');
    SELECT COALESCE(jsonb_agg(ref ORDER BY ref), '[]'::jsonb) INTO v_refs
    FROM (
      SELECT 'expert-review:' || source_id::text AS ref FROM unnest(v_group.source_ids) source_id
      UNION ALL
      SELECT 'candidate:' || key FROM unnest(v_candidate_keys) key
      UNION ALL
      SELECT 'claim:' || key FROM unnest(v_claim_keys) key
    ) refs;
    v_candidate_id := NULL;
    INSERT INTO public.pragma_improvement_candidates (
      candidate_key, signal_type, target_feature, content_hash,
      realization_pack_id, realization_pack_version, source_refs, metrics,
      suggested_action, created_by, analysis_contract_version,
      evidence_fingerprint, source_window_start, source_window_end
    ) VALUES (
      'expert:' || v_fingerprint,
      'expert_disagreement', v_group.target_feature, v_group.content_hash,
      v_group.realization_pack_id, v_group.realization_pack_version, v_refs,
      jsonb_build_object(
        'lineage_version_id', v_group.lineage_version_id,
        'review_round', v_group.review_round,
        'reviewer_count', v_group.reviewer_count,
        'overall_variant_count', v_group.overall_variant_count,
        'candidate_disagreement_keys', to_jsonb(v_candidate_keys),
        'lineage_claim_disagreement_keys', to_jsonb(v_claim_keys)
      ),
      'resolve_expert_boundary_case', auth.uid(), 'pragma_improvement_signal_v2',
      v_fingerprint, v_group.window_start, v_group.window_end
    ) ON CONFLICT (candidate_key) DO NOTHING RETURNING id INTO v_candidate_id;
    IF v_candidate_id IS NOT NULL THEN
      INSERT INTO public.pragma_improvement_candidate_sources (
        candidate_id, source_type, source_id, source_field, source_snapshot
      )
      SELECT v_candidate_id, 'mission_expert_review', review.id,
             'round:' || v_group.review_round::text,
             jsonb_build_object(
               'lineage_version_id', review.lineage_version_id,
               'review_round', review.review_round,
               'overall_verdict', review.overall_verdict,
               'submitted_at', review.submitted_at
             )
      FROM public.mission_expert_reviews review WHERE review.id = ANY(v_group.source_ids);
      INSERT INTO public.pragma_improvement_candidate_sources (
        candidate_id, source_type, source_id, source_field, source_snapshot
      )
      SELECT v_candidate_id, 'mission_candidate_disagreement', v_group.lineage_version_id,
             'round:' || v_group.review_round::text || ':candidate:' || key,
             jsonb_build_object('review_ids', to_jsonb(v_group.source_ids))
      FROM unnest(v_candidate_keys) key;
      INSERT INTO public.pragma_improvement_candidate_sources (
        candidate_id, source_type, source_id, source_field, source_snapshot
      )
      SELECT v_candidate_id, 'mission_claim_disagreement', v_group.lineage_version_id,
             'round:' || v_group.review_round::text || ':claim:' || key,
             jsonb_build_object('review_ids', to_jsonb(v_group.source_ids))
      FROM unnest(v_claim_keys) key;
      v_candidate_ids := array_append(v_candidate_ids, v_candidate_id);
      v_expert_count := v_expert_count + 1;
    END IF;
  END LOOP;

  -- Gold drift comes only from an immutable persisted server-computed run. Every concrete
  -- band/semantic mismatch is retained, with the run itself as the authoritative source.
  FOR v_group IN
    SELECT run.*
    FROM public.pragma_gold_regression_runs run
    WHERE run.gate_status = 'fail'
      AND run.created_at >= p_window_start AND run.created_at < p_window_end
      AND NOT EXISTS (
        SELECT 1 FROM public.pragma_improvement_candidate_sources source
        WHERE source.source_type = 'gold_regression_run' AND source.source_id = run.id
      )
  LOOP
    WITH expected AS (
      SELECT snapshot->>'case_id' AS case_id,
             candidate->>'candidate_id' AS candidate_id,
             candidate->>'expected_band_code' AS expected_band,
             candidate->>'semantic_fidelity' AS expected_semantic
      FROM jsonb_array_elements(v_group.gold_case_snapshots) snapshot,
           LATERAL jsonb_array_elements(snapshot->'candidates') candidate
    ), observed AS (
      SELECT observation->>'case_id' AS case_id,
             observation->>'candidate_id' AS candidate_id,
             observation->>'predicted_band_code' AS predicted_band,
             observation->>'predicted_semantic_fidelity' AS predicted_semantic
      FROM jsonb_array_elements(v_group.observations) observation
    ), mismatch AS (
      SELECT expected.case_id || '::' || expected.candidate_id || '::band' AS field
      FROM expected LEFT JOIN observed USING (case_id, candidate_id)
      WHERE observed.case_id IS NULL OR expected.expected_band IS DISTINCT FROM observed.predicted_band
      UNION
      SELECT expected.case_id || '::' || expected.candidate_id || '::semantic' AS field
      FROM expected LEFT JOIN observed USING (case_id, candidate_id)
      WHERE observed.case_id IS NULL OR expected.expected_semantic IS DISTINCT FROM observed.predicted_semantic
      UNION
      SELECT observed.case_id || '::' || observed.candidate_id || '::unknown' AS field
      FROM observed LEFT JOIN expected USING (case_id, candidate_id) WHERE expected.case_id IS NULL
      UNION
      SELECT observed.case_id || '::' || observed.candidate_id || '::duplicate' AS field
      FROM observed GROUP BY observed.case_id, observed.candidate_id HAVING count(*) > 1
    )
    SELECT COALESCE(array_agg(field ORDER BY field), '{}') INTO v_mismatch_fields FROM mismatch;

    v_fingerprint := encode(
      extensions.digest(convert_to(v_group.id::text, 'UTF8'), 'sha256'::text),
      'hex'
    );
    SELECT jsonb_agg(ref ORDER BY ref) INTO v_refs
    FROM (
      SELECT 'gold-run:' || v_group.id::text AS ref
      UNION ALL
      SELECT 'gold-mismatch:' || field FROM unnest(v_mismatch_fields) field
    ) refs;
    v_candidate_id := NULL;
    INSERT INTO public.pragma_improvement_candidates (
      candidate_key, signal_type, target_feature, content_hash,
      realization_pack_id, realization_pack_version, source_refs, metrics,
      suggested_action, created_by, analysis_contract_version,
      evidence_fingerprint, source_window_start, source_window_end
    ) VALUES (
      'gold:' || v_group.id::text,
      'gold_regression_drift', NULL, NULL,
      v_group.realization_pack_id, v_group.realization_pack_version, v_refs,
      v_group.report || jsonb_build_object(
        'gold_regression_run_id', v_group.id,
        'mismatch_fields', to_jsonb(v_mismatch_fields),
        'impacted_gold_case_ids', COALESCE((
          SELECT jsonb_agg(DISTINCT split_part(field, '::', 1))
          FROM unnest(v_mismatch_fields) field
        ), '[]'::jsonb)
      ),
      'review_gold_label_or_evaluator', auth.uid(), 'pragma_improvement_signal_v2',
      v_fingerprint, v_group.created_at, v_group.created_at
    ) ON CONFLICT (candidate_key) DO NOTHING RETURNING id INTO v_candidate_id;
    IF v_candidate_id IS NOT NULL THEN
      INSERT INTO public.pragma_improvement_candidate_sources (
        candidate_id, source_type, source_id, source_snapshot
      ) VALUES (
        v_candidate_id, 'gold_regression_run', v_group.id,
        jsonb_build_object(
          'gate_status', v_group.gate_status,
          'evaluator_version', v_group.evaluator_version,
          'prompt_snapshot_hash', v_group.prompt_snapshot_hash,
          'created_at', v_group.created_at
        )
      );
      INSERT INTO public.pragma_improvement_candidate_sources (
        candidate_id, source_type, source_id, source_field, source_snapshot
      )
      SELECT v_candidate_id, 'gold_regression_mismatch', v_group.id, field,
             jsonb_build_object('field', field)
      FROM unnest(v_mismatch_fields) field;
      v_candidate_ids := array_append(v_candidate_ids, v_candidate_id);
      v_gold_count := v_gold_count + 1;
    END IF;
  END LOOP;

  INSERT INTO public.pragma_improvement_refresh_runs (
    contract_version, window_start, window_end, thresholds,
    created_candidate_ids, created_counts, created_by
  ) VALUES (
    'pragma_improvement_materializer_v1', p_window_start, p_window_end,
    jsonb_build_object(
      'minimum_distinct_attempts', p_min_distinct_attempts,
      'minimum_distinct_participants', p_min_distinct_participants,
      'current_consent_required', true,
      'exact_released_lineage_required', true
    ),
    v_candidate_ids,
    jsonb_build_object(
      'learner_dissent_cluster', v_learner_count,
      'expert_disagreement', v_expert_count,
      'gold_regression_drift', v_gold_count,
      'total', cardinality(v_candidate_ids)
    ),
    auth.uid()
  ) RETURNING id INTO v_refresh_id;
  RETURN v_refresh_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_pragma_improvement_decision(
  p_candidate_id uuid,
  p_decision text,
  p_note_ko text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_fingerprint text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can record improvement decisions';
  END IF;
  IF p_decision NOT IN ('triage', 'approve', 'reject') OR length(btrim(COALESCE(p_note_ko, ''))) = 0 THEN
    RAISE EXCEPTION 'A valid human decision and note are required';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_candidate_id::text, 0));
  SELECT evidence_fingerprint INTO v_fingerprint
  FROM public.pragma_improvement_candidates WHERE id = p_candidate_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Improvement candidate not found'; END IF;

  INSERT INTO public.pragma_improvement_decisions (
    candidate_id, decision, note_ko, decided_by,
    decision_contract_version, candidate_evidence_fingerprint
  ) VALUES (
    p_candidate_id, p_decision, p_note_ko, auth.uid(),
    'pragma_improvement_decision_v2', v_fingerprint
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_pragma_realization_pack_release(
  p_pack_id text,
  p_pack_version text,
  p_artifact_hash text,
  p_prompt_snapshot_hash text,
  p_evidence_snapshot_hash text,
  p_source_commit_ref text,
  p_release_note_ko text,
  p_source_candidate_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_previous public.pragma_realization_pack_releases%ROWTYPE;
  v_candidate public.pragma_improvement_candidates%ROWTYPE;
  v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only admins can record pack releases'; END IF;
  IF p_pack_version !~ '^[0-9]+\.[0-9]+\.[0-9]+$'
     OR p_artifact_hash !~ '^[0-9a-f]{64}$'
     OR p_prompt_snapshot_hash !~ '^[0-9a-f]{64}$'
     OR p_evidence_snapshot_hash !~ '^[0-9a-f]{64}$'
     OR length(btrim(COALESCE(p_source_commit_ref, ''))) = 0
     OR length(btrim(COALESCE(p_release_note_ko, ''))) = 0
  THEN RAISE EXCEPTION 'Pack release requires semver, three SHA-256 hashes, commit ref, and note'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('pragma-pack:' || p_pack_id, 0));
  SELECT release.* INTO v_previous
  FROM public.pragma_realization_pack_releases release
  WHERE release.pack_id = p_pack_id
    AND NOT EXISTS (
      SELECT 1 FROM public.pragma_realization_pack_releases later
      WHERE later.supersedes_release_id = release.id
    )
  ORDER BY release.created_at DESC LIMIT 1;

  IF FOUND THEN
    IF p_source_candidate_id IS NULL OR NOT public.pragma_semver_is_greater(p_pack_version, v_previous.pack_version) THEN
      RAISE EXCEPTION 'A subsequent pack release needs an approved candidate and strictly greater semver';
    END IF;
    SELECT * INTO v_candidate FROM public.pragma_improvement_candidates WHERE id = p_source_candidate_id;
    IF NOT FOUND OR v_candidate.realization_pack_id IS DISTINCT FROM p_pack_id
       OR v_candidate.realization_pack_version IS DISTINCT FROM v_previous.pack_version
       OR NOT EXISTS (
         SELECT 1 FROM public.pragma_improvement_decisions decision
         WHERE decision.candidate_id = p_source_candidate_id AND decision.decision = 'approve'
       )
    THEN RAISE EXCEPTION 'Pack release candidate must be approved and scoped to the current pack'; END IF;
  ELSIF p_source_candidate_id IS NOT NULL THEN
    RAISE EXCEPTION 'The first pack release is a baseline manifest and cannot claim an improvement candidate';
  END IF;

  INSERT INTO public.pragma_realization_pack_releases (
    pack_id, pack_version, artifact_hash, prompt_snapshot_hash, evidence_snapshot_hash,
    source_commit_ref, release_note_ko, source_candidate_id, supersedes_release_id, created_by
  ) VALUES (
    p_pack_id, p_pack_version, p_artifact_hash, p_prompt_snapshot_hash, p_evidence_snapshot_hash,
    p_source_commit_ref, p_release_note_ko, p_source_candidate_id, v_previous.id, auth.uid()
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_pragma_improvement_candidate(
  p_candidate_id uuid,
  p_note_ko text,
  p_pack_release_id uuid,
  p_resulting_gold_case_ids text[],
  p_gold_regression_run_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_candidate public.pragma_improvement_candidates%ROWTYPE;
  v_release public.pragma_realization_pack_releases%ROWTYPE;
  v_regression public.pragma_gold_regression_runs%ROWTYPE;
  v_gold_resolution_ids uuid[];
  v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only admins can apply improvement candidates'; END IF;
  IF length(btrim(COALESCE(p_note_ko, ''))) = 0 OR cardinality(p_resulting_gold_case_ids) < 1
  THEN RAISE EXCEPTION 'Application note and impacted Gold cases are required'; END IF;
  IF cardinality(p_resulting_gold_case_ids) <> (
    SELECT count(DISTINCT case_id) FROM unnest(p_resulting_gold_case_ids) case_id
  ) THEN RAISE EXCEPTION 'Impacted Gold case IDs must be distinct'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_candidate_id::text, 0));
  SELECT * INTO v_candidate FROM public.pragma_improvement_candidates WHERE id = p_candidate_id;
  SELECT * INTO v_release FROM public.pragma_realization_pack_releases WHERE id = p_pack_release_id;
  SELECT * INTO v_regression FROM public.pragma_gold_regression_runs WHERE id = p_gold_regression_run_id;
  IF v_candidate.id IS NULL OR v_release.id IS NULL OR v_regression.id IS NULL THEN
    RAISE EXCEPTION 'Candidate, pack release, and regression run must exist';
  END IF;
  IF v_release.source_candidate_id IS DISTINCT FROM p_candidate_id
     OR v_release.pack_id IS DISTINCT FROM v_candidate.realization_pack_id
     OR NOT public.pragma_semver_is_greater(v_release.pack_version, v_candidate.realization_pack_version)
  THEN RAISE EXCEPTION 'Pack release must be a strictly newer manifest created from this candidate'; END IF;
  IF v_regression.gate_status <> 'pass'
     OR v_regression.realization_pack_id IS DISTINCT FROM v_release.pack_id
     OR v_regression.realization_pack_version IS DISTINCT FROM v_release.pack_version
  THEN RAISE EXCEPTION 'A passing Gold regression from the resulting pack release is required'; END IF;

  SELECT array_agg(resolution.id ORDER BY resolution.id) INTO v_gold_resolution_ids
  FROM public.pragma_gold_expert_resolutions resolution
  WHERE resolution.id = ANY(v_regression.gold_resolution_ids)
    AND resolution.resolved_case_snapshot->>'case_id' = ANY(p_resulting_gold_case_ids)
    AND resolution.resolved_case_snapshot->>'realization_pack_id' = v_release.pack_id
    AND resolution.resolved_case_snapshot->>'realization_pack_version' = v_release.pack_version
    AND resolution.final_status = 'expert_approved'
    AND NOT EXISTS (
      SELECT 1 FROM public.pragma_gold_expert_resolutions later
      WHERE later.calibration_resolution_id = resolution.calibration_resolution_id
        AND (
          later.review_round > resolution.review_round
          OR (later.review_round = resolution.review_round
            AND later.resolution_revision > resolution.resolution_revision)
        )
    );
  IF cardinality(v_gold_resolution_ids) <> cardinality(p_resulting_gold_case_ids) THEN
    RAISE EXCEPTION 'Every impacted Gold case must be latest expert-approved and included in the passing run';
  END IF;

  INSERT INTO public.pragma_improvement_decisions (
    candidate_id, decision, note_ko,
    resulting_pack_id, resulting_pack_version, resulting_gold_case_ids,
    decided_by, decision_contract_version, candidate_evidence_fingerprint,
    resulting_pack_release_id, resulting_gold_resolution_ids, gold_regression_run_id
  ) VALUES (
    p_candidate_id, 'applied', p_note_ko,
    v_release.pack_id, v_release.pack_version, p_resulting_gold_case_ids,
    auth.uid(), 'pragma_improvement_decision_v2', v_candidate.evidence_fingerprint,
    v_release.id, v_gold_resolution_ids, v_regression.id
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- The append-only state machine rejects contradictory terminal decisions and binds an
-- applied row to the exact evidence snapshot, pack manifest, Gold resolutions, and run.
CREATE OR REPLACE FUNCTION public.validate_pragma_improvement_decision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_candidate public.pragma_improvement_candidates%ROWTYPE;
  v_latest text;
  v_release public.pragma_realization_pack_releases%ROWTYPE;
  v_regression public.pragma_gold_regression_runs%ROWTYPE;
  v_gold_count integer;
BEGIN
  SELECT * INTO v_candidate FROM public.pragma_improvement_candidates WHERE id = NEW.candidate_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Improvement candidate not found'; END IF;
  IF NEW.candidate_evidence_fingerprint IS DISTINCT FROM v_candidate.evidence_fingerprint THEN
    RAISE EXCEPTION 'Decision evidence fingerprint must match the immutable candidate';
  END IF;
  SELECT decision INTO v_latest FROM public.pragma_improvement_decisions
  WHERE candidate_id = NEW.candidate_id ORDER BY decided_at DESC, id DESC LIMIT 1;

  IF NEW.decision = 'triage' AND v_latest IN ('approve', 'reject', 'applied') THEN
    RAISE EXCEPTION 'Triage cannot follow a terminal human decision';
  ELSIF NEW.decision = 'approve' AND v_latest IN ('approve', 'reject', 'applied') THEN
    RAISE EXCEPTION 'Approve requires an open or triaged candidate';
  ELSIF NEW.decision = 'reject' AND v_latest IN ('approve', 'reject', 'applied') THEN
    RAISE EXCEPTION 'Reject requires an open or triaged candidate';
  ELSIF NEW.decision = 'applied' THEN
    IF v_latest IS DISTINCT FROM 'approve' THEN
      RAISE EXCEPTION 'The latest decision must be approve before applied';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.pragma_improvement_decisions decision
      WHERE decision.candidate_id = NEW.candidate_id AND decision.decision = 'applied'
    ) THEN RAISE EXCEPTION 'Improvement candidate is already applied'; END IF;
    SELECT * INTO v_release FROM public.pragma_realization_pack_releases
    WHERE id = NEW.resulting_pack_release_id;
    SELECT * INTO v_regression FROM public.pragma_gold_regression_runs
    WHERE id = NEW.gold_regression_run_id;
    IF v_release.id IS NULL OR v_regression.id IS NULL
       OR v_release.source_candidate_id IS DISTINCT FROM NEW.candidate_id
       OR NEW.resulting_pack_id IS DISTINCT FROM v_release.pack_id
       OR NEW.resulting_pack_version IS DISTINCT FROM v_release.pack_version
       OR v_release.pack_id IS DISTINCT FROM v_candidate.realization_pack_id
       OR NOT public.pragma_semver_is_greater(v_release.pack_version, v_candidate.realization_pack_version)
       OR v_regression.gate_status <> 'pass'
       OR v_regression.realization_pack_id IS DISTINCT FROM v_release.pack_id
       OR v_regression.realization_pack_version IS DISTINCT FROM v_release.pack_version
    THEN
      RAISE EXCEPTION 'Applied requires this candidate''s newer pack manifest and its passing regression';
    END IF;
    SELECT count(*) INTO v_gold_count
    FROM public.pragma_gold_expert_resolutions resolution
    WHERE resolution.id = ANY(NEW.resulting_gold_resolution_ids)
      AND resolution.id = ANY(v_regression.gold_resolution_ids)
      AND resolution.resolved_case_snapshot->>'case_id' = ANY(NEW.resulting_gold_case_ids)
      AND resolution.resolved_case_snapshot->>'realization_pack_id' = v_release.pack_id
      AND resolution.resolved_case_snapshot->>'realization_pack_version' = v_release.pack_version
      AND resolution.final_status = 'expert_approved'
      AND NOT EXISTS (
        SELECT 1 FROM public.pragma_gold_expert_resolutions later
        WHERE later.calibration_resolution_id = resolution.calibration_resolution_id
          AND (
            later.review_round > resolution.review_round
            OR (later.review_round = resolution.review_round
              AND later.resolution_revision > resolution.resolution_revision)
          )
      );
    IF v_gold_count <> cardinality(NEW.resulting_gold_case_ids)
       OR v_gold_count <> cardinality(NEW.resulting_gold_resolution_ids)
    THEN
      RAISE EXCEPTION 'Applied Gold impact must be latest expert-approved and included in the passing run';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.pragma_semver_is_greater(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_pragma_realization_pack_release() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.materialize_pragma_improvement_candidates(timestamptz, timestamptz, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_pragma_improvement_decision(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_pragma_realization_pack_release(text, text, text, text, text, text, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.apply_pragma_improvement_candidate(uuid, text, uuid, text[], uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.materialize_pragma_improvement_candidates(timestamptz, timestamptz, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_pragma_improvement_decision(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_pragma_realization_pack_release(text, text, text, text, text, text, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.apply_pragma_improvement_candidate(uuid, text, uuid, text[], uuid) TO authenticated, service_role;
