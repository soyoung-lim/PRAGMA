-- Treat HSK lexical-reference exceptions as researcher-attention warnings.
-- This replaces the function introduced in 20260815055000 without rewriting
-- the already-recorded migration history.

CREATE OR REPLACE FUNCTION public.record_pragma_final_corpus_researcher_item_review(
  p_lineage_version_id uuid,
  p_verdict text,
  p_rationale_ko text,
  p_review_started_at timestamptz
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
  v_warning boolean;
  v_hsk_candidate_count integer;
  v_duration integer;
  v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only the research lead can review final-corpus items'; END IF;
  IF p_verdict NOT IN ('approve','revise','reject') THEN RAISE EXCEPTION 'Invalid researcher verdict'; END IF;
  IF length(btrim(COALESCE(p_rationale_ko, ''))) = 0 THEN RAISE EXCEPTION 'Researcher rationale is required'; END IF;
  IF p_review_started_at IS NULL OR p_review_started_at > now()
     OR p_review_started_at < now() - interval '8 hours'
  THEN RAISE EXCEPTION 'A valid review start time within the current work session is required'; END IF;
  v_duration := GREATEST(1, floor(extract(epoch FROM (now() - p_review_started_at)))::integer);

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

  v_hsk_candidate_count := jsonb_array_length(
    COALESCE(
      v_lineage.mission_content->'hsk_lexical_audit'->'out_of_reference_candidates',
      '[]'::jsonb
    )
  );
  v_warning := lower(COALESCE(v_result.quality_verdict, '')) <> 'pass'
    OR lower(COALESCE(v_result.rule_result::text, '')) LIKE '%warning%'
    OR v_hsk_candidate_count > 0;
  IF v_warning AND p_verdict = 'approve'
     AND p_rationale_ko = '자동 점검 통과와 핵심 내용의 이상 없음 확인'
  THEN RAISE EXCEPTION 'Warning-focused approval requires a case-specific rationale'; END IF;

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
    automated_result_snapshot, rationale_ko, reviewed_by,
    automated_warning, attention_mode, review_started_at, review_duration_seconds
  ) VALUES (
    v_scenario.final_corpus_generation_run_id, v_scenario.scenario_id, v_reviewed_id, p_verdict,
    jsonb_build_object(
      'mission_item_result_id', v_result.id,
      'rule_result', v_result.rule_result,
      'quality_verdict', v_result.quality_verdict,
      'generation_attempt_count', v_result.generation_attempt_count,
      'hsk_out_of_reference_candidate_count', v_hsk_candidate_count
    ), p_rationale_ko, auth.uid(),
    v_warning,
    CASE WHEN v_warning THEN 'warning_focused_review' ELSE 'automated_pass_confirmation' END,
    p_review_started_at, v_duration
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_pragma_final_corpus_researcher_item_review(uuid, text, text, timestamptz)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_pragma_final_corpus_researcher_item_review(uuid, text, text, timestamptz)
  TO authenticated, service_role;
