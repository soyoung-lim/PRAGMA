-- Resumable, lease-based mission generation for a closed 504-core run.
-- The browser performs the paid LLM call, but the server owns item selection,
-- retry identity, current-pack validation, and the immutable outcome trail.

CREATE TABLE public.pragma_final_corpus_mission_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_version text NOT NULL DEFAULT 'pragma_final_corpus_mission_batch_v1'
    CHECK (schema_version = 'pragma_final_corpus_mission_batch_v1'),
  generation_run_id uuid NOT NULL UNIQUE
    REFERENCES public.pragma_final_corpus_generation_runs(id) ON DELETE RESTRICT,
  target_count integer NOT NULL DEFAULT 504 CHECK (target_count = 504),
  max_item_attempts integer NOT NULL DEFAULT 3 CHECK (max_item_attempts BETWEEN 1 AND 5),
  lease_minutes integer NOT NULL DEFAULT 20 CHECK (lease_minutes BETWEEN 5 AND 60),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.pragma_final_corpus_mission_batch_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL
    REFERENCES public.pragma_final_corpus_mission_batches(id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK (event_type IN ('started','paused','resumed','completed')),
  rationale_ko text NOT NULL CHECK (length(btrim(rationale_ko)) > 0),
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX pragma_final_corpus_mission_batch_started_once_idx
  ON public.pragma_final_corpus_mission_batch_events(batch_id)
  WHERE event_type = 'started';
CREATE UNIQUE INDEX pragma_final_corpus_mission_batch_completed_once_idx
  ON public.pragma_final_corpus_mission_batch_events(batch_id)
  WHERE event_type = 'completed';

CREATE TABLE public.pragma_final_corpus_mission_item_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL
    REFERENCES public.pragma_final_corpus_mission_batches(id) ON DELETE RESTRICT,
  scenario_id uuid NOT NULL
    REFERENCES public.scenarios(scenario_id) ON DELETE RESTRICT,
  plan_ordinal integer NOT NULL CHECK (plan_ordinal >= 0 AND plan_ordinal < 504),
  attempt_no integer NOT NULL CHECK (attempt_no > 0),
  claimed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  lease_expires_at timestamptz NOT NULL,
  UNIQUE (batch_id, scenario_id, attempt_no)
);

CREATE TABLE public.pragma_final_corpus_mission_item_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL UNIQUE
    REFERENCES public.pragma_final_corpus_mission_item_claims(id) ON DELETE RESTRICT,
  result text NOT NULL CHECK (result IN ('succeeded','failed')),
  lineage_version_id uuid UNIQUE
    REFERENCES public.mission_lineage_versions(id) ON DELETE RESTRICT,
  generation_attempt_count integer CHECK (generation_attempt_count BETWEEN 0 AND 3),
  rule_result text CHECK (rule_result IN ('pass','warning')),
  quality_verdict text CHECK (quality_verdict IN ('pass','warning')),
  error_message text,
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (result = 'succeeded' AND lineage_version_id IS NOT NULL
      AND generation_attempt_count IS NOT NULL AND rule_result IS NOT NULL
      AND quality_verdict IS NOT NULL AND error_message IS NULL)
    OR
    (result = 'failed' AND lineage_version_id IS NULL
      AND error_message IS NOT NULL AND length(btrim(error_message)) > 0)
  )
);

CREATE INDEX pragma_final_corpus_mission_claims_batch_scenario_idx
  ON public.pragma_final_corpus_mission_item_claims(batch_id, scenario_id, attempt_no DESC);

CREATE TRIGGER pragma_final_corpus_mission_batches_append_only
  BEFORE UPDATE OR DELETE ON public.pragma_final_corpus_mission_batches
  FOR EACH ROW EXECUTE FUNCTION public.reject_pragma_pack_manifest_attestation_mutation();
CREATE TRIGGER pragma_final_corpus_mission_batch_events_append_only
  BEFORE UPDATE OR DELETE ON public.pragma_final_corpus_mission_batch_events
  FOR EACH ROW EXECUTE FUNCTION public.reject_pragma_pack_manifest_attestation_mutation();
CREATE TRIGGER pragma_final_corpus_mission_item_claims_append_only
  BEFORE UPDATE OR DELETE ON public.pragma_final_corpus_mission_item_claims
  FOR EACH ROW EXECUTE FUNCTION public.reject_pragma_pack_manifest_attestation_mutation();
CREATE TRIGGER pragma_final_corpus_mission_item_results_append_only
  BEFORE UPDATE OR DELETE ON public.pragma_final_corpus_mission_item_results
  FOR EACH ROW EXECUTE FUNCTION public.reject_pragma_pack_manifest_attestation_mutation();

ALTER TABLE public.pragma_final_corpus_mission_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pragma_final_corpus_mission_batch_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pragma_final_corpus_mission_item_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pragma_final_corpus_mission_item_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY pragma_final_corpus_mission_batches_admin_read
  ON public.pragma_final_corpus_mission_batches FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY pragma_final_corpus_mission_batch_events_admin_read
  ON public.pragma_final_corpus_mission_batch_events FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY pragma_final_corpus_mission_item_claims_admin_read
  ON public.pragma_final_corpus_mission_item_claims FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY pragma_final_corpus_mission_item_results_admin_read
  ON public.pragma_final_corpus_mission_item_results FOR SELECT TO authenticated USING (public.is_admin());
GRANT SELECT ON public.pragma_final_corpus_mission_batches,
  public.pragma_final_corpus_mission_batch_events,
  public.pragma_final_corpus_mission_item_claims,
  public.pragma_final_corpus_mission_item_results TO authenticated, service_role;
GRANT ALL ON public.pragma_final_corpus_mission_batches,
  public.pragma_final_corpus_mission_batch_events,
  public.pragma_final_corpus_mission_item_claims,
  public.pragma_final_corpus_mission_item_results TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.pragma_final_corpus_mission_batches,
  public.pragma_final_corpus_mission_batch_events,
  public.pragma_final_corpus_mission_item_claims,
  public.pragma_final_corpus_mission_item_results FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.prepare_pragma_final_corpus_mission_batch(
  p_generation_run_id uuid,
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
  v_batch_id uuid;
  v_latest_event text;
  v_count bigint;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only admins can prepare final mission batches'; END IF;
  IF length(btrim(COALESCE(p_rationale_ko, ''))) = 0 THEN RAISE EXCEPTION 'Batch rationale is required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('pragma-final-mission-batch:' || p_generation_run_id::text, 0));
  SELECT * INTO v_run FROM public.pragma_final_corpus_generation_runs WHERE id = p_generation_run_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Final-corpus generation run not found'; END IF;
  SELECT * INTO v_lock FROM public.pragma_final_corpus_generation_locks WHERE id = v_run.generation_lock_id;
  IF NOT EXISTS (
    SELECT 1 FROM public.pragma_final_corpus_generation_run_events event
    WHERE event.run_id = v_run.id AND event.event_type = 'closed'
  ) OR EXISTS (
    SELECT 1 FROM public.pragma_realization_pack_releases later
    WHERE later.supersedes_release_id = v_lock.pack_release_id
  ) OR EXISTS (
    SELECT 1 FROM public.pragma_final_corpus_releases release
    WHERE release.generation_run_id = v_run.id
  ) THEN RAISE EXCEPTION 'Mission batch requires a closed, current, unreleased final-corpus run'; END IF;
  SELECT count(*) INTO v_count FROM public.scenarios
  WHERE final_corpus_generation_run_id = v_run.id AND dataset_class = 'final_candidate';
  IF v_count <> v_run.target_count THEN RAISE EXCEPTION 'Mission batch requires all 504 final candidates'; END IF;

  SELECT id INTO v_batch_id FROM public.pragma_final_corpus_mission_batches
  WHERE generation_run_id = v_run.id;
  IF v_batch_id IS NULL THEN
    INSERT INTO public.pragma_final_corpus_mission_batches (
      generation_run_id, target_count, created_by
    ) VALUES (v_run.id, v_run.target_count, auth.uid())
    RETURNING id INTO v_batch_id;
  END IF;
  SELECT event_type INTO v_latest_event
  FROM public.pragma_final_corpus_mission_batch_events
  WHERE batch_id = v_batch_id ORDER BY occurred_at DESC, id DESC LIMIT 1;
  IF v_latest_event = 'completed' THEN RETURN v_batch_id; END IF;
  IF v_latest_event IS NULL THEN
    INSERT INTO public.pragma_final_corpus_mission_batch_events (
      batch_id, event_type, rationale_ko, actor_id
    ) VALUES (v_batch_id, 'started', p_rationale_ko, auth.uid());
  ELSIF v_latest_event = 'paused' THEN
    INSERT INTO public.pragma_final_corpus_mission_batch_events (
      batch_id, event_type, rationale_ko, actor_id
    ) VALUES (v_batch_id, 'resumed', p_rationale_ko, auth.uid());
  END IF;
  RETURN v_batch_id;
END;
$$;
REVOKE ALL ON FUNCTION public.prepare_pragma_final_corpus_mission_batch(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prepare_pragma_final_corpus_mission_batch(uuid, text)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.pause_pragma_final_corpus_mission_batch(
  p_batch_id uuid,
  p_rationale_ko text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_latest text;
  v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only admins can pause final mission batches'; END IF;
  IF length(btrim(COALESCE(p_rationale_ko, ''))) = 0 THEN RAISE EXCEPTION 'Pause rationale is required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('pragma-final-mission-batch:' || p_batch_id::text, 0));
  SELECT event_type INTO v_latest FROM public.pragma_final_corpus_mission_batch_events
  WHERE batch_id = p_batch_id ORDER BY occurred_at DESC, id DESC LIMIT 1;
  IF v_latest NOT IN ('started','resumed') THEN RAISE EXCEPTION 'Only an active mission batch can be paused'; END IF;
  INSERT INTO public.pragma_final_corpus_mission_batch_events (
    batch_id, event_type, rationale_ko, actor_id
  ) VALUES (p_batch_id, 'paused', p_rationale_ko, auth.uid()) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.pause_pragma_final_corpus_mission_batch(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pause_pragma_final_corpus_mission_batch(uuid, text)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.claim_pragma_final_corpus_mission_item(p_batch_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch public.pragma_final_corpus_mission_batches%ROWTYPE;
  v_latest text;
  v_scenario public.scenarios%ROWTYPE;
  v_scenario_id uuid;
  v_ordinal integer;
  v_attempt integer;
  v_claim_id uuid;
  v_remaining bigint;
  v_exhausted bigint;
  v_active bigint;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only admins can claim final mission items'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('pragma-final-mission-claim:' || p_batch_id::text, 0));
  SELECT * INTO v_batch FROM public.pragma_final_corpus_mission_batches WHERE id = p_batch_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Final mission batch not found'; END IF;
  SELECT event_type INTO v_latest FROM public.pragma_final_corpus_mission_batch_events
  WHERE batch_id = p_batch_id ORDER BY occurred_at DESC, id DESC LIMIT 1;
  IF v_latest NOT IN ('started','resumed') THEN RAISE EXCEPTION 'Final mission batch is not active'; END IF;

  SELECT scenario.scenario_id, (plan_item->>'ordinal')::integer INTO v_scenario_id, v_ordinal
  FROM public.pragma_final_corpus_generation_runs run
  CROSS JOIN LATERAL jsonb_array_elements(run.plan_snapshot->'items') plan_item
  JOIN public.scenarios scenario
    ON scenario.final_corpus_generation_run_id = run.id
   AND scenario.generation_item_key = plan_item->>'item_key'
  WHERE run.id = v_batch.generation_run_id
    AND scenario.dataset_class = 'final_candidate'
    AND scenario.mission_content IS NULL
    AND (
      SELECT count(*) FROM public.pragma_final_corpus_mission_item_claims claim
      WHERE claim.batch_id = v_batch.id AND claim.scenario_id = scenario.scenario_id
    ) < v_batch.max_item_attempts
    AND NOT EXISTS (
      SELECT 1 FROM public.pragma_final_corpus_mission_item_claims claim
      LEFT JOIN public.pragma_final_corpus_mission_item_results result ON result.claim_id = claim.id
      WHERE claim.batch_id = v_batch.id AND claim.scenario_id = scenario.scenario_id
        AND result.id IS NULL AND claim.lease_expires_at > now()
    )
  ORDER BY (plan_item->>'ordinal')::integer
  LIMIT 1
  FOR UPDATE OF scenario SKIP LOCKED;

  IF v_scenario_id IS NULL THEN
    SELECT count(*) INTO v_remaining FROM public.scenarios
    WHERE final_corpus_generation_run_id = v_batch.generation_run_id
      AND dataset_class = 'final_candidate' AND mission_content IS NULL;
    SELECT count(*) INTO v_active
    FROM public.pragma_final_corpus_mission_item_claims claim
    LEFT JOIN public.pragma_final_corpus_mission_item_results result ON result.claim_id = claim.id
    WHERE claim.batch_id = v_batch.id AND result.id IS NULL AND claim.lease_expires_at > now();
    SELECT count(*) INTO v_exhausted
    FROM public.scenarios scenario
    WHERE scenario.final_corpus_generation_run_id = v_batch.generation_run_id
      AND scenario.dataset_class = 'final_candidate' AND scenario.mission_content IS NULL
      AND (
        SELECT count(*) FROM public.pragma_final_corpus_mission_item_claims claim
        WHERE claim.batch_id = v_batch.id AND claim.scenario_id = scenario.scenario_id
      ) >= v_batch.max_item_attempts;
    RETURN jsonb_build_object(
      'schema_version', 'pragma_final_corpus_mission_claim_v1',
      'done', v_remaining = 0,
      'waiting', v_remaining > 0 AND v_active > 0 AND v_exhausted = 0,
      'blocked', v_exhausted > 0,
      'remaining_count', v_remaining,
      'active_lease_count', v_active,
      'exhausted_count', v_exhausted
    );
  END IF;

  SELECT * INTO v_scenario FROM public.scenarios WHERE scenario_id = v_scenario_id;

  SELECT count(*) + 1 INTO v_attempt
  FROM public.pragma_final_corpus_mission_item_claims claim
  WHERE claim.batch_id = v_batch.id AND claim.scenario_id = v_scenario.scenario_id;
  INSERT INTO public.pragma_final_corpus_mission_item_claims (
    batch_id, scenario_id, plan_ordinal, attempt_no, claimed_by, lease_expires_at
  ) VALUES (
    v_batch.id, v_scenario.scenario_id, v_ordinal, v_attempt, auth.uid(),
    now() + make_interval(mins => v_batch.lease_minutes)
  ) RETURNING id INTO v_claim_id;
  RETURN jsonb_build_object(
    'schema_version', 'pragma_final_corpus_mission_claim_v1',
    'done', false,
    'waiting', false,
    'blocked', false,
    'claim_id', v_claim_id,
    'attempt_no', v_attempt,
    'plan_ordinal', v_ordinal,
    'lease_minutes', v_batch.lease_minutes,
    'core', jsonb_build_object(
      'scenario_id', v_scenario.scenario_id,
      'speech_act', v_scenario.speech_act,
      'learner_level', v_scenario.learner_level,
      'domain', v_scenario.domain,
      'industry_sector', v_scenario.industry_sector,
      'mode', v_scenario.mode,
      'source_modality', v_scenario.source_modality,
      'theme_code', v_scenario.theme_code,
      'topic_code', v_scenario.topic_code,
      'language_direction', v_scenario.language_direction,
      'core_content', v_scenario.core_content
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION public.claim_pragma_final_corpus_mission_item(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_pragma_final_corpus_mission_item(uuid)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.record_pragma_final_corpus_mission_item_result(
  p_claim_id uuid,
  p_result text,
  p_generation_attempt_count integer DEFAULT NULL,
  p_rule_result text DEFAULT NULL,
  p_quality_verdict text DEFAULT NULL,
  p_error_message text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claim public.pragma_final_corpus_mission_item_claims%ROWTYPE;
  v_batch public.pragma_final_corpus_mission_batches%ROWTYPE;
  v_lock public.pragma_final_corpus_generation_locks%ROWTYPE;
  v_lineage public.mission_lineage_versions%ROWTYPE;
  v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only admins can record final mission results'; END IF;
  SELECT result.id INTO v_id FROM public.pragma_final_corpus_mission_item_results result
  WHERE result.claim_id = p_claim_id;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  SELECT * INTO v_claim FROM public.pragma_final_corpus_mission_item_claims WHERE id = p_claim_id;
  IF NOT FOUND OR v_claim.claimed_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Mission claim is missing or belongs to another actor';
  END IF;
  SELECT * INTO v_batch FROM public.pragma_final_corpus_mission_batches WHERE id = v_claim.batch_id;
  SELECT lock.* INTO v_lock
  FROM public.pragma_final_corpus_generation_runs run
  JOIN public.pragma_final_corpus_generation_locks lock ON lock.id = run.generation_lock_id
  WHERE run.id = v_batch.generation_run_id;

  IF p_result = 'succeeded' THEN
    SELECT lineage.* INTO v_lineage
    FROM public.mission_lineage_versions lineage
    WHERE lineage.scenario_id = v_claim.scenario_id
      AND lineage.stage = 'generated'
      AND lineage.created_at >= v_claim.claimed_at
    ORDER BY lineage.version_no DESC LIMIT 1;
    IF v_lineage.id IS NULL OR v_lineage.actor_id IS DISTINCT FROM auth.uid()
       OR v_lineage.coverage_status <> 'covered'
       OR v_lineage.realization_pack_id IS DISTINCT FROM v_lock.pack_id
       OR v_lineage.realization_pack_version IS DISTINCT FROM v_lock.pack_version
       OR COALESCE(v_lineage.mission_content_hash, '') !~ '^[0-9a-f]{64}$'
       OR COALESCE(v_lineage.prompt_snapshot_hash, '') !~ '^[0-9a-f]{64}$'
       OR v_lineage.item_lineage IS NULL
    THEN RAISE EXCEPTION 'Successful batch result requires the exact covered generated lineage under the locked pack'; END IF;
    INSERT INTO public.pragma_final_corpus_mission_item_results (
      claim_id, result, lineage_version_id, generation_attempt_count,
      rule_result, quality_verdict, actor_id
    ) VALUES (
      p_claim_id, 'succeeded', v_lineage.id, p_generation_attempt_count,
      p_rule_result, p_quality_verdict, auth.uid()
    ) RETURNING id INTO v_id;
  ELSIF p_result = 'failed' THEN
    INSERT INTO public.pragma_final_corpus_mission_item_results (
      claim_id, result, error_message, actor_id
    ) VALUES (p_claim_id, 'failed', p_error_message, auth.uid()) RETURNING id INTO v_id;
  ELSE
    RAISE EXCEPTION 'Mission item result must be succeeded or failed';
  END IF;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.record_pragma_final_corpus_mission_item_result(uuid, text, integer, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_pragma_final_corpus_mission_item_result(uuid, text, integer, text, text, text)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_pragma_final_corpus_mission_batch_state(p_batch_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch public.pragma_final_corpus_mission_batches%ROWTYPE;
  v_latest text;
  v_generated bigint;
  v_success bigint;
  v_failed bigint;
  v_active bigint;
  v_exhausted bigint;
BEGIN
  IF NOT public.is_admin() AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Only admins or the service role can inspect final mission batches';
  END IF;
  SELECT * INTO v_batch FROM public.pragma_final_corpus_mission_batches WHERE id = p_batch_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Final mission batch not found'; END IF;
  SELECT event_type INTO v_latest FROM public.pragma_final_corpus_mission_batch_events
  WHERE batch_id = p_batch_id ORDER BY occurred_at DESC, id DESC LIMIT 1;
  SELECT count(*) INTO v_generated FROM public.scenarios
  WHERE final_corpus_generation_run_id = v_batch.generation_run_id AND mission_content IS NOT NULL;
  SELECT count(*) FILTER (WHERE result.result = 'succeeded'),
         count(*) FILTER (WHERE result.result = 'failed')
    INTO v_success, v_failed
  FROM public.pragma_final_corpus_mission_item_results result
  JOIN public.pragma_final_corpus_mission_item_claims claim ON claim.id = result.claim_id
  WHERE claim.batch_id = v_batch.id;
  SELECT count(*) INTO v_active
  FROM public.pragma_final_corpus_mission_item_claims claim
  LEFT JOIN public.pragma_final_corpus_mission_item_results result ON result.claim_id = claim.id
  WHERE claim.batch_id = v_batch.id AND result.id IS NULL AND claim.lease_expires_at > now();
  SELECT count(*) INTO v_exhausted FROM public.scenarios scenario
  WHERE scenario.final_corpus_generation_run_id = v_batch.generation_run_id
    AND scenario.mission_content IS NULL
    AND (SELECT count(*) FROM public.pragma_final_corpus_mission_item_claims claim
         WHERE claim.batch_id = v_batch.id AND claim.scenario_id = scenario.scenario_id) >= v_batch.max_item_attempts;
  RETURN jsonb_build_object(
    'schema_version', 'pragma_final_corpus_mission_batch_state_v1',
    'batch_id', v_batch.id,
    'generation_run_id', v_batch.generation_run_id,
    'status', COALESCE(v_latest, 'prepared'),
    'target_count', v_batch.target_count,
    'generated_count', v_generated,
    'remaining_count', greatest(v_batch.target_count - v_generated, 0),
    'succeeded_claim_count', v_success,
    'failed_attempt_count', v_failed,
    'active_lease_count', v_active,
    'exhausted_item_count', v_exhausted,
    'max_item_attempts', v_batch.max_item_attempts,
    'lease_minutes', v_batch.lease_minutes
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_pragma_final_corpus_mission_batch_state(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_pragma_final_corpus_mission_batch_state(uuid)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.complete_pragma_final_corpus_mission_batch(
  p_batch_id uuid,
  p_rationale_ko text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch public.pragma_final_corpus_mission_batches%ROWTYPE;
  v_generated bigint;
  v_succeeded bigint;
  v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only admins can complete final mission batches'; END IF;
  IF length(btrim(COALESCE(p_rationale_ko, ''))) = 0 THEN RAISE EXCEPTION 'Completion rationale is required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('pragma-final-mission-batch:' || p_batch_id::text, 0));
  SELECT * INTO v_batch FROM public.pragma_final_corpus_mission_batches WHERE id = p_batch_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Final mission batch not found'; END IF;
  SELECT count(*) INTO v_generated FROM public.scenarios
  WHERE final_corpus_generation_run_id = v_batch.generation_run_id
    AND dataset_class = 'final_candidate' AND mission_content IS NOT NULL;
  SELECT count(DISTINCT claim.scenario_id) INTO v_succeeded
  FROM public.pragma_final_corpus_mission_item_results result
  JOIN public.pragma_final_corpus_mission_item_claims claim ON claim.id = result.claim_id
  WHERE claim.batch_id = v_batch.id AND result.result = 'succeeded';
  IF v_generated <> v_batch.target_count OR v_succeeded <> v_batch.target_count THEN
    RAISE EXCEPTION 'Mission batch cannot complete until all 504 claimed items succeed';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.pragma_final_corpus_mission_item_claims claim
    LEFT JOIN public.pragma_final_corpus_mission_item_results result ON result.claim_id = claim.id
    WHERE claim.batch_id = v_batch.id AND result.id IS NULL AND claim.lease_expires_at > now()
  ) THEN RAISE EXCEPTION 'Mission batch cannot complete with active leases'; END IF;
  INSERT INTO public.pragma_final_corpus_mission_batch_events (
    batch_id, event_type, rationale_ko, actor_id
  ) VALUES (v_batch.id, 'completed', p_rationale_ko, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.complete_pragma_final_corpus_mission_batch(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_pragma_final_corpus_mission_batch(uuid, text)
  TO authenticated, service_role;

-- Final candidates may receive their first mission only while the caller owns
-- a live server claim. Non-final cores retain the existing manual path.
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
    IF NOT EXISTS (
      SELECT 1 FROM public.pragma_final_corpus_mission_item_claims claim
      JOIN public.pragma_final_corpus_mission_batches batch ON batch.id = claim.batch_id
      LEFT JOIN public.pragma_final_corpus_mission_item_results result ON result.claim_id = claim.id
      WHERE batch.generation_run_id = OLD.final_corpus_generation_run_id
        AND claim.scenario_id = OLD.scenario_id
        AND claim.claimed_by = auth.uid()
        AND claim.lease_expires_at > now()
        AND result.id IS NULL
        AND (SELECT event.event_type FROM public.pragma_final_corpus_mission_batch_events event
             WHERE event.batch_id = batch.id ORDER BY event.occurred_at DESC, event.id DESC LIMIT 1)
            IN ('started','resumed')
    ) THEN RAISE EXCEPTION 'Final-corpus mission promotion requires a live server lease owned by the caller'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_pragma_final_corpus_promotion() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.validate_pragma_final_corpus_generated_lineage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scenario public.scenarios%ROWTYPE;
  v_lock public.pragma_final_corpus_generation_locks%ROWTYPE;
BEGIN
  IF NEW.stage <> 'generated' THEN RETURN NEW; END IF;
  SELECT * INTO v_scenario FROM public.scenarios WHERE scenario_id = NEW.scenario_id;
  IF v_scenario.dataset_class <> 'final_candidate' THEN RETURN NEW; END IF;
  SELECT lock.* INTO v_lock
  FROM public.pragma_final_corpus_generation_runs run
  JOIN public.pragma_final_corpus_generation_locks lock ON lock.id = run.generation_lock_id
  WHERE run.id = v_scenario.final_corpus_generation_run_id;
  IF NEW.coverage_status <> 'covered'
     OR NEW.realization_pack_id IS DISTINCT FROM v_lock.pack_id
     OR NEW.realization_pack_version IS DISTINCT FROM v_lock.pack_version
     OR COALESCE(NEW.mission_content_hash, '') !~ '^[0-9a-f]{64}$'
     OR COALESCE(NEW.prompt_snapshot_hash, '') !~ '^[0-9a-f]{64}$'
     OR NEW.item_lineage IS NULL
  THEN RAISE EXCEPTION 'Final-corpus generated lineage must preserve exact locked pack, hashes, and item lineage'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_pragma_final_corpus_generated_lineage() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER validate_pragma_final_corpus_generated_lineage_trg
  BEFORE INSERT ON public.mission_lineage_versions
  FOR EACH ROW EXECUTE FUNCTION public.validate_pragma_final_corpus_generated_lineage();
