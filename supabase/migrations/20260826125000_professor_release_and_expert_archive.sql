-- Retire the incorrect expert content-approval path without deleting any history.
-- Current release ends at professor finalization; legacy expert records remain readable
-- for audit but all authenticated application write paths are frozen.

-- Covered lineages must no longer opt scenarios into the retired expert gate.
DROP TRIGGER IF EXISTS mark_covered_mission_release_gate_trg
  ON public.mission_lineage_versions;

-- Learners may use a professor-finalized reviewed mission. Historical released rows and
-- legacy reviewed rows remain compatible, and course publication/profile checks stay intact.
DROP POLICY IF EXISTS scenarios_learner_select_released_course_mission ON public.scenarios;
CREATE POLICY scenarios_learner_select_professor_reviewed_course_mission
  ON public.scenarios FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (
      content_format = 'scenario_core_v1'
      AND public.has_completed_learner_profile()
      AND (
        mission_status = 'released'
        OR (
          mission_status = 'reviewed'
          AND (
            release_gate_mode = 'legacy_reviewed'
            OR mission_content->'authoring'->>'stage' = 'professor_finalized'
          )
        )
      )
      AND EXISTS (
        SELECT 1
        FROM public.curriculum_week_scenarios assignment
        JOIN public.curriculum_outlines outline ON outline.id = assignment.outline_id
        WHERE assignment.scenario_id = scenarios.scenario_id
          AND outline.status = 'published'
      )
    )
  );

-- Learner events may bind to the exact professor-finalized reviewed lineage as well as a
-- historical released lineage. Covered drafts remain blocked.
CREATE OR REPLACE FUNCTION public.reject_unreleased_covered_learner_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.lineage_version_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.mission_lineage_versions lineage
    WHERE lineage.id = NEW.lineage_version_id
      AND lineage.coverage_status = 'covered'
      AND NOT (
        lineage.stage = 'released'
        OR (
          lineage.stage = 'reviewed'
          AND lineage.mission_content->'authoring'->>'stage' = 'professor_finalized'
          AND EXISTS (
            SELECT 1
            FROM public.scenarios scenario
            WHERE scenario.scenario_id = lineage.scenario_id
              AND scenario.mission_status = 'reviewed'
              AND scenario.mission_content = lineage.mission_content
          )
        )
      )
  ) THEN
    RAISE EXCEPTION 'covered learner events require the exact professor-finalized or historical released lineage';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.reject_unreleased_covered_learner_event() FROM PUBLIC;

-- Preserve expert tables and SELECT policies, but remove every authenticated write policy.
DROP POLICY IF EXISTS "admin_manage_expert_assignments"
  ON public.mission_expert_review_assignments;
DROP POLICY IF EXISTS "admin_read_expert_assignments_archive"
  ON public.mission_expert_review_assignments;
CREATE POLICY "admin_read_expert_assignments_archive"
  ON public.mission_expert_review_assignments FOR SELECT TO authenticated
  USING (public.is_admin());
DROP POLICY IF EXISTS "reviewer_submit_assigned_review"
  ON public.mission_expert_reviews;
DROP POLICY IF EXISTS "admin_insert_review_resolutions"
  ON public.mission_review_resolutions;
DROP POLICY IF EXISTS "reviewer_insert_resolution_signoff"
  ON public.mission_review_resolution_signoffs;
DROP POLICY IF EXISTS gold_expert_review_submit
  ON public.pragma_gold_expert_reviews;
DROP POLICY IF EXISTS gold_expert_signoff_insert
  ON public.pragma_gold_expert_resolution_signoffs;

REVOKE INSERT, UPDATE, DELETE ON
  public.pragma_expert_registry_versions,
  public.mission_expert_review_assignments,
  public.mission_expert_reviews,
  public.mission_review_resolutions,
  public.mission_review_resolution_signoffs,
  public.pragma_gold_expert_review_assignments,
  public.pragma_gold_expert_reviews,
  public.pragma_gold_expert_resolutions,
  public.pragma_gold_expert_resolution_signoffs,
  public.pragma_gold_external_sampling_plans,
  public.pragma_gold_nonconsensus_terminals
FROM authenticated, anon;

-- Freeze every current overload of retired expert/publication/improvement RPCs for
-- application users. Definitions remain available to the owner/service role for audit.
DO $freeze_retired_rpcs$
DECLARE
  v_function record;
BEGIN
  FOR v_function IN
    SELECT format(
      '%I.%I(%s)',
      namespace.nspname,
      procedure.proname,
      pg_get_function_identity_arguments(procedure.oid)
    ) AS signature
    FROM pg_proc procedure
    JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.proname = ANY (ARRAY[
        'register_pragma_expert',
        'assign_mission_expert_review',
        'propose_mission_review_resolution',
        'assign_gold_expert_review',
        'propose_gold_expert_resolution',
        'create_pragma_gold_external_sampling_plan',
        'record_gold_regression_run',
        'release_mission',
        'materialize_pragma_improvement_candidates',
        'record_pragma_realization_pack_release',
        'apply_pragma_improvement_candidate'
      ])
  LOOP
    EXECUTE 'REVOKE ALL ON FUNCTION ' || v_function.signature ||
      ' FROM PUBLIC, anon, authenticated';
  END LOOP;
END;
$freeze_retired_rpcs$;

ALTER TABLE public.pragma_improvement_refresh_runs
  DROP CONSTRAINT IF EXISTS pragma_improvement_refresh_runs_contract_version_check;
ALTER TABLE public.pragma_improvement_refresh_runs
  ADD CONSTRAINT pragma_improvement_refresh_runs_contract_version_check
  CHECK (contract_version IN (
    'pragma_improvement_materializer_v1',
    'pragma_learner_improvement_materializer_v2'
  ));

-- The current improvement materializer accepts learner dissent only. It intentionally
-- does not consume expert reviews or expert-derived Gold regression runs.
CREATE OR REPLACE FUNCTION public.materialize_pragma_learner_improvement_candidates(
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
  v_candidate_ids uuid[] := ARRAY[]::uuid[];
  v_learner_count integer := 0;
  v_fingerprint text;
  v_refs jsonb;
  v_refresh_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can materialize learner improvement candidates';
  END IF;
  IF p_window_start >= p_window_end
     OR p_min_distinct_attempts < 3
     OR p_min_distinct_participants < 3 THEN
    RAISE EXCEPTION 'A valid window and minimum 3 distinct attempts/participants are required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('pragma-learner-improvement-materializer-v2', 0));

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
       AND lineage.coverage_status = 'covered'
       AND (
         lineage.stage = 'released'
         OR (
           lineage.stage = 'reviewed'
           AND lineage.mission_content->'authoring'->>'stage' = 'professor_finalized'
         )
       )
       AND lineage.mission_content_hash = event.content_hash
       AND lineage.mission_content->'unit'->>'target_feature' = event.feature_id
       AND COALESCE(lineage.mission_content->>'direction', 'ko_zh') = event.direction
      JOIN public.scenarios scenario
        ON scenario.scenario_id = lineage.scenario_id
       AND scenario.speech_act::text = event.speech_act
       AND scenario.mission_content = lineage.mission_content
       AND scenario.mission_status IN ('reviewed', 'released')
      WHERE event.event_type = 'learner_dissent_submitted'
        AND event.recorded_at >= p_window_start
        AND event.recorded_at < p_window_end
        AND profile.consent_data_use = true
        AND profile.consent_anonymous_analysis = true
        AND profile.research_consent_version = event.consent_version
        AND jsonb_typeof(event.event_payload->'dissent') = 'object'
        AND event.event_payload->'dissent'->>'kind' = 'learner_dissent'
        AND length(btrim(COALESCE(event.event_payload->'dissent'->>'reason_ko', ''))) > 0
        AND NOT EXISTS (
          SELECT 1
          FROM public.pragma_improvement_candidate_sources source
          WHERE source.source_type = 'learner_mission_event'
            AND source.source_id = event.id
        )
    )
    SELECT lineage_version_id, target_feature, content_hash,
           realization_pack_id, realization_pack_version,
           array_agg(id ORDER BY id) AS source_ids,
           count(DISTINCT attempt_id)::integer AS distinct_attempts,
           count(DISTINCT profile_id)::integer AS distinct_participants,
           min(recorded_at) AS window_start,
           max(recorded_at) AS window_end
    FROM eligible
    GROUP BY lineage_version_id, target_feature, content_hash,
             realization_pack_id, realization_pack_version
    HAVING count(DISTINCT attempt_id) >= p_min_distinct_attempts
       AND count(DISTINCT profile_id) >= p_min_distinct_participants
  LOOP
    v_fingerprint := encode(
      extensions.digest(
        convert_to(array_to_string(v_group.source_ids, ','), 'UTF8'),
        'sha256'::text
      ),
      'hex'
    );
    SELECT jsonb_agg('learner-event:' || source_id::text ORDER BY source_id)
      INTO v_refs
    FROM unnest(v_group.source_ids) source_id;

    v_candidate_id := NULL;
    INSERT INTO public.pragma_improvement_candidates (
      candidate_key, signal_type, target_feature, content_hash,
      realization_pack_id, realization_pack_version, source_refs, metrics,
      suggested_action, created_by, analysis_contract_version,
      evidence_fingerprint, source_window_start, source_window_end
    ) VALUES (
      'learner:' || v_fingerprint,
      'learner_dissent_cluster',
      v_group.target_feature,
      v_group.content_hash,
      v_group.realization_pack_id,
      v_group.realization_pack_version,
      v_refs,
      jsonb_build_object(
        'lineage_version_id', v_group.lineage_version_id,
        'distinct_attempt_count', v_group.distinct_attempts,
        'distinct_participant_count', v_group.distinct_participants,
        'dissent_event_count', cardinality(v_group.source_ids),
        'minimum_distinct_attempts', p_min_distinct_attempts,
        'minimum_distinct_participants', p_min_distinct_participants
      ),
      'review_content_and_rule_scope',
      auth.uid(),
      'pragma_learner_improvement_signal_v2',
      v_fingerprint,
      v_group.window_start,
      v_group.window_end
    )
    ON CONFLICT (candidate_key) DO NOTHING
    RETURNING id INTO v_candidate_id;

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

  INSERT INTO public.pragma_improvement_refresh_runs (
    contract_version, window_start, window_end, thresholds,
    created_candidate_ids, created_counts, created_by
  ) VALUES (
    'pragma_learner_improvement_materializer_v2',
    p_window_start,
    p_window_end,
    jsonb_build_object(
      'minimum_distinct_attempts', p_min_distinct_attempts,
      'minimum_distinct_participants', p_min_distinct_participants,
      'current_consent_required', true,
      'professor_finalized_or_historical_release_required', true
    ),
    v_candidate_ids,
    jsonb_build_object(
      'learner_dissent_cluster', v_learner_count,
      'total', cardinality(v_candidate_ids)
    ),
    auth.uid()
  ) RETURNING id INTO v_refresh_id;

  RETURN v_refresh_id;
END;
$$;

REVOKE ALL ON FUNCTION public.materialize_pragma_learner_improvement_candidates(
  timestamptz, timestamptz, integer, integer
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.materialize_pragma_learner_improvement_candidates(
  timestamptz, timestamptz, integer, integer
) TO authenticated, service_role;
