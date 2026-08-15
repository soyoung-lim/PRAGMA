-- Authoritative corpus-level release for the locked 504-item PRAGMA bank.
-- Individual mission release remains the unit gate. This migration adds the
-- all-or-nothing corpus gate: every locked core must have an exact released
-- lineage before any row can be called final_release.

CREATE TABLE public.pragma_final_corpus_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_version text NOT NULL DEFAULT 'pragma_final_corpus_release_v1'
    CHECK (schema_version = 'pragma_final_corpus_release_v1'),
  generation_run_id uuid NOT NULL UNIQUE
    REFERENCES public.pragma_final_corpus_generation_runs(id) ON DELETE RESTRICT,
  generation_lock_id uuid NOT NULL
    REFERENCES public.pragma_final_corpus_generation_locks(id) ON DELETE RESTRICT,
  pack_release_id uuid NOT NULL
    REFERENCES public.pragma_realization_pack_releases(id) ON DELETE RESTRICT,
  item_count integer NOT NULL CHECK (item_count = 504),
  manifest_snapshot jsonb NOT NULL,
  manifest_snapshot_hash text NOT NULL CHECK (manifest_snapshot_hash ~ '^[0-9a-f]{64}$'),
  rationale_ko text NOT NULL CHECK (length(btrim(rationale_ko)) > 0),
  released_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  released_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (generation_lock_id, manifest_snapshot_hash)
);

CREATE TABLE public.pragma_final_corpus_release_items (
  release_id uuid NOT NULL
    REFERENCES public.pragma_final_corpus_releases(id) ON DELETE RESTRICT,
  ordinal integer NOT NULL CHECK (ordinal >= 0 AND ordinal < 504),
  scenario_id uuid NOT NULL UNIQUE
    REFERENCES public.scenarios(scenario_id) ON DELETE RESTRICT,
  generation_item_key text NOT NULL,
  core_snapshot_hash text NOT NULL CHECK (core_snapshot_hash ~ '^[0-9a-f]{64}$'),
  released_lineage_version_id uuid NOT NULL UNIQUE
    REFERENCES public.mission_lineage_versions(id) ON DELETE RESTRICT,
  mission_content_hash text NOT NULL CHECK (mission_content_hash ~ '^[0-9a-f]{64}$'),
  mission_prompt_snapshot_hash text NOT NULL CHECK (mission_prompt_snapshot_hash ~ '^[0-9a-f]{64}$'),
  release_resolution_id uuid NOT NULL UNIQUE
    REFERENCES public.mission_review_resolutions(id) ON DELETE RESTRICT,
  gold_regression_run_id uuid NOT NULL
    REFERENCES public.pragma_gold_regression_runs(id) ON DELETE RESTRICT,
  PRIMARY KEY (release_id, ordinal),
  UNIQUE (release_id, generation_item_key),
  UNIQUE (release_id, core_snapshot_hash),
  UNIQUE (release_id, mission_content_hash)
);

CREATE TRIGGER pragma_final_corpus_releases_append_only
  BEFORE UPDATE OR DELETE ON public.pragma_final_corpus_releases
  FOR EACH ROW EXECUTE FUNCTION public.reject_pragma_pack_manifest_attestation_mutation();
CREATE TRIGGER pragma_final_corpus_release_items_append_only
  BEFORE UPDATE OR DELETE ON public.pragma_final_corpus_release_items
  FOR EACH ROW EXECUTE FUNCTION public.reject_pragma_pack_manifest_attestation_mutation();

ALTER TABLE public.pragma_final_corpus_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pragma_final_corpus_release_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY pragma_final_corpus_releases_admin_read
  ON public.pragma_final_corpus_releases FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY pragma_final_corpus_release_items_admin_read
  ON public.pragma_final_corpus_release_items FOR SELECT TO authenticated
  USING (public.is_admin());
GRANT SELECT ON public.pragma_final_corpus_releases,
  public.pragma_final_corpus_release_items TO authenticated, service_role;
GRANT ALL ON public.pragma_final_corpus_releases,
  public.pragma_final_corpus_release_items TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.pragma_final_corpus_releases,
  public.pragma_final_corpus_release_items FROM authenticated, anon;

ALTER TABLE public.scenarios
  ADD COLUMN final_corpus_release_id uuid
    REFERENCES public.pragma_final_corpus_releases(id) ON DELETE RESTRICT;

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
  v_released_pointer_count bigint := 0;
  v_authoritative_count bigint := 0;
  v_existing_release_id uuid;
  v_allowed boolean;
BEGIN
  IF NOT public.is_admin() AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Only admins or the service role can inspect final-corpus release readiness';
  END IF;
  SELECT * INTO v_run FROM public.pragma_final_corpus_generation_runs WHERE id = p_run_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Final-corpus generation run not found'; END IF;
  SELECT * INTO v_lock FROM public.pragma_final_corpus_generation_locks
  WHERE id = v_run.generation_lock_id;

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
         count(*) FILTER (WHERE mission_content IS NOT NULL),
         count(*) FILTER (
           WHERE mission_status = 'released' AND released_lineage_version_id IS NOT NULL
         )
    INTO v_item_count, v_item_key_count, v_core_hash_count,
         v_generated_count, v_released_pointer_count
  FROM public.scenarios
  WHERE final_corpus_generation_run_id = p_run_id
    AND dataset_class IN ('final_candidate','final_release');

  SELECT count(*) INTO v_authoritative_count
  FROM public.scenarios scenario
  JOIN public.mission_lineage_versions lineage
    ON lineage.id = scenario.released_lineage_version_id
   AND lineage.scenario_id = scenario.scenario_id
   AND lineage.stage = 'released'
  JOIN public.mission_review_resolutions resolution
    ON resolution.id = lineage.release_resolution_id
   AND resolution.final_verdict = 'approve'
   AND resolution.resolution_status IN ('unanimous','consensus_after_discussion')
  JOIN public.pragma_gold_regression_runs regression
    ON regression.id = lineage.gold_regression_run_id
   AND regression.gate_status = 'pass'
  WHERE scenario.final_corpus_generation_run_id = p_run_id
    AND scenario.dataset_class IN ('final_candidate','final_release')
    AND scenario.mission_status = 'released'
    AND scenario.mission_content = lineage.mission_content
    AND lineage.coverage_status = 'covered'
    AND lineage.realization_pack_id = v_lock.pack_id
    AND lineage.realization_pack_version = v_lock.pack_version
    AND regression.realization_pack_id = v_lock.pack_id
    AND regression.realization_pack_version = v_lock.pack_version
    AND COALESCE(lineage.mission_content_hash, '') ~ '^[0-9a-f]{64}$'
    AND COALESCE(lineage.prompt_snapshot_hash, '') ~ '^[0-9a-f]{64}$'
    AND lineage.item_lineage IS NOT NULL;

  SELECT id INTO v_existing_release_id
  FROM public.pragma_final_corpus_releases WHERE generation_run_id = p_run_id;
  v_allowed := v_closed AND v_current_pack
    AND v_item_count = v_run.target_count
    AND v_item_key_count = v_run.target_count
    AND v_core_hash_count = v_run.target_count
    AND v_generated_count = v_run.target_count
    AND v_released_pointer_count = v_run.target_count
    AND v_authoritative_count = v_run.target_count
    AND v_existing_release_id IS NULL;

  RETURN jsonb_build_object(
    'schema_version', 'pragma_final_corpus_release_readiness_v1',
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
        'passed', v_generated_count = v_run.target_count,
        'count', v_generated_count
      ),
      'missions_individually_released', jsonb_build_object(
        'passed', v_released_pointer_count = v_run.target_count,
        'count', v_released_pointer_count
      ),
      'authoritative_lineage_bundle', jsonb_build_object(
        'passed', v_authoritative_count = v_run.target_count,
        'count', v_authoritative_count
      ),
      'not_previously_released', jsonb_build_object('passed', v_existing_release_id IS NULL)
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_pragma_final_corpus_release_readiness(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_pragma_final_corpus_release_readiness(uuid)
  TO authenticated, service_role;

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
    IF NEW.final_corpus_generation_run_id IS DISTINCT FROM OLD.final_corpus_generation_run_id
    THEN RAISE EXCEPTION 'Final-corpus run ownership is immutable'; END IF;
    IF NEW.dataset_class IS DISTINCT FROM OLD.dataset_class AND NOT (
      OLD.dataset_class = 'final_candidate'
      AND NEW.dataset_class = 'final_release'
      AND OLD.final_corpus_release_id IS NULL
      AND NEW.final_corpus_release_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.pragma_final_corpus_release_items item
        WHERE item.release_id = NEW.final_corpus_release_id
          AND item.scenario_id = NEW.scenario_id
      )
    ) THEN RAISE EXCEPTION 'Scenario dataset class may change only through the authoritative corpus release'; END IF;
    IF NEW.final_corpus_release_id IS DISTINCT FROM OLD.final_corpus_release_id
       AND NOT (OLD.dataset_class = 'final_candidate' AND NEW.dataset_class = 'final_release')
    THEN RAISE EXCEPTION 'Final-corpus release pointer is immutable'; END IF;
    IF OLD.dataset_class IN ('final_candidate','final_release')
       AND (
         NEW.core_content IS DISTINCT FROM OLD.core_content
         OR NEW.generation_item_key IS DISTINCT FROM OLD.generation_item_key
         OR NEW.generation_run_id IS DISTINCT FROM OLD.generation_run_id
       )
    THEN RAISE EXCEPTION 'Final-corpus core identity is append-only'; END IF;
  END IF;

  IF NEW.dataset_class = 'test_only' THEN
    IF NEW.final_corpus_generation_run_id IS NOT NULL OR NEW.final_corpus_release_id IS NOT NULL THEN
      RAISE EXCEPTION 'Test-only scenarios cannot claim a final-corpus run or release';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP <> 'INSERT' AND OLD.dataset_class NOT IN ('final_candidate','final_release') THEN
    RAISE EXCEPTION 'Existing test data can never be relabelled as final corpus data';
  END IF;
  IF NEW.dataset_class = 'final_candidate' AND NEW.final_corpus_release_id IS NOT NULL THEN
    RAISE EXCEPTION 'Final candidates cannot claim a corpus release';
  END IF;
  IF NEW.dataset_class = 'final_release' THEN
    IF TG_OP = 'INSERT' THEN
      RAISE EXCEPTION 'Generated rows begin as final_candidate; release requires the corpus gate';
    END IF;
    IF NEW.final_corpus_release_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.pragma_final_corpus_release_items item
      WHERE item.release_id = NEW.final_corpus_release_id
        AND item.scenario_id = NEW.scenario_id
        AND item.released_lineage_version_id = NEW.released_lineage_version_id
    ) THEN RAISE EXCEPTION 'Final release requires exact immutable corpus membership'; END IF;
    RETURN NEW;
  END IF;

  -- Downstream mission/review fields may be appended after the 504-core run closes.
  IF TG_OP = 'UPDATE' THEN RETURN NEW; END IF;
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

  IF EXISTS (
    SELECT 1 FROM public.scenarios existing
    WHERE existing.core_snapshot_hash = NEW.core_snapshot_hash
  ) THEN RAISE EXCEPTION 'Final corpus must be newly generated; an identical pre-lock/test core already exists'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_pragma_scenario_dataset_class() FROM PUBLIC, anon, authenticated;

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
  v_manifest jsonb;
  v_manifest_hash text;
  v_release_id uuid;
  v_updated integer;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only admins can release the final corpus'; END IF;
  IF length(btrim(COALESCE(p_rationale_ko, ''))) = 0 THEN
    RAISE EXCEPTION 'Final-corpus release rationale is required';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('pragma-final-corpus-release:' || p_run_id::text, 0));
  SELECT * INTO v_run FROM public.pragma_final_corpus_generation_runs WHERE id = p_run_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Final-corpus generation run not found'; END IF;
  SELECT * INTO v_lock FROM public.pragma_final_corpus_generation_locks
  WHERE id = v_run.generation_lock_id;
  v_readiness := public.get_pragma_final_corpus_release_readiness(p_run_id);
  IF COALESCE((v_readiness->>'release_allowed')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'All 504 exact cores and authoritative released missions are required before final release';
  END IF;

  SELECT jsonb_build_object(
    'schema_version', 'pragma_final_corpus_manifest_v1',
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
      'release_resolution_id', lineage.release_resolution_id,
      'gold_regression_run_id', lineage.gold_regression_run_id
    ) ORDER BY (plan_item->>'ordinal')::integer)
  ) INTO v_manifest
  FROM jsonb_array_elements(v_run.plan_snapshot->'items') plan_item
  JOIN public.scenarios scenario
    ON scenario.final_corpus_generation_run_id = v_run.id
   AND scenario.generation_item_key = plan_item->>'item_key'
  JOIN public.mission_lineage_versions lineage
    ON lineage.id = scenario.released_lineage_version_id;

  IF jsonb_array_length(v_manifest->'items') <> v_run.target_count THEN
    RAISE EXCEPTION 'Final-corpus manifest is incomplete';
  END IF;
  v_manifest_hash := encode(
    extensions.digest(convert_to(v_manifest::text, 'UTF8'), 'sha256'::text), 'hex'
  );

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
    release_resolution_id, gold_regression_run_id
  )
  SELECT v_release_id, (plan_item->>'ordinal')::integer, scenario.scenario_id,
         scenario.generation_item_key, scenario.core_snapshot_hash,
         lineage.id, lineage.mission_content_hash, lineage.prompt_snapshot_hash,
         lineage.release_resolution_id, lineage.gold_regression_run_id
  FROM jsonb_array_elements(v_run.plan_snapshot->'items') plan_item
  JOIN public.scenarios scenario
    ON scenario.final_corpus_generation_run_id = v_run.id
   AND scenario.generation_item_key = plan_item->>'item_key'
  JOIN public.mission_lineage_versions lineage
    ON lineage.id = scenario.released_lineage_version_id
  ORDER BY (plan_item->>'ordinal')::integer;

  UPDATE public.scenarios
  SET dataset_class = 'final_release', final_corpus_release_id = v_release_id
  WHERE final_corpus_generation_run_id = p_run_id
    AND dataset_class = 'final_candidate';
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

