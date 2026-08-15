-- PRAGMA moat v1.4: every pre-lock scenario remains test-only. The 500+ corpus
-- can only begin after an exact nine-act pack, evidence/prompt hashes, current
-- expert Gold, regression, and live RLS evidence have been locked together.
-- Final candidates are fresh INSERTs under that lock; existing scenarios can
-- never be relabelled as final data.

CREATE OR REPLACE FUNCTION public.get_pragma_final_corpus_generation_readiness(
  p_pack_id text
)
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
  v_expert_gold bigint := 0;
  v_min_expert_per_act bigint := 0;
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
  ORDER BY release.created_at DESC
  LIMIT 1;
  IF v_release.id IS NOT NULL THEN
    SELECT * INTO v_attestation
    FROM public.pragma_pack_manifest_attestations
    WHERE id = v_release.manifest_attestation_id;
  END IF;

  IF v_release.id IS NOT NULL THEN
    SELECT count(DISTINCT calibration.case_id)
      INTO v_researcher_gold
    FROM public.pragma_gold_calibration_resolutions calibration
    WHERE calibration.resolution_status = 'researcher_approved'
      AND calibration.resolved_case_snapshot->>'realization_pack_id' = p_pack_id
      AND calibration.resolved_case_snapshot->>'realization_pack_version' = v_release.pack_version
      AND NOT EXISTS (
        SELECT 1 FROM public.pragma_gold_calibration_resolutions later
        WHERE later.case_id = calibration.case_id
          AND later.resolution_round > calibration.resolution_round
      );

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
            AND (
              later.review_round > expert.review_round
              OR (later.review_round = expert.review_round
                AND later.resolution_revision > expert.resolution_revision)
            )
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.pragma_gold_calibration_resolutions later_calibration
          WHERE later_calibration.case_id = calibration.case_id
            AND later_calibration.resolution_round > calibration.resolution_round
        )
    ), per_act AS (
      SELECT act.speech_act, count(current_cases.case_id) AS case_count
      FROM unnest(v_known) AS act(speech_act)
      LEFT JOIN current_cases ON current_cases.speech_act = act.speech_act
      GROUP BY act.speech_act
    )
    SELECT COALESCE(sum(case_count), 0), COALESCE(min(case_count), 0)
      INTO v_expert_gold, v_min_expert_per_act
    FROM per_act;

    SELECT run.id INTO v_regression_id
    FROM public.pragma_gold_regression_runs run
    WHERE run.realization_pack_id = p_pack_id
      AND run.realization_pack_version = v_release.pack_version
      AND run.gate_status = 'pass'
      AND cardinality(run.gold_resolution_ids) >= 30
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
  IF v_researcher_gold < 30 THEN
    v_missing := array_append(v_missing, 'researcher_approved_gold_30_current_pack');
  END IF;
  IF v_expert_gold < 30 OR v_min_expert_per_act < 3 THEN
    v_missing := array_append(v_missing, 'expert_gold_30_and_three_per_act_current_pack');
  END IF;
  IF v_regression_id IS NULL THEN
    v_missing := array_append(v_missing, 'passing_gold_regression_current_pack');
  END IF;
  IF v_rls_verification_id IS NULL THEN
    v_missing := array_append(v_missing, 'live_three_role_rls_smoke_same_commit');
  END IF;

  RETURN jsonb_build_object(
    'schema_version', 'pragma_final_corpus_generation_readiness_v1',
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
        'passed', v_researcher_gold >= 30, 'count', v_researcher_gold, 'required', 30
      ),
      'expert_gold', jsonb_build_object(
        'passed', v_expert_gold >= 30 AND v_min_expert_per_act >= 3,
        'count', v_expert_gold, 'required', 30,
        'minimum_per_speech_act', v_min_expert_per_act,
        'required_per_speech_act', 3
      ),
      'gold_regression', jsonb_build_object(
        'passed', v_regression_id IS NOT NULL, 'run_id', v_regression_id
      ),
      'live_rls_smoke', jsonb_build_object(
        'passed', v_rls_verification_id IS NOT NULL, 'verification_id', v_rls_verification_id
      )
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_pragma_final_corpus_generation_readiness(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_pragma_final_corpus_generation_readiness(text) TO authenticated, service_role;

CREATE TABLE public.pragma_final_corpus_generation_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_version text NOT NULL DEFAULT 'pragma_final_corpus_generation_lock_v1'
    CHECK (schema_version = 'pragma_final_corpus_generation_lock_v1'),
  pack_id text NOT NULL,
  pack_version text NOT NULL,
  pack_release_id uuid NOT NULL UNIQUE
    REFERENCES public.pragma_realization_pack_releases(id) ON DELETE RESTRICT,
  manifest_attestation_id uuid NOT NULL
    REFERENCES public.pragma_pack_manifest_attestations(id) ON DELETE RESTRICT,
  artifact_hash text NOT NULL CHECK (artifact_hash ~ '^[0-9a-f]{64}$'),
  prompt_snapshot_hash text NOT NULL CHECK (prompt_snapshot_hash ~ '^[0-9a-f]{64}$'),
  evidence_snapshot_hash text NOT NULL CHECK (evidence_snapshot_hash ~ '^[0-9a-f]{64}$'),
  source_commit_ref text NOT NULL CHECK (source_commit_ref ~ '^[0-9a-f]{40}$'),
  scope_speech_acts text[] NOT NULL CHECK (cardinality(scope_speech_acts) = 9),
  direction text NOT NULL DEFAULT 'ko_zh' CHECK (direction = 'ko_zh'),
  target_minimum integer NOT NULL DEFAULT 500 CHECK (target_minimum >= 500),
  readiness_snapshot jsonb NOT NULL,
  readiness_snapshot_hash text NOT NULL CHECK (readiness_snapshot_hash ~ '^[0-9a-f]{64}$'),
  rationale_ko text NOT NULL CHECK (length(btrim(rationale_ko)) > 0),
  locked_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  locked_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER pragma_final_corpus_generation_locks_append_only
  BEFORE UPDATE OR DELETE ON public.pragma_final_corpus_generation_locks
  FOR EACH ROW EXECUTE FUNCTION public.reject_pragma_pack_manifest_attestation_mutation();
ALTER TABLE public.pragma_final_corpus_generation_locks ENABLE ROW LEVEL SECURITY;
CREATE POLICY pragma_final_corpus_generation_locks_admin_read
  ON public.pragma_final_corpus_generation_locks FOR SELECT TO authenticated
  USING (public.is_admin());
GRANT SELECT ON public.pragma_final_corpus_generation_locks TO authenticated, service_role;
REVOKE INSERT, UPDATE, DELETE ON public.pragma_final_corpus_generation_locks FROM authenticated, anon;

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

  SELECT * INTO v_release
  FROM public.pragma_realization_pack_releases
  WHERE id = (v_readiness#>>'{requirements,attested_release,release_id}')::uuid;
  SELECT * INTO v_attestation
  FROM public.pragma_pack_manifest_attestations
  WHERE id = v_release.manifest_attestation_id;

  PERFORM pg_advisory_xact_lock(hashtextextended('pragma-final-corpus-lock:' || p_pack_id, 0));
  SELECT id INTO v_id FROM public.pragma_final_corpus_generation_locks
  WHERE pack_release_id = v_release.id;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  INSERT INTO public.pragma_final_corpus_generation_locks (
    pack_id, pack_version, pack_release_id, manifest_attestation_id,
    artifact_hash, prompt_snapshot_hash, evidence_snapshot_hash, source_commit_ref,
    scope_speech_acts, readiness_snapshot, readiness_snapshot_hash,
    rationale_ko, locked_by
  ) VALUES (
    v_release.pack_id, v_release.pack_version, v_release.id, v_attestation.id,
    v_release.artifact_hash, v_release.prompt_snapshot_hash,
    v_release.evidence_snapshot_hash, v_release.source_commit_ref,
    v_attestation.scope_speech_acts, v_readiness,
    encode(extensions.digest(convert_to(v_readiness::text, 'UTF8'), 'sha256'::text), 'hex'),
    p_rationale_ko, auth.uid()
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.lock_pragma_final_corpus_generation(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lock_pragma_final_corpus_generation(text, text) TO authenticated;

CREATE TABLE public.pragma_final_corpus_generation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_version text NOT NULL DEFAULT 'pragma_final_corpus_generation_run_v1'
    CHECK (schema_version = 'pragma_final_corpus_generation_run_v1'),
  generation_lock_id uuid NOT NULL
    REFERENCES public.pragma_final_corpus_generation_locks(id) ON DELETE RESTRICT,
  run_sequence integer NOT NULL CHECK (run_sequence > 0),
  plan_version text NOT NULL CHECK (plan_version = 'pragma_final_corpus_9act_kozh_v1_504'),
  plan_snapshot jsonb NOT NULL,
  plan_snapshot_hash text NOT NULL CHECK (plan_snapshot_hash ~ '^[0-9a-f]{64}$'),
  target_count integer NOT NULL CHECK (target_count = 504),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (generation_lock_id, run_sequence),
  UNIQUE (generation_lock_id, plan_snapshot_hash, run_sequence)
);

CREATE TABLE public.pragma_final_corpus_generation_run_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.pragma_final_corpus_generation_runs(id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK (event_type IN ('started','closed','aborted')),
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  rationale_ko text NOT NULL CHECK (length(btrim(rationale_ko)) > 0),
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX pragma_final_corpus_run_started_once_idx
  ON public.pragma_final_corpus_generation_run_events(run_id)
  WHERE event_type = 'started';
CREATE UNIQUE INDEX pragma_final_corpus_run_terminal_once_idx
  ON public.pragma_final_corpus_generation_run_events(run_id)
  WHERE event_type IN ('closed','aborted');

CREATE TRIGGER pragma_final_corpus_generation_runs_append_only
  BEFORE UPDATE OR DELETE ON public.pragma_final_corpus_generation_runs
  FOR EACH ROW EXECUTE FUNCTION public.reject_pragma_pack_manifest_attestation_mutation();
CREATE TRIGGER pragma_final_corpus_generation_run_events_append_only
  BEFORE UPDATE OR DELETE ON public.pragma_final_corpus_generation_run_events
  FOR EACH ROW EXECUTE FUNCTION public.reject_pragma_pack_manifest_attestation_mutation();

ALTER TABLE public.pragma_final_corpus_generation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pragma_final_corpus_generation_run_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY pragma_final_corpus_generation_runs_admin_read
  ON public.pragma_final_corpus_generation_runs FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY pragma_final_corpus_generation_run_events_admin_read
  ON public.pragma_final_corpus_generation_run_events FOR SELECT TO authenticated
  USING (public.is_admin());
GRANT SELECT ON public.pragma_final_corpus_generation_runs,
  public.pragma_final_corpus_generation_run_events TO authenticated, service_role;
REVOKE INSERT, UPDATE, DELETE ON public.pragma_final_corpus_generation_runs,
  public.pragma_final_corpus_generation_run_events FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.validate_pragma_final_corpus_plan(p_plan jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_known text[] := ARRAY[
    'request','refusal','apology','thanks','proposal',
    'agreement','opposition','compliment','complaint'
  ];
  v_levels text[] := ARRAY['beginner_intermediate','intermediate','advanced'];
  v_modes text[] := ARRAY['translation','stt_interpreting'];
  v_p text[] := ARRAY['equal','higher','lower'];
  v_d text[] := ARRAY['close','acquaintance','formal'];
  v_r text[] := ARRAY['low','mid','high'];
BEGIN
  IF jsonb_typeof(p_plan) <> 'object'
     OR p_plan->>'schema_version' IS DISTINCT FROM 'pragma_final_corpus_plan_v1'
     OR p_plan->>'plan_version' IS DISTINCT FROM 'pragma_final_corpus_9act_kozh_v1_504'
     OR p_plan->>'direction' IS DISTINCT FROM 'ko_zh'
     OR COALESCE((p_plan->>'target_count')::integer, 0) <> 504
     OR jsonb_typeof(p_plan->'items') <> 'array'
     OR jsonb_array_length(p_plan->'items') <> 504
  THEN RAISE EXCEPTION 'Final corpus plan must be the exact versioned 504-item ko_zh plan'; END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_plan->'items') item
    WHERE item->>'direction' <> 'ko_zh'
      OR NOT (item->>'speech_act' = ANY(v_known))
      OR NOT (item->>'level' = ANY(v_levels))
      OR NOT (item->>'domain' = ANY(ARRAY['daily','school','work']::text[]))
      OR NOT (item->>'mode' = ANY(v_modes))
      OR NOT (item->>'pdr_power' = ANY(v_p))
      OR NOT (item->>'pdr_distance' = ANY(v_d))
      OR NOT (item->>'pdr_burden' = ANY(v_r))
      OR length(btrim(COALESCE(item->>'theme_code', ''))) = 0
      OR length(btrim(COALESCE(item->>'topic_code', ''))) = 0
      OR length(btrim(COALESCE(item->>'item_key', ''))) = 0
      OR COALESCE((item->>'ordinal')::integer, -1) < 0
      OR item->>'item_key' IS DISTINCT FROM concat_ws('|',
        item->>'direction', item->>'speech_act', item->>'level', item->>'domain',
        item->>'mode', item->>'pdr_power', item->>'pdr_distance', item->>'pdr_burden',
        item->>'theme_code', item->>'topic_code', COALESCE(NULLIF(item->>'industry', ''), '-'),
        item->>'ordinal'
      )
  ) THEN RAISE EXCEPTION 'Final corpus plan contains an invalid or non-canonical item'; END IF;

  IF (SELECT count(DISTINCT item->>'item_key') FROM jsonb_array_elements(p_plan->'items') item) <> 504
     OR (SELECT count(DISTINCT (item->>'ordinal')::integer) FROM jsonb_array_elements(p_plan->'items') item) <> 504
  THEN RAISE EXCEPTION 'Final corpus plan item keys and ordinals must be unique'; END IF;

  IF EXISTS (
    SELECT act.speech_act
    FROM unnest(v_known) AS act(speech_act)
    WHERE (SELECT count(*) FROM jsonb_array_elements(p_plan->'items') item
           WHERE item->>'speech_act' = act.speech_act) <> 56
  ) THEN RAISE EXCEPTION 'Final corpus plan requires exactly 56 items per speech act'; END IF;

  IF EXISTS (
    SELECT act.speech_act, level.level, mode.mode
    FROM unnest(v_known) AS act(speech_act)
    CROSS JOIN unnest(v_levels) AS level(level)
    CROSS JOIN unnest(v_modes) AS mode(mode)
    WHERE (SELECT count(*) FROM jsonb_array_elements(p_plan->'items') item
           WHERE item->>'speech_act' = act.speech_act
             AND item->>'level' = level.level
             AND item->>'mode' = mode.mode) < 3
  ) THEN RAISE EXCEPTION 'Every speech-act, level, and mode delivery cell requires at least three items'; END IF;

  IF EXISTS (
    SELECT act.speech_act, power.power, distance.distance, burden.burden
    FROM unnest(v_known) AS act(speech_act)
    CROSS JOIN unnest(v_p) AS power(power)
    CROSS JOIN unnest(v_d) AS distance(distance)
    CROSS JOIN unnest(v_r) AS burden(burden)
    WHERE (SELECT count(*) FROM jsonb_array_elements(p_plan->'items') item
           WHERE item->>'speech_act' = act.speech_act
             AND item->>'pdr_power' = power.power
             AND item->>'pdr_distance' = distance.distance
             AND item->>'pdr_burden' = burden.burden) < 2
  ) THEN RAISE EXCEPTION 'Every speech-act by P/D/R construct cell requires at least two items'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_pragma_final_corpus_plan(jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_pragma_final_corpus_generation_run(
  p_generation_lock_id uuid,
  p_plan_snapshot jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lock public.pragma_final_corpus_generation_locks%ROWTYPE;
  v_sequence integer;
  v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only admins can create final-corpus runs'; END IF;
  PERFORM public.validate_pragma_final_corpus_plan(p_plan_snapshot);
  SELECT * INTO v_lock FROM public.pragma_final_corpus_generation_locks
  WHERE id = p_generation_lock_id;
  IF NOT FOUND OR EXISTS (
    SELECT 1 FROM public.pragma_realization_pack_releases later
    WHERE later.supersedes_release_id = v_lock.pack_release_id
  ) THEN RAISE EXCEPTION 'Generation lock is missing or its pack release is no longer current'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('pragma-final-corpus-run:' || p_generation_lock_id::text, 0));
  IF EXISTS (
    SELECT 1 FROM public.pragma_final_corpus_generation_runs run
    WHERE run.generation_lock_id = p_generation_lock_id
      AND NOT EXISTS (
        SELECT 1 FROM public.pragma_final_corpus_generation_run_events event
        WHERE event.run_id = run.id AND event.event_type IN ('closed','aborted')
      )
  ) THEN RAISE EXCEPTION 'This lock already has an open final-corpus run'; END IF;

  SELECT COALESCE(max(run_sequence), 0) + 1 INTO v_sequence
  FROM public.pragma_final_corpus_generation_runs
  WHERE generation_lock_id = p_generation_lock_id;
  INSERT INTO public.pragma_final_corpus_generation_runs (
    generation_lock_id, run_sequence, plan_version, plan_snapshot,
    plan_snapshot_hash, target_count, created_by
  ) VALUES (
    p_generation_lock_id, v_sequence, p_plan_snapshot->>'plan_version', p_plan_snapshot,
    encode(extensions.digest(convert_to(p_plan_snapshot::text, 'UTF8'), 'sha256'::text), 'hex'),
    (p_plan_snapshot->>'target_count')::integer, auth.uid()
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_pragma_final_corpus_generation_run(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_pragma_final_corpus_generation_run(uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.start_pragma_final_corpus_generation_run(
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
  v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only admins can start final-corpus runs'; END IF;
  IF length(btrim(COALESCE(p_rationale_ko, ''))) = 0 THEN RAISE EXCEPTION 'Start rationale is required'; END IF;
  SELECT * INTO v_run FROM public.pragma_final_corpus_generation_runs WHERE id = p_run_id;
  SELECT * INTO v_lock FROM public.pragma_final_corpus_generation_locks WHERE id = v_run.generation_lock_id;
  IF v_run.id IS NULL OR v_lock.id IS NULL OR EXISTS (
    SELECT 1 FROM public.pragma_realization_pack_releases later
    WHERE later.supersedes_release_id = v_lock.pack_release_id
  ) OR EXISTS (
    SELECT 1 FROM public.pragma_final_corpus_generation_run_events event
    WHERE event.run_id = p_run_id
  ) THEN RAISE EXCEPTION 'Run is missing, stale, or already started'; END IF;
  INSERT INTO public.pragma_final_corpus_generation_run_events (
    run_id, event_type, result, rationale_ko, actor_id
  ) VALUES (
    p_run_id, 'started', jsonb_build_object(
      'plan_snapshot_hash', v_run.plan_snapshot_hash,
      'pack_release_id', v_lock.pack_release_id,
      'source_commit_ref', v_lock.source_commit_ref
    ), p_rationale_ko, auth.uid()
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.start_pragma_final_corpus_generation_run(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_pragma_final_corpus_generation_run(uuid, text) TO authenticated;

ALTER TABLE public.scenarios
  ADD COLUMN dataset_class text NOT NULL DEFAULT 'test_only'
    CHECK (dataset_class IN ('test_only','final_candidate','final_release')),
  ADD COLUMN final_corpus_generation_run_id uuid
    REFERENCES public.pragma_final_corpus_generation_runs(id) ON DELETE RESTRICT,
  ADD COLUMN core_snapshot_hash text
    CHECK (core_snapshot_hash IS NULL OR core_snapshot_hash ~ '^[0-9a-f]{64}$');

UPDATE public.scenarios
SET core_snapshot_hash = encode(
  extensions.digest(convert_to(core_content::text, 'UTF8'), 'sha256'::text), 'hex'
)
WHERE core_content IS NOT NULL;

CREATE UNIQUE INDEX scenarios_final_corpus_run_item_idx
  ON public.scenarios(final_corpus_generation_run_id, generation_item_key)
  WHERE dataset_class IN ('final_candidate','final_release');
CREATE UNIQUE INDEX scenarios_final_corpus_hash_idx
  ON public.scenarios(core_snapshot_hash)
  WHERE dataset_class IN ('final_candidate','final_release');

CREATE OR REPLACE FUNCTION public.guard_pragma_scenario_dataset_class()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run public.pragma_final_corpus_generation_runs%ROWTYPE;
  v_lock public.pragma_final_corpus_generation_locks%ROWTYPE;
  v_item jsonb;
BEGIN
  IF NEW.core_content IS NOT NULL THEN
    NEW.core_snapshot_hash := encode(
      extensions.digest(convert_to(NEW.core_content::text, 'UTF8'), 'sha256'::text), 'hex'
    );
  ELSE
    NEW.core_snapshot_hash := NULL;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.dataset_class IS DISTINCT FROM OLD.dataset_class
       OR NEW.final_corpus_generation_run_id IS DISTINCT FROM OLD.final_corpus_generation_run_id
    THEN RAISE EXCEPTION 'Scenario dataset class and final-corpus run are immutable'; END IF;
    IF OLD.dataset_class IN ('final_candidate','final_release')
       AND (
         NEW.core_content IS DISTINCT FROM OLD.core_content
         OR NEW.generation_item_key IS DISTINCT FROM OLD.generation_item_key
         OR NEW.generation_run_id IS DISTINCT FROM OLD.generation_run_id
       )
    THEN RAISE EXCEPTION 'Final-corpus core identity is append-only'; END IF;
  END IF;

  IF NEW.dataset_class = 'test_only' THEN
    IF NEW.final_corpus_generation_run_id IS NOT NULL THEN
      RAISE EXCEPTION 'Test-only scenarios cannot claim a final-corpus run';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP <> 'INSERT' AND OLD.dataset_class NOT IN ('final_candidate','final_release') THEN
    RAISE EXCEPTION 'Existing test data can never be relabelled as final corpus data';
  END IF;
  -- Downstream mission/review fields may be appended after the 504-core run closes.
  -- Core identity and dataset ownership were already checked above; promotion has
  -- its own current-lock trigger below.
  IF TG_OP = 'UPDATE' THEN RETURN NEW; END IF;
  IF NEW.dataset_class = 'final_release' AND TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'Generated rows begin as final_candidate; release requires a later corpus gate';
  END IF;
  IF NEW.final_corpus_generation_run_id IS NULL OR NEW.core_content IS NULL
     OR COALESCE(NEW.prompt_snapshot_hash, '') !~ '^[0-9a-f]{64}$'
  THEN RAISE EXCEPTION 'Final candidates require a run, core content, and exact prompt hash'; END IF;

  SELECT * INTO v_run FROM public.pragma_final_corpus_generation_runs
  WHERE id = NEW.final_corpus_generation_run_id;
  SELECT * INTO v_lock FROM public.pragma_final_corpus_generation_locks
  WHERE id = v_run.generation_lock_id;
  IF v_run.id IS NULL OR v_lock.id IS NULL
     OR NEW.created_at IS NULL OR NEW.created_at < v_lock.locked_at
     OR NEW.generation_run_id IS DISTINCT FROM v_run.id::text
     OR NOT EXISTS (
       SELECT 1 FROM public.pragma_final_corpus_generation_run_events event
       WHERE event.run_id = v_run.id AND event.event_type = 'started'
     )
     OR EXISTS (
       SELECT 1 FROM public.pragma_final_corpus_generation_run_events event
       WHERE event.run_id = v_run.id AND event.event_type IN ('closed','aborted')
     )
     OR EXISTS (
       SELECT 1 FROM public.pragma_realization_pack_releases later
       WHERE later.supersedes_release_id = v_lock.pack_release_id
     )
  THEN RAISE EXCEPTION 'Final candidate requires a current, started, non-terminal lock/run'; END IF;

  SELECT item INTO v_item
  FROM jsonb_array_elements(v_run.plan_snapshot->'items') item
  WHERE item->>'item_key' = NEW.generation_item_key;
  IF v_item IS NULL
     OR NEW.language_direction IS DISTINCT FROM v_item->>'direction'
     OR NEW.speech_act::text IS DISTINCT FROM v_item->>'speech_act'
     OR NEW.learner_level IS DISTINCT FROM v_item->>'level'
     OR NEW.domain IS DISTINCT FROM v_item->>'domain'
     OR NEW.mode IS DISTINCT FROM v_item->>'mode'
     OR NEW.scenario_p IS DISTINCT FROM v_item->>'pdr_power'
     OR NEW.scenario_d IS DISTINCT FROM v_item->>'pdr_distance'
     OR NEW.scenario_r IS DISTINCT FROM v_item->>'pdr_burden'
     OR NEW.theme_code IS DISTINCT FROM v_item->>'theme_code'
     OR NEW.topic_code IS DISTINCT FROM v_item->>'topic_code'
     OR NEW.industry_sector IS DISTINCT FROM NULLIF(v_item->>'industry', '')
  THEN RAISE EXCEPTION 'Final candidate does not exactly match its locked plan item'; END IF;

  IF TG_OP = 'INSERT' AND EXISTS (
    SELECT 1 FROM public.scenarios existing
    WHERE existing.core_snapshot_hash = NEW.core_snapshot_hash
  ) THEN RAISE EXCEPTION 'Final corpus must be newly generated; an identical pre-lock/test core already exists'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_pragma_scenario_dataset_class() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_pragma_scenario_dataset_class_trg
  BEFORE INSERT OR UPDATE ON public.scenarios
  FOR EACH ROW EXECUTE FUNCTION public.guard_pragma_scenario_dataset_class();

CREATE OR REPLACE FUNCTION public.guard_pragma_final_corpus_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.dataset_class IN ('final_candidate','final_release') THEN
    RAISE EXCEPTION 'Final-corpus scenarios are append-only';
  END IF;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_pragma_final_corpus_delete() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_pragma_final_corpus_delete_trg
  BEFORE DELETE ON public.scenarios
  FOR EACH ROW EXECUTE FUNCTION public.guard_pragma_final_corpus_delete();

CREATE OR REPLACE FUNCTION public.save_final_corpus_core(
  p_run_id uuid,
  p_payload jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_core jsonb := p_payload->'core_content';
  v_meta jsonb := COALESCE(p_payload->'meta', '{}'::jsonb);
  v_channel text := v_core->>'channel';
  v_p_json text := v_core->'pdr'->>'p';
  v_d_json text := v_core->'pdr'->>'d';
  v_r text := v_core->'pdr'->>'r';
  v_genre text;
  v_p text;
  v_d text;
  v_direction text;
  v_core_hash text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only admins can save final-corpus cores'; END IF;
  IF jsonb_typeof(v_core) <> 'object'
     OR p_payload->>'auto_check_result' IS DISTINCT FROM 'pass'
     OR COALESCE(p_payload->>'prompt_snapshot_hash', '') !~ '^[0-9a-f]{64}$'
     OR length(btrim(COALESCE(v_meta->>'provider', ''))) = 0
     OR length(btrim(COALESCE(v_meta->>'model', ''))) = 0
     OR length(btrim(COALESCE(v_meta->>'prompt_version', ''))) = 0
  THEN RAISE EXCEPTION 'Final corpus requires a passing core and complete generation provenance'; END IF;

  v_genre := CASE v_channel
    WHEN 'email' THEN 'business_email'
    WHEN 'messenger' THEN 'business_messenger'
    WHEN 'facetoface' THEN 'meeting_speech'
    WHEN 'phone' THEN 'business_messenger'
    ELSE 'business_messenger' END;
  v_p := CASE v_p_json WHEN 'speaker_lower' THEN 'higher'
                       WHEN 'speaker_higher' THEN 'lower'
                       ELSE 'equal' END;
  v_d := CASE v_d_json WHEN 'distant' THEN 'formal' ELSE v_d_json END;
  v_direction := COALESCE(p_payload->>'language_direction', v_core->>'direction', 'ko_zh');
  v_core_hash := encode(
    extensions.digest(convert_to(v_core::text, 'UTF8'), 'sha256'::text), 'hex'
  );

  INSERT INTO public.scenarios (
    title, source_text, topic,
    speech_act, genre, learner_level,
    domain, industry_sector, business_function, mode,
    scenario_p, scenario_d, scenario_r,
    content_format, core_content, source_modality, theme_code, topic_code,
    language_direction,
    review_status, usage_assignment, auto_check_result,
    generation_provider, generator_model, generation_prompt_version,
    generation_run_id, generation_item_key, content_hash, prompt_snapshot_hash,
    dataset_class, final_corpus_generation_run_id, core_snapshot_hash
  ) VALUES (
    COALESCE(p_payload->>'title', v_core->>'situation_ko'),
    COALESCE(v_core->>'source_text_ko', v_core->>'source_text'),
    v_core->>'situation_ko',
    (p_payload->>'speech_act')::public.speech_act,
    v_genre, p_payload->>'learner_level', p_payload->>'domain',
    NULLIF(p_payload->>'industry_sector', ''), NULLIF(p_payload->>'business_function', ''),
    p_payload->>'mode', v_p, v_d, v_r,
    'scenario_core_v1', v_core, p_payload->>'source_modality',
    p_payload->>'theme_code', p_payload->>'topic_code', v_direction,
    'needs_review'::public.review_status, 'archived_only'::public.usage_assignment,
    'pass'::public.auto_check_result,
    v_meta->>'provider', v_meta->>'model', v_meta->>'prompt_version',
    p_run_id::text, p_payload->>'generation_item_key', v_core_hash,
    p_payload->>'prompt_snapshot_hash',
    'final_candidate', p_run_id, v_core_hash
  ) RETURNING scenario_id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.save_final_corpus_core(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_final_corpus_core(uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.close_pragma_final_corpus_generation_run(
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
  v_count bigint;
  v_item_count bigint;
  v_hash_count bigint;
  v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only admins can close final-corpus runs'; END IF;
  IF length(btrim(COALESCE(p_rationale_ko, ''))) = 0 THEN RAISE EXCEPTION 'Closure rationale is required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('pragma-final-corpus-close:' || p_run_id::text, 0));
  SELECT * INTO v_run FROM public.pragma_final_corpus_generation_runs WHERE id = p_run_id;
  SELECT * INTO v_lock FROM public.pragma_final_corpus_generation_locks WHERE id = v_run.generation_lock_id;
  IF v_run.id IS NULL OR v_lock.id IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM public.pragma_final_corpus_generation_run_events event
       WHERE event.run_id = p_run_id AND event.event_type = 'started'
     )
     OR EXISTS (
       SELECT 1 FROM public.pragma_final_corpus_generation_run_events event
       WHERE event.run_id = p_run_id AND event.event_type IN ('closed','aborted')
     )
     OR EXISTS (
       SELECT 1 FROM public.pragma_realization_pack_releases later
       WHERE later.supersedes_release_id = v_lock.pack_release_id
     )
  THEN RAISE EXCEPTION 'Run is missing, stale, unstarted, or terminal'; END IF;

  SELECT count(*), count(DISTINCT generation_item_key), count(DISTINCT core_snapshot_hash)
    INTO v_count, v_item_count, v_hash_count
  FROM public.scenarios
  WHERE final_corpus_generation_run_id = p_run_id
    AND dataset_class = 'final_candidate'
    AND auto_check_result = 'pass'
    AND core_content IS NOT NULL
    AND prompt_snapshot_hash ~ '^[0-9a-f]{64}$';
  IF v_count <> v_run.target_count OR v_item_count <> v_run.target_count
     OR v_hash_count <> v_run.target_count
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(v_run.plan_snapshot->'items') item
       WHERE NOT EXISTS (
         SELECT 1 FROM public.scenarios scenario
         WHERE scenario.final_corpus_generation_run_id = p_run_id
           AND scenario.generation_item_key = item->>'item_key'
       )
     )
  THEN RAISE EXCEPTION 'Run cannot close until all 504 fresh, unique, passing plan items exist'; END IF;

  INSERT INTO public.pragma_final_corpus_generation_run_events (
    run_id, event_type, result, rationale_ko, actor_id
  ) VALUES (
    p_run_id, 'closed', jsonb_build_object(
      'dataset_class', 'final_candidate',
      'item_count', v_count,
      'unique_item_key_count', v_item_count,
      'unique_core_hash_count', v_hash_count,
      'plan_snapshot_hash', v_run.plan_snapshot_hash,
      'pack_release_id', v_lock.pack_release_id,
      'note', 'Mission generation and release remain a separate downstream gate.'
    ), p_rationale_ko, auth.uid()
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.close_pragma_final_corpus_generation_run(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_pragma_final_corpus_generation_run(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.abort_pragma_final_corpus_generation_run(
  p_run_id uuid,
  p_rationale_ko text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only admins can abort final-corpus runs'; END IF;
  IF length(btrim(COALESCE(p_rationale_ko, ''))) = 0 THEN RAISE EXCEPTION 'Abort rationale is required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.pragma_final_corpus_generation_runs WHERE id = p_run_id)
     OR EXISTS (
       SELECT 1 FROM public.pragma_final_corpus_generation_run_events
       WHERE run_id = p_run_id AND event_type IN ('closed','aborted')
     )
  THEN RAISE EXCEPTION 'Run is missing or already terminal'; END IF;
  INSERT INTO public.pragma_final_corpus_generation_run_events (
    run_id, event_type, result, rationale_ko, actor_id
  ) VALUES (
    p_run_id, 'aborted', jsonb_build_object(
      'preserved_candidate_count', (
        SELECT count(*) FROM public.scenarios
        WHERE final_corpus_generation_run_id = p_run_id
      )
    ), p_rationale_ko, auth.uid()
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.abort_pragma_final_corpus_generation_run(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.abort_pragma_final_corpus_generation_run(uuid, text) TO authenticated;

-- Final-corpus promotion may continue only while its exact design/evidence release is current.
CREATE OR REPLACE FUNCTION public.guard_pragma_final_corpus_promotion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_release_id uuid;
BEGIN
  IF OLD.dataset_class IN ('final_candidate','final_release')
     AND OLD.mission_content IS NULL AND NEW.mission_content IS NOT NULL THEN
    SELECT lock.pack_release_id INTO v_release_id
    FROM public.pragma_final_corpus_generation_runs run
    JOIN public.pragma_final_corpus_generation_locks lock ON lock.id = run.generation_lock_id
    WHERE run.id = OLD.final_corpus_generation_run_id;
    IF v_release_id IS NULL OR EXISTS (
      SELECT 1 FROM public.pragma_realization_pack_releases later
      WHERE later.supersedes_release_id = v_release_id
    ) THEN RAISE EXCEPTION 'Final-corpus promotion is blocked because its design/evidence lock is stale'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_pragma_final_corpus_promotion() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_pragma_final_corpus_promotion_trg
  BEFORE UPDATE OF mission_content ON public.scenarios
  FOR EACH ROW EXECUTE FUNCTION public.guard_pragma_final_corpus_promotion();

CREATE OR REPLACE FUNCTION public.get_pragma_final_corpus_run_state(p_run_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run public.pragma_final_corpus_generation_runs%ROWTYPE;
  v_started timestamptz;
  v_terminal text;
  v_terminal_at timestamptz;
  v_count bigint := 0;
BEGIN
  IF NOT public.is_admin() AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Only admins or the service role can inspect final-corpus runs';
  END IF;
  SELECT * INTO v_run FROM public.pragma_final_corpus_generation_runs WHERE id = p_run_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Final-corpus run not found'; END IF;
  SELECT occurred_at INTO v_started FROM public.pragma_final_corpus_generation_run_events
  WHERE run_id = p_run_id AND event_type = 'started';
  SELECT event_type, occurred_at INTO v_terminal, v_terminal_at
  FROM public.pragma_final_corpus_generation_run_events
  WHERE run_id = p_run_id AND event_type IN ('closed','aborted') LIMIT 1;
  SELECT count(*) INTO v_count FROM public.scenarios
  WHERE final_corpus_generation_run_id = p_run_id;
  RETURN jsonb_build_object(
    'schema_version', 'pragma_final_corpus_run_state_v1',
    'run_id', v_run.id,
    'status', CASE WHEN v_terminal IS NOT NULL THEN v_terminal
                   WHEN v_started IS NOT NULL THEN 'generating' ELSE 'prepared' END,
    'target_count', v_run.target_count,
    'current_item_count', v_count,
    'remaining_item_count', greatest(v_run.target_count - v_count, 0),
    'plan_snapshot_hash', v_run.plan_snapshot_hash,
    'started_at', v_started,
    'terminal_at', v_terminal_at
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_pragma_final_corpus_run_state(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_pragma_final_corpus_run_state(uuid) TO authenticated, service_role;
