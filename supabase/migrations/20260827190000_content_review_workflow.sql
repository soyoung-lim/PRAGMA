-- Five-stage QA for a current instructional version. Does not backfill/revoke
-- historical approvals or change learner records. Apply only after review.
CREATE TABLE public.content_review_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('mission', 'weekly_material')),
  target_id uuid NOT NULL,
  week_no integer NOT NULL DEFAULT 0,
  source_hash text NOT NULL CHECK (source_hash ~ '^[0-9a-f]{64}$'),
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  criteria_version text NOT NULL,
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  rules jsonb NOT NULL CHECK (rules->>'verdict' IN ('pass', 'warning', 'fail')),
  openai_review jsonb,
  claude_review jsonb,
  adjudication jsonb,
  running_stage text CHECK (running_stage IN ('openai', 'claude', 'adjudication')),
  lease_token uuid,
  lease_until timestamptz,
  last_error text,
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users(id),
  professor_note text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind = 'mission' AND week_no = 0) OR (kind = 'weekly_material' AND week_no BETWEEN 1 AND 15)),
  UNIQUE(kind, target_id, week_no, source_hash, content_hash, criteria_version)
);
ALTER TABLE public.content_review_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY content_review_admin_read ON public.content_review_runs FOR SELECT TO authenticated USING (public.is_admin());
REVOKE ALL ON public.content_review_runs FROM anon, authenticated;
GRANT SELECT ON public.content_review_runs TO authenticated;
GRANT ALL ON public.content_review_runs TO service_role;

CREATE FUNCTION public.pragma_review_instructional_mission(p_content jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT COALESCE(p_content - ARRAY['provenance','quality_check','hsk_lexical_audit','authoring','item_lineage'], 'null'::jsonb);
$$;

-- The source/hash are read in one statement snapshot. Models never receive a
-- caller-supplied mission, approval, or claimed content hash.
CREATE FUNCTION public.get_content_review_source(p_kind text, p_target_id uuid, p_week_no integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_scenarios jsonb; v_source jsonb; v_semantic jsonb; v_outline jsonb; v_week jsonb; v_assignments jsonb;
BEGIN
  IF NOT (COALESCE(public.is_admin(), false) OR COALESCE(auth.role() = 'service_role', false)) THEN
    RAISE EXCEPTION 'Admin required';
  END IF;
  IF p_kind NOT IN ('mission', 'weekly_material') THEN RAISE EXCEPTION 'Invalid review kind'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'scenario_id', s.scenario_id, 'speech_act', s.speech_act, 'learner_level', s.learner_level,
    'domain', s.domain, 'industry_sector', s.industry_sector, 'mode', s.mode,
    'source_modality', s.source_modality, 'theme_code', s.theme_code, 'topic_code', s.topic_code,
    'core_content', s.core_content, 'mission_content', s.mission_content
  ) || CASE WHEN p_kind = 'weekly_material' THEN jsonb_build_object('mission_status', s.mission_status) ELSE '{}'::jsonb END
  ORDER BY s.scenario_id), '[]'::jsonb) INTO v_scenarios
  FROM public.scenarios s WHERE
    (p_kind = 'mission' AND s.scenario_id = p_target_id AND s.mission_content IS NOT NULL)
    OR (p_kind = 'weekly_material' AND s.scenario_id IN (
      SELECT a.scenario_id FROM public.curriculum_week_scenarios a WHERE a.outline_id = p_target_id AND a.week_no = p_week_no
    ));
  IF p_kind = 'mission' THEN
    IF jsonb_array_length(v_scenarios) <> 1 THEN RAISE EXCEPTION 'Saved mission not found'; END IF;
    v_source := jsonb_build_object('scenario', v_scenarios->0);
    v_semantic := jsonb_set(v_source, '{scenario,mission_content}', public.pragma_review_instructional_mission(v_source#>'{scenario,mission_content}'));
  ELSE
    SELECT to_jsonb(o) - ARRAY['created_at','updated_at','status'] INTO v_outline FROM public.curriculum_outlines o WHERE o.id = p_target_id;
    SELECT to_jsonb(w) - ARRAY['created_at','updated_at','review_released'] INTO v_week
      FROM public.curriculum_weeks w WHERE w.outline_id = p_target_id AND w.week_no = p_week_no;
    IF v_outline IS NULL OR v_week IS NULL THEN RAISE EXCEPTION 'Course week not found'; END IF;
    SELECT COALESCE(jsonb_agg(jsonb_build_object('week_no', a.week_no, 'scenario_id', a.scenario_id,
      'position', a.position, 'slot_role', a.slot_role) ORDER BY a.position, a.scenario_id), '[]'::jsonb)
      INTO v_assignments FROM public.curriculum_week_scenarios a WHERE a.outline_id = p_target_id AND a.week_no = p_week_no;
    v_source := jsonb_build_object('outline', v_outline, 'week', v_week, 'assignments', v_assignments, 'scenarios', v_scenarios);
    SELECT COALESCE(jsonb_agg(jsonb_set(s, '{mission_content}', public.pragma_review_instructional_mission(s->'mission_content')) ORDER BY s->>'scenario_id'), '[]'::jsonb)
      INTO v_scenarios FROM jsonb_array_elements(v_scenarios) s;
    v_semantic := jsonb_set(v_source, '{scenarios}', v_scenarios);
  END IF;
  RETURN jsonb_build_object('source', v_source, 'source_hash', encode(digest(v_semantic::text, 'sha256'), 'hex'));
END;
$$;
REVOKE ALL ON FUNCTION public.get_content_review_source(text, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_content_review_source(text, uuid, integer) TO authenticated, service_role;

CREATE FUNCTION public.assert_content_review_ready(p_review_id uuid, p_content_hash text)
RETURNS public.content_review_runs LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_review public.content_review_runs; v_source jsonb; v_assignment record; v_dependency_hash text;
BEGIN
  IF NOT COALESCE(public.is_admin(), false) THEN RAISE EXCEPTION 'Admin required'; END IF;
  SELECT * INTO v_review FROM public.content_review_runs WHERE id = p_review_id FOR UPDATE;
  IF NOT FOUND OR v_review.content_hash IS DISTINCT FROM p_content_hash
    OR v_review.criteria_version <> 'content_review_v1' OR v_review.rules->>'verdict' NOT IN ('pass','warning')
    OR v_review.openai_review IS NULL OR v_review.claude_review IS NULL OR v_review.adjudication IS NULL
    OR v_review.running_stage IS NOT NULL THEN RAISE EXCEPTION 'Complete the four QA stages for the current version'; END IF;
  v_source := public.get_content_review_source(v_review.kind, v_review.target_id, v_review.week_no);
  IF v_source->>'source_hash' IS DISTINCT FROM v_review.source_hash THEN RAISE EXCEPTION 'Content changed: review the current version'; END IF;
  IF v_review.kind = 'weekly_material' THEN
    FOR v_assignment IN SELECT scenario_id FROM public.curriculum_week_scenarios
      WHERE outline_id = v_review.target_id AND week_no = v_review.week_no LOOP
      v_dependency_hash := public.get_content_review_source('mission', v_assignment.scenario_id, 0)->>'source_hash';
      IF NOT EXISTS (SELECT 1 FROM public.content_review_runs r WHERE r.kind = 'mission'
        AND r.target_id = v_assignment.scenario_id AND r.source_hash = v_dependency_hash
        AND r.criteria_version = 'content_review_v1' AND r.approved_at IS NOT NULL) THEN
        RAISE EXCEPTION 'Approve the current version of each assigned mission first';
      END IF;
    END LOOP;
  END IF;
  RETURN v_review;
END;
$$;
REVOKE ALL ON FUNCTION public.assert_content_review_ready(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_content_review_ready(uuid, text) TO authenticated;

-- Used for weekly material and retrospective QA of already-approved missions.
-- Generated missions are approved atomically by finalize_reviewed_mission below.
CREATE FUNCTION public.approve_content_review(p_review_id uuid, p_content_hash text, p_note text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_review public.content_review_runs;
BEGIN
  v_review := public.assert_content_review_ready(p_review_id, p_content_hash);
  IF length(btrim(COALESCE(p_note, ''))) < 10 THEN RAISE EXCEPTION 'Record a professor approval rationale (10+ characters)'; END IF;
  IF v_review.kind = 'mission' AND NOT EXISTS (SELECT 1 FROM public.scenarios WHERE scenario_id = v_review.target_id AND mission_status IN ('reviewed','released')) THEN
    RAISE EXCEPTION 'Use mission finalization to approve a generated mission';
  END IF;
  IF v_review.approved_at IS NULL THEN
    UPDATE public.content_review_runs SET approved_by = auth.uid(), approved_at = now(), professor_note = btrim(p_note) WHERE id = p_review_id;
  END IF;
  RETURN p_review_id;
END;
$$;
REVOKE ALL ON FUNCTION public.approve_content_review(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_content_review(uuid, text, text) TO authenticated;

-- Existing finalization retained; only the current-version gate and decision are added.
CREATE OR REPLACE FUNCTION public.finalize_reviewed_mission(p_scenario_id uuid, p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.scenarios%ROWTYPE;
  v_final jsonb := p_payload->'mission_content';
  v_overrides jsonb := COALESCE(p_payload->'issue_overrides', '[]'::jsonb);
  v_parent public.mission_lineage_versions%ROWTYPE;
  v_version integer;
  v_review public.content_review_runs;
BEGIN
  IF NOT COALESCE(public.is_admin(), false) THEN RAISE EXCEPTION 'Only admins can review missions'; END IF;
  IF jsonb_typeof(v_final) IS DISTINCT FROM 'object'
     OR jsonb_typeof(v_overrides) IS DISTINCT FROM 'array'
     OR v_final->'authoring'->>'stage' IS DISTINCT FROM 'professor_finalized'
     OR v_final->'authoring'->>'lineage_status' IS DISTINCT FROM 'complete'
     OR COALESCE(v_final->'provenance'->>'mission_content_hash', '') !~ '^[0-9a-f]{64}$'
     OR jsonb_typeof(v_final->'hsk_lexical_audit') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Finalized mission content is required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_scenario_id::text, 0));
  SELECT * INTO v_row FROM public.scenarios
  WHERE scenario_id = p_scenario_id AND mission_status = 'generated' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'mission not found or not generated: %', p_scenario_id; END IF;
  v_review := public.assert_content_review_ready((p_payload->>'review_id')::uuid, p_payload->>'review_content_hash');
  IF v_review.kind <> 'mission' OR v_review.target_id <> p_scenario_id THEN RAISE EXCEPTION 'Review target mismatch'; END IF;
  IF length(btrim(COALESCE(p_payload->>'professor_note', ''))) < 10 THEN RAISE EXCEPTION 'Professor rationale required'; END IF;
  IF public.pragma_review_instructional_mission(v_final) IS DISTINCT FROM public.pragma_review_instructional_mission(v_row.mission_content) THEN
    RAISE EXCEPTION 'Finalization cannot change reviewed instructional content';
  END IF;
  IF v_final->'quality_check' IS DISTINCT FROM v_row.mission_content->'quality_check' THEN
    RAISE EXCEPTION 'Finalization cannot replace the current critic result';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(v_final->'quality_check'->'findings', '[]'::jsonb))
      WITH ORDINALITY finding(value, ordinality)
    WHERE finding.value->>'severity' = 'fail'
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_overrides) override
        WHERE (override->>'issue_index')::integer = finding.ordinality - 1
          AND override->>'code' IS NOT DISTINCT FROM finding.value->>'code'
          AND COALESCE(override->>'where', '') IS NOT DISTINCT FROM COALESCE(finding.value->>'where', '')
          AND length(btrim(COALESCE(override->>'rationale_ko', ''))) >= 10
      )
  ) THEN
    RAISE EXCEPTION 'Every unresolved critical AI issue requires a professor override rationale';
  END IF;

  SELECT * INTO v_parent FROM public.mission_lineage_versions
  WHERE scenario_id = p_scenario_id ORDER BY version_no DESC LIMIT 1;
  IF v_parent.coverage_status = 'covered' AND jsonb_typeof(v_final->'item_lineage') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Covered mission requires finalized item lineage';
  END IF;

  v_final := jsonb_set(v_final, '{authoring,professor_issue_overrides}', v_overrides, true);
  UPDATE public.scenarios
  SET mission_content = v_final,
      mission_status = 'reviewed',
      mission_reviewed_by = auth.uid(),
      mission_reviewed_at = now(),
      updated_at = now()
  WHERE scenario_id = p_scenario_id;

  v_version := COALESCE(v_parent.version_no, 0) + 1;
  INSERT INTO public.mission_lineage_versions (
    scenario_id, version_no, parent_version_id, stage,
    mission_content, item_lineage, mission_content_hash,
    realization_pack_id, realization_pack_version, coverage_status,
    rule_scope_ids, risk_scope_ids, evidence_scope_ids,
    generation_provider, generation_model, prompt_version, prompt_snapshot_hash, prompt_instance_hash,
    generation_attempt, validation_result, ai_quality_result,
    actor_id, reviewed_by, reviewed_at
  ) VALUES (
    p_scenario_id, v_version, v_parent.id, 'reviewed',
    v_final, v_final->'item_lineage', v_final->'provenance'->>'mission_content_hash',
    v_parent.realization_pack_id, v_parent.realization_pack_version, v_parent.coverage_status,
    v_parent.rule_scope_ids, v_parent.risk_scope_ids, v_parent.evidence_scope_ids,
    v_parent.generation_provider, v_parent.generation_model, v_parent.prompt_version,
    v_parent.prompt_snapshot_hash, v_parent.prompt_instance_hash, v_parent.generation_attempt,
    v_parent.validation_result, v_final->'quality_check',
    auth.uid(), auth.uid(), now()
  );
  UPDATE public.content_review_runs SET approved_by = auth.uid(), approved_at = now(),
    professor_note = btrim(p_payload->>'professor_note') WHERE id = v_review.id AND approved_at IS NULL;
  RETURN p_scenario_id;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_reviewed_mission(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_reviewed_mission(uuid, jsonb) TO authenticated, service_role;
