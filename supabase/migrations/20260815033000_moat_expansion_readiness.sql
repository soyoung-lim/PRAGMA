-- PRAGMA moat v1.3: the initial request/refusal/thanks vertical slice must have
-- authoritative human, regression, release, learner, flywheel, and live-RLS evidence
-- before CI may attest a pack whose scope includes any of the remaining speech acts.

CREATE TABLE public.pragma_operational_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_version text NOT NULL DEFAULT 'pragma_operational_verification_v1'
    CHECK (schema_version = 'pragma_operational_verification_v1'),
  verification_type text NOT NULL CHECK (verification_type IN ('live_rls_role_smoke')),
  contract_version text NOT NULL CHECK (length(btrim(contract_version)) > 0),
  status text NOT NULL CHECK (status = 'pass'),
  source_commit_ref text NOT NULL CHECK (source_commit_ref ~ '^[0-9a-f]{40}$'),
  run_ref text NOT NULL CHECK (length(btrim(run_ref)) > 0),
  result jsonb NOT NULL,
  result_hash text NOT NULL CHECK (result_hash ~ '^[0-9a-f]{64}$'),
  verified_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (verification_type, run_ref)
);

CREATE OR REPLACE FUNCTION public.validate_pragma_operational_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.verification_type = 'live_rls_role_smoke' AND (
    NEW.contract_version <> 'pragma_live_rls_role_smoke_v1'
    OR NEW.result->>'status' IS DISTINCT FROM 'pass'
    OR NEW.result->>'research_rows_created' IS DISTINCT FROM '0'
    OR NEW.result->>'role_accounts_distinct' IS DISTINCT FROM 'true'
    OR NEW.result->>'learner_event_count_unchanged' IS DISTINCT FROM 'true'
  ) THEN
    RAISE EXCEPTION 'Live RLS verification must preserve research rows and prove all role boundaries';
  END IF;
  NEW.result_hash := encode(
    extensions.digest(convert_to(NEW.result::text, 'UTF8'), 'sha256'::text),
    'hex'
  );
  NEW.verified_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER validate_pragma_operational_verification_trg
  BEFORE INSERT ON public.pragma_operational_verifications
  FOR EACH ROW EXECUTE FUNCTION public.validate_pragma_operational_verification();
CREATE TRIGGER pragma_operational_verifications_append_only
  BEFORE UPDATE OR DELETE ON public.pragma_operational_verifications
  FOR EACH ROW EXECUTE FUNCTION public.reject_pragma_pack_manifest_attestation_mutation();

ALTER TABLE public.pragma_operational_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY pragma_operational_verifications_admin_read
  ON public.pragma_operational_verifications FOR SELECT TO authenticated
  USING (public.is_admin());
GRANT SELECT ON public.pragma_operational_verifications TO authenticated, service_role;
GRANT INSERT ON public.pragma_operational_verifications TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.pragma_operational_verifications FROM authenticated, anon;

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
  v_expert_gold bigint := 0;
  v_regression_id uuid;
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
  v_applied_count bigint := 0;
  v_missing text[] := '{}';
  v_allowed boolean;
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

    SELECT count(DISTINCT calibration.case_id) INTO v_expert_gold
    FROM public.pragma_gold_expert_resolutions resolution
    JOIN public.pragma_gold_calibration_resolutions calibration
      ON calibration.id = resolution.calibration_resolution_id
    WHERE resolution.final_status = 'expert_approved'
      AND resolution.resolved_case_snapshot->>'realization_pack_id' = p_pack_id
      AND resolution.resolved_case_snapshot->>'realization_pack_version' = v_release.pack_version
      AND NOT EXISTS (
        SELECT 1 FROM public.pragma_gold_expert_resolutions later
        WHERE later.calibration_resolution_id = resolution.calibration_resolution_id
          AND (
            later.review_round > resolution.review_round
            OR (later.review_round = resolution.review_round
              AND later.resolution_revision > resolution.resolution_revision)
          )
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.pragma_gold_calibration_resolutions later_calibration
        WHERE later_calibration.case_id = calibration.case_id
          AND later_calibration.resolution_round > calibration.resolution_round
      );

    SELECT run.id INTO v_regression_id
    FROM public.pragma_gold_regression_runs run
    WHERE run.realization_pack_id = p_pack_id
      AND run.realization_pack_version = v_release.pack_version
      AND run.gate_status = 'pass'
      AND cardinality(run.gold_resolution_ids) >= 30
    ORDER BY run.created_at DESC LIMIT 1;

    SELECT
      count(DISTINCT lineage.scenario_id) FILTER (WHERE scenario.speech_act = 'request'::public.speech_act),
      count(DISTINCT lineage.scenario_id) FILTER (WHERE scenario.speech_act = 'refusal'::public.speech_act),
      count(DISTINCT lineage.scenario_id) FILTER (WHERE scenario.speech_act = 'thanks'::public.speech_act)
      INTO v_request_released, v_refusal_released, v_thanks_released
    FROM public.mission_lineage_versions lineage
    JOIN public.scenarios scenario ON scenario.scenario_id = lineage.scenario_id
    WHERE lineage.stage = 'released'
      AND lineage.coverage_status = 'covered'
      AND lineage.realization_pack_id = p_pack_id
      AND lineage.realization_pack_version = v_release.pack_version
      AND lineage.release_resolution_id IS NOT NULL
      AND lineage.gold_regression_run_id IS NOT NULL
      AND scenario.released_lineage_version_id = lineage.id
      AND scenario.language_direction = 'ko_zh';

    SELECT
      count(DISTINCT event.profile_id) FILTER (WHERE scenario.speech_act = 'request'::public.speech_act),
      count(DISTINCT event.profile_id) FILTER (WHERE scenario.speech_act = 'refusal'::public.speech_act),
      count(DISTINCT event.profile_id) FILTER (WHERE scenario.speech_act = 'thanks'::public.speech_act),
      min(event.occurred_at), max(event.occurred_at)
      INTO v_request_participants, v_refusal_participants, v_thanks_participants,
           v_first_completion, v_latest_completion
    FROM public.learner_mission_events event
    JOIN public.mission_lineage_versions lineage ON lineage.id = event.lineage_version_id
    JOIN public.scenarios scenario ON scenario.scenario_id = lineage.scenario_id
    JOIN public.profiles profile ON profile.id = event.profile_id
    WHERE event.event_type = 'mission_completed'
      AND event.event_payload->>'save_status' = 'saved'
      AND event.auth_user_id = profile.user_id
      AND profile.approval_status = 'approved'
      AND profile.consent_data_use = true
      AND profile.consent_anonymous_analysis = true
      AND profile.research_consent_version = event.consent_version
      AND event.policy_version = 'policy_v1_2026-07-21'
      AND event.direction = 'ko_zh'
      AND event.speech_act = scenario.speech_act::text
      AND event.content_hash = lineage.mission_content_hash
      AND scenario.released_lineage_version_id = lineage.id
      AND lineage.stage = 'released'
      AND lineage.realization_pack_id = p_pack_id
      AND lineage.realization_pack_version = v_release.pack_version;

    IF v_latest_completion IS NOT NULL THEN
      SELECT run.id INTO v_refresh_id
      FROM public.pragma_improvement_refresh_runs run
      WHERE run.contract_version = 'pragma_improvement_materializer_v1'
        AND run.window_start <= v_first_completion
        AND run.window_end >= v_latest_completion
        AND run.created_at >= v_latest_completion
      ORDER BY run.created_at DESC LIMIT 1;
    END IF;

    SELECT verification.id INTO v_rls_verification_id
    FROM public.pragma_operational_verifications verification
    WHERE verification.verification_type = 'live_rls_role_smoke'
      AND verification.contract_version = 'pragma_live_rls_role_smoke_v1'
      AND verification.status = 'pass'
      AND verification.source_commit_ref = v_release.source_commit_ref
      AND verification.verified_at >= v_release.created_at
    ORDER BY verification.verified_at DESC LIMIT 1;

    SELECT count(*) INTO v_applied_count
    FROM public.pragma_improvement_decisions decision
    WHERE decision.decision = 'applied'
      AND decision.resulting_pack_id = p_pack_id
      AND decision.resulting_pack_version = v_release.pack_version;
  END IF;

  IF v_release.id IS NULL THEN v_missing := array_append(v_missing, 'ci_attested_pack_release'); END IF;
  IF v_researcher_gold < 30 THEN v_missing := array_append(v_missing, 'researcher_approved_gold_30'); END IF;
  IF v_expert_gold < 30 THEN v_missing := array_append(v_missing, 'expert_approved_gold_30'); END IF;
  IF v_regression_id IS NULL THEN v_missing := array_append(v_missing, 'passing_gold_regression'); END IF;
  IF v_request_released < 1 OR v_refusal_released < 1 OR v_thanks_released < 1 THEN
    v_missing := array_append(v_missing, 'released_vertical_slice_all_three_acts');
  END IF;
  IF v_request_participants < 3 OR v_refusal_participants < 3 OR v_thanks_participants < 3 THEN
    v_missing := array_append(v_missing, 'three_consented_completers_per_initial_act');
  END IF;
  IF v_refresh_id IS NULL THEN v_missing := array_append(v_missing, 'post_sample_flywheel_refresh'); END IF;
  IF v_rls_verification_id IS NULL THEN v_missing := array_append(v_missing, 'live_three_role_rls_smoke'); END IF;
  v_allowed := cardinality(v_missing) = 0;

  RETURN jsonb_build_object(
    'schema_version', 'pragma_moat_expansion_readiness_v1',
    'evaluated_at', now(),
    'pack_id', p_pack_id,
    'pack_version', v_release.pack_version,
    'expansion_allowed', v_allowed,
    'missing_requirements', to_jsonb(v_missing),
    'requirements', jsonb_build_object(
      'attested_pack_release', jsonb_build_object('passed', v_release.id IS NOT NULL, 'release_id', v_release.id),
      'researcher_gold', jsonb_build_object('passed', v_researcher_gold >= 30, 'count', v_researcher_gold, 'required', 30),
      'expert_gold', jsonb_build_object('passed', v_expert_gold >= 30, 'count', v_expert_gold, 'required', 30),
      'gold_regression', jsonb_build_object('passed', v_regression_id IS NOT NULL, 'run_id', v_regression_id),
      'released_vertical_slice', jsonb_build_object(
        'passed', v_request_released >= 1 AND v_refusal_released >= 1 AND v_thanks_released >= 1,
        'counts', jsonb_build_object('request', v_request_released, 'refusal', v_refusal_released, 'thanks', v_thanks_released)
      ),
      'consented_completion_sample', jsonb_build_object(
        'passed', v_request_participants >= 3 AND v_refusal_participants >= 3 AND v_thanks_participants >= 3,
        'required_per_act', 3,
        'distinct_participants', jsonb_build_object('request', v_request_participants, 'refusal', v_refusal_participants, 'thanks', v_thanks_participants)
      ),
      'flywheel_refresh', jsonb_build_object('passed', v_refresh_id IS NOT NULL, 'run_id', v_refresh_id),
      'live_rls_smoke', jsonb_build_object('passed', v_rls_verification_id IS NOT NULL, 'verification_id', v_rls_verification_id)
    ),
    'informational', jsonb_build_object('applied_improvement_count_for_current_pack', v_applied_count)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_pragma_moat_expansion_readiness(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_pragma_moat_expansion_readiness(text) TO authenticated, service_role;

CREATE TABLE public.pragma_speech_act_expansion_authorizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_version text NOT NULL DEFAULT 'pragma_speech_act_expansion_authorization_v1'
    CHECK (schema_version = 'pragma_speech_act_expansion_authorization_v1'),
  basis_pack_id text NOT NULL,
  basis_pack_version text NOT NULL,
  basis_pack_release_id uuid NOT NULL REFERENCES public.pragma_realization_pack_releases(id) ON DELETE RESTRICT,
  target_pack_id text NOT NULL CHECK (length(btrim(target_pack_id)) > 0),
  target_scope_speech_acts text[] NOT NULL CHECK (cardinality(target_scope_speech_acts) > 3),
  readiness_snapshot jsonb NOT NULL,
  readiness_snapshot_hash text NOT NULL CHECK (readiness_snapshot_hash ~ '^[0-9a-f]{64}$'),
  rationale_ko text NOT NULL CHECK (length(btrim(rationale_ko)) > 0),
  authorized_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  authorized_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (basis_pack_release_id, target_pack_id, target_scope_speech_acts)
);

CREATE OR REPLACE FUNCTION public.validate_pragma_speech_act_expansion_authorization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_basis public.pragma_realization_pack_releases%ROWTYPE;
  v_known text[] := ARRAY['request','refusal','apology','thanks','proposal','agreement','opposition','compliment','complaint'];
BEGIN
  IF NEW.readiness_snapshot->>'expansion_allowed' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'Expansion authorization requires a passing readiness snapshot';
  END IF;
  SELECT * INTO v_basis FROM public.pragma_realization_pack_releases WHERE id = NEW.basis_pack_release_id;
  IF NOT FOUND OR v_basis.pack_id IS DISTINCT FROM NEW.basis_pack_id
     OR v_basis.pack_version IS DISTINCT FROM NEW.basis_pack_version
     OR NEW.readiness_snapshot->>'pack_id' IS DISTINCT FROM NEW.basis_pack_id
     OR NEW.readiness_snapshot->>'pack_version' IS DISTINCT FROM NEW.basis_pack_version
  THEN RAISE EXCEPTION 'Expansion authorization basis must match the readiness pack release'; END IF;
  IF cardinality(NEW.target_scope_speech_acts) <> (
       SELECT count(DISTINCT u.act)
       FROM unnest(NEW.target_scope_speech_acts) AS u(act)
     )
     OR NOT (ARRAY['request','refusal','thanks']::text[] <@ NEW.target_scope_speech_acts)
     OR NOT (NEW.target_scope_speech_acts <@ v_known)
  THEN RAISE EXCEPTION 'Expansion target scope must uniquely contain the initial three and only known speech acts'; END IF;
  NEW.target_scope_speech_acts := ARRAY(
    SELECT u.act FROM unnest(NEW.target_scope_speech_acts) AS u(act)
    ORDER BY array_position(v_known, u.act)
  );
  NEW.readiness_snapshot_hash := encode(
    extensions.digest(convert_to(NEW.readiness_snapshot::text, 'UTF8'), 'sha256'::text),
    'hex'
  );
  RETURN NEW;
END;
$$;
CREATE TRIGGER validate_pragma_speech_act_expansion_authorization_trg
  BEFORE INSERT ON public.pragma_speech_act_expansion_authorizations
  FOR EACH ROW EXECUTE FUNCTION public.validate_pragma_speech_act_expansion_authorization();
CREATE TRIGGER pragma_speech_act_expansion_authorizations_append_only
  BEFORE UPDATE OR DELETE ON public.pragma_speech_act_expansion_authorizations
  FOR EACH ROW EXECUTE FUNCTION public.reject_pragma_pack_manifest_attestation_mutation();

ALTER TABLE public.pragma_speech_act_expansion_authorizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY pragma_speech_act_expansion_authorizations_admin_read
  ON public.pragma_speech_act_expansion_authorizations FOR SELECT TO authenticated
  USING (public.is_admin());
GRANT SELECT ON public.pragma_speech_act_expansion_authorizations TO authenticated, service_role;
REVOKE INSERT, UPDATE, DELETE ON public.pragma_speech_act_expansion_authorizations FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.authorize_pragma_speech_act_expansion(
  p_basis_pack_id text,
  p_target_pack_id text,
  p_target_scope_speech_acts text[],
  p_rationale_ko text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_readiness jsonb;
  v_basis_release_id uuid;
  v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only admins can authorize speech-act expansion'; END IF;
  IF length(btrim(COALESCE(p_target_pack_id, ''))) = 0
     OR length(btrim(COALESCE(p_rationale_ko, ''))) = 0
  THEN RAISE EXCEPTION 'Target pack and research rationale are required'; END IF;
  v_readiness := public.get_pragma_moat_expansion_readiness(p_basis_pack_id);
  IF (v_readiness->>'expansion_allowed')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Initial vertical slice is not ready for expansion: %', v_readiness->'missing_requirements';
  END IF;
  v_basis_release_id := (v_readiness#>>'{requirements,attested_pack_release,release_id}')::uuid;
  INSERT INTO public.pragma_speech_act_expansion_authorizations (
    basis_pack_id, basis_pack_version, basis_pack_release_id,
    target_pack_id, target_scope_speech_acts, readiness_snapshot,
    readiness_snapshot_hash, rationale_ko, authorized_by
  ) VALUES (
    p_basis_pack_id, v_readiness->>'pack_version', v_basis_release_id,
    p_target_pack_id, p_target_scope_speech_acts, v_readiness,
    repeat('0', 64), p_rationale_ko, auth.uid()
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.authorize_pragma_speech_act_expansion(text, text, text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.authorize_pragma_speech_act_expansion(text, text, text[], text) TO authenticated;

ALTER TABLE public.pragma_pack_manifest_attestations
  ADD COLUMN scope_speech_acts text[] NOT NULL
    DEFAULT ARRAY['request','refusal','thanks']::text[],
  ADD COLUMN expansion_authorization_id uuid
    REFERENCES public.pragma_speech_act_expansion_authorizations(id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.validate_pragma_pack_manifest_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_authorization public.pragma_speech_act_expansion_authorizations%ROWTYPE;
  v_initial text[] := ARRAY['request','refusal','thanks'];
  v_known text[] := ARRAY['request','refusal','apology','thanks','proposal','agreement','opposition','compliment','complaint'];
BEGIN
  IF cardinality(NEW.scope_speech_acts) <> (
       SELECT count(DISTINCT u.act)
       FROM unnest(NEW.scope_speech_acts) AS u(act)
     ) OR NOT (NEW.scope_speech_acts <@ v_known)
  THEN RAISE EXCEPTION 'Manifest scope must contain unique known speech acts'; END IF;
  NEW.scope_speech_acts := ARRAY(
    SELECT u.act FROM unnest(NEW.scope_speech_acts) AS u(act)
    ORDER BY array_position(v_known, u.act)
  );
  IF NEW.scope_speech_acts @> v_initial AND cardinality(NEW.scope_speech_acts) = 3 THEN
    IF NEW.expansion_authorization_id IS NOT NULL THEN
      RAISE EXCEPTION 'Initial three-act manifest must not claim an expansion authorization';
    END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO v_authorization
  FROM public.pragma_speech_act_expansion_authorizations
  WHERE id = NEW.expansion_authorization_id;
  IF NOT FOUND OR v_authorization.target_pack_id IS DISTINCT FROM NEW.pack_id
     OR v_authorization.target_scope_speech_acts IS DISTINCT FROM NEW.scope_speech_acts
     OR v_authorization.readiness_snapshot->>'expansion_allowed' IS DISTINCT FROM 'true'
  THEN
    RAISE EXCEPTION 'Expanded manifest requires an exact passing speech-act expansion authorization';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validate_pragma_pack_manifest_scope_trg
  BEFORE INSERT ON public.pragma_pack_manifest_attestations
  FOR EACH ROW EXECUTE FUNCTION public.validate_pragma_pack_manifest_scope();
