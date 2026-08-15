-- PRAGMA moat v1.7: keep Gold thresholds inside their intended boundary and
-- require every speech act to appear in the final-corpus Gold/retest bundle.

ALTER TABLE public.pragma_gold_regression_runs
  ADD COLUMN evaluation_purpose text NOT NULL DEFAULT 'operational_gate_check'
    CHECK (evaluation_purpose = 'operational_gate_check'),
  ADD COLUMN is_quality_measurement boolean NOT NULL DEFAULT false
    CHECK (is_quality_measurement = false),
  ADD COLUMN interpretation_note_ko text NOT NULL DEFAULT
    '30개 기준답안으로 품질 점검 자동화 장치의 작동 여부를 확인하는 운영 게이트입니다. 전체 시스템의 정확도나 일반화된 품질 측정치로 해석하거나 보고하지 않습니다.'
    CHECK (length(btrim(interpretation_note_ko)) > 0);

UPDATE public.pragma_gold_regression_runs
SET report = report || jsonb_build_object(
  'evaluation_purpose', 'operational_gate_check',
  'is_quality_measurement', false,
  'interpretation_note_ko', interpretation_note_ko
);

CREATE OR REPLACE FUNCTION public.enforce_pragma_gold_gate_boundary()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.evaluation_purpose := 'operational_gate_check';
  NEW.is_quality_measurement := false;
  NEW.interpretation_note_ko :=
    '30개 기준답안으로 품질 점검 자동화 장치의 작동 여부를 확인하는 운영 게이트입니다. 전체 시스템의 정확도나 일반화된 품질 측정치로 해석하거나 보고하지 않습니다.';
  NEW.report := COALESCE(NEW.report, '{}'::jsonb) || jsonb_build_object(
    'evaluation_purpose', NEW.evaluation_purpose,
    'is_quality_measurement', NEW.is_quality_measurement,
    'interpretation_note_ko', NEW.interpretation_note_ko
  );
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_pragma_gold_gate_boundary() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER enforce_pragma_gold_gate_boundary_trg
  BEFORE INSERT ON public.pragma_gold_regression_runs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_pragma_gold_gate_boundary();

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
  ORDER BY release.created_at DESC
  LIMIT 1;
  IF v_release.id IS NOT NULL THEN
    SELECT * INTO v_attestation
    FROM public.pragma_pack_manifest_attestations
    WHERE id = v_release.manifest_attestation_id;
  END IF;

  IF v_release.id IS NOT NULL THEN
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
      FROM unnest(v_known) AS act(speech_act)
      LEFT JOIN current_cases ON current_cases.speech_act = act.speech_act
      GROUP BY act.speech_act
    )
    SELECT COALESCE(sum(case_count), 0), COALESCE(min(case_count), 0)
      INTO v_researcher_gold, v_min_researcher_per_act
    FROM per_act;

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

    SELECT run.id, coverage.minimum_per_speech_act
      INTO v_regression_id, v_min_regression_per_act
    FROM public.pragma_gold_regression_runs run
    CROSS JOIN LATERAL (
      SELECT COALESCE(min(per_act.case_count), 0) AS minimum_per_speech_act
      FROM (
        SELECT act.speech_act,
          (
            SELECT count(DISTINCT snapshot->>'case_id')
            FROM jsonb_array_elements(run.gold_case_snapshots) snapshot
            WHERE snapshot->>'speech_act' = act.speech_act
          ) AS case_count
        FROM unnest(v_known) AS act(speech_act)
      ) per_act
    ) coverage
    WHERE run.realization_pack_id = p_pack_id
      AND run.realization_pack_version = v_release.pack_version
      AND run.gate_status = 'pass'
      AND run.evaluation_purpose = 'operational_gate_check'
      AND run.is_quality_measurement = false
      AND cardinality(run.gold_resolution_ids) >= 30
      AND coverage.minimum_per_speech_act >= 3
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
  IF v_expert_gold < 30 OR v_min_expert_per_act < 3 THEN
    v_missing := array_append(v_missing, 'expert_gold_30_and_three_per_act_current_pack');
  END IF;
  IF v_regression_id IS NULL OR v_min_regression_per_act < 3 THEN
    v_missing := array_append(v_missing, 'passing_gold_gate_three_per_act_current_pack');
  END IF;
  IF v_rls_verification_id IS NULL THEN
    v_missing := array_append(v_missing, 'live_three_role_rls_smoke_same_commit');
  END IF;

  RETURN jsonb_build_object(
    'schema_version', 'pragma_final_corpus_generation_readiness_v2',
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
        'count', v_researcher_gold,
        'required', 30,
        'minimum_per_speech_act', v_min_researcher_per_act,
        'required_per_speech_act', 3
      ),
      'expert_gold', jsonb_build_object(
        'passed', v_expert_gold >= 30 AND v_min_expert_per_act >= 3,
        'count', v_expert_gold,
        'required', 30,
        'minimum_per_speech_act', v_min_expert_per_act,
        'required_per_speech_act', 3
      ),
      'gold_regression', jsonb_build_object(
        'passed', v_regression_id IS NOT NULL AND v_min_regression_per_act >= 3,
        'run_id', v_regression_id,
        'evaluation_purpose', 'operational_gate_check',
        'is_quality_measurement', false,
        'minimum_per_speech_act', v_min_regression_per_act,
        'required_per_speech_act', 3
      ),
      'live_rls_smoke', jsonb_build_object(
        'passed', v_rls_verification_id IS NOT NULL,
        'verification_id', v_rls_verification_id
      )
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_pragma_final_corpus_generation_readiness(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_pragma_final_corpus_generation_readiness(text) TO authenticated, service_role;
