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
  openai_fail_override text,
  professor_decisions jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(professor_decisions) = 'array'),
  professor_decisions_by uuid REFERENCES auth.users(id),
  professor_decisions_at timestamptz,
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

ALTER TABLE public.mission_lineage_versions
  ADD COLUMN content_review_run_id uuid REFERENCES public.content_review_runs(id);

CREATE FUNCTION public.pragma_review_instructional_mission(p_content jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT COALESCE(p_content - ARRAY['provenance','quality_check','hsk_lexical_audit','authoring','item_lineage'], 'null'::jsonb);
$$;

-- One projection for both the inspected source and the row about to be published.
CREATE FUNCTION public.content_review_scenario_source(p_row jsonb, p_with_status boolean DEFAULT false)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT jsonb_build_object(
    'scenario_id', p_row->'scenario_id', 'speech_act', p_row->'speech_act', 'learner_level', p_row->'learner_level',
    'domain', p_row->'domain', 'industry_sector', p_row->'industry_sector', 'mode', p_row->'mode',
    'source_modality', p_row->'source_modality', 'theme_code', p_row->'theme_code', 'topic_code', p_row->'topic_code',
    'core_content', p_row->'core_content', 'mission_content', p_row->'mission_content'
  ) || CASE WHEN p_with_status THEN jsonb_build_object('mission_status', p_row->'mission_status') ELSE '{}'::jsonb END;
$$;
CREATE FUNCTION public.content_review_mission_source_hash(p_row jsonb)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public, extensions AS $$
  SELECT encode(extensions.digest(jsonb_build_object('scenario', jsonb_set(
    public.content_review_scenario_source(p_row), '{mission_content}',
    public.pragma_review_instructional_mission(p_row->'mission_content')
  ))::text, 'sha256'), 'hex');
$$;
REVOKE ALL ON FUNCTION public.content_review_scenario_source(jsonb, boolean), public.content_review_mission_source_hash(jsonb)
  FROM PUBLIC, anon, authenticated;

-- The source/hash are read in one statement snapshot. Models never receive a
-- caller-supplied mission, approval, or claimed content hash.
CREATE FUNCTION public.content_review_source_internal(p_kind text, p_target_id uuid, p_week_no integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_scenarios jsonb; v_source jsonb; v_semantic jsonb; v_outline jsonb; v_week jsonb; v_assignments jsonb;
BEGIN
  IF p_kind NOT IN ('mission', 'weekly_material') THEN RAISE EXCEPTION 'Invalid review kind'; END IF;
  SELECT COALESCE(jsonb_agg(public.content_review_scenario_source(to_jsonb(s), p_kind = 'weekly_material')
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
  RETURN jsonb_build_object('source', v_source, 'source_hash', encode(extensions.digest(v_semantic::text, 'sha256'), 'hex'));
END;
$$;
REVOKE ALL ON FUNCTION public.content_review_source_internal(text, uuid, integer) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.get_content_review_source(p_kind text, p_target_id uuid, p_week_no integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (COALESCE(public.is_admin(), false) OR COALESCE(auth.role() = 'service_role', false)) THEN
    RAISE EXCEPTION 'Admin required';
  END IF;
  RETURN public.content_review_source_internal(p_kind, p_target_id, p_week_no);
END;
$$;
REVOKE ALL ON FUNCTION public.get_content_review_source(text, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_content_review_source(text, uuid, integer) TO authenticated, service_role;

-- Edge owns detailed schema/evidence validation. DB checks only completion and
-- the IDs/decisions relied upon by approval, including JSON null/empty envelopes.
CREATE FUNCTION public.validate_content_review_outputs(p_review public.content_review_runs)
RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE v_output jsonb; v_findings jsonb; v_decisions jsonb; v_stage text;
BEGIN
  FOREACH v_stage IN ARRAY ARRAY['openai','claude','adjudication'] LOOP
    v_output := CASE v_stage WHEN 'openai' THEN p_review.openai_review WHEN 'claude' THEN p_review.claude_review ELSE p_review.adjudication END;
    IF jsonb_typeof(v_output->'result') IS DISTINCT FROM 'object'
      OR v_output->>'prompt_version' IS DISTINCT FROM p_review.criteria_version || ':' || v_stage
      OR length(btrim(COALESCE(v_output->>'model', ''))) = 0
      OR length(btrim(COALESCE(v_output->>'response_id', ''))) = 0
      OR COALESCE(v_output->>'input_hash', '') !~ '^[0-9a-f]{64}$' THEN
      RAISE EXCEPTION 'Incomplete model review output';
    END IF;
    IF v_stage <> 'adjudication' THEN
      v_findings := v_output#>'{result,findings}';
      IF jsonb_typeof(v_findings) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid model findings'; END IF;
      IF (SELECT count(DISTINCT f->>'id') FROM jsonb_array_elements(v_findings) f) <> jsonb_array_length(v_findings)
        OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_findings) f WHERE COALESCE(f->>'id','') = ''
          OR COALESCE(f->>'severity','') NOT IN ('warning','fail'))
        OR v_output#>>'{result,verdict}' IS DISTINCT FROM (CASE
          WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(v_findings) f WHERE f->>'severity' = 'fail') THEN 'fail'
          WHEN jsonb_array_length(v_findings) > 0 THEN 'warning' ELSE 'pass' END) THEN
        RAISE EXCEPTION 'Inconsistent model findings';
      END IF;
    END IF;
  END LOOP;
  v_findings := p_review.claude_review#>'{result,findings}';
  v_decisions := p_review.adjudication#>'{result,decisions}';
  IF jsonb_typeof(v_decisions) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid adjudication'; END IF;
  IF jsonb_array_length(v_decisions) <> jsonb_array_length(v_findings)
    OR (SELECT count(DISTINCT d->>'finding_id') FROM jsonb_array_elements(v_decisions) d) <> jsonb_array_length(v_decisions)
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_decisions) d WHERE
      NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_findings) f WHERE f->>'id' = d->>'finding_id')
      OR COALESCE(d->>'decision','') NOT IN ('accept','refine','reject')
      OR length(btrim(COALESCE(d->>'rationale_ko',''))) = 0) THEN
    RAISE EXCEPTION 'Adjudicate every Claude finding exactly once';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_content_review_outputs(public.content_review_runs) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.assert_content_review_ready(p_review_id uuid, p_content_hash text)
RETURNS public.content_review_runs LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_review public.content_review_runs; v_source jsonb; v_assignment record; v_dependency_hash text;
BEGIN
  IF NOT COALESCE(public.is_admin(), false) THEN RAISE EXCEPTION 'Admin required'; END IF;
  SELECT * INTO v_review FROM public.content_review_runs WHERE id = p_review_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Review not found'; END IF;
  -- Source rows before review rows, matching mission finalization's lock order.
  IF v_review.kind = 'mission' THEN
    PERFORM 1 FROM public.scenarios WHERE scenario_id = v_review.target_id FOR UPDATE;
  ELSE
    PERFORM 1 FROM public.curriculum_outlines WHERE id = v_review.target_id FOR UPDATE;
    PERFORM 1 FROM public.curriculum_weeks WHERE outline_id = v_review.target_id AND week_no = v_review.week_no FOR UPDATE;
    PERFORM 1 FROM public.curriculum_week_scenarios WHERE outline_id = v_review.target_id AND week_no = v_review.week_no FOR UPDATE;
    PERFORM 1 FROM public.scenarios WHERE scenario_id IN (
      SELECT scenario_id FROM public.curriculum_week_scenarios WHERE outline_id = v_review.target_id AND week_no = v_review.week_no
    ) ORDER BY scenario_id FOR UPDATE;
  END IF;
  SELECT * INTO v_review FROM public.content_review_runs WHERE id = p_review_id FOR UPDATE;
  IF NOT FOUND OR v_review.content_hash IS DISTINCT FROM p_content_hash
    OR v_review.criteria_version <> 'content_review_v2' OR COALESCE(v_review.rules->>'verdict','') NOT IN ('pass','warning')
    OR v_review.openai_review IS NULL OR v_review.claude_review IS NULL OR v_review.adjudication IS NULL
    OR v_review.running_stage IS NOT NULL THEN RAISE EXCEPTION 'Complete the four QA stages for the current version'; END IF;
  PERFORM public.validate_content_review_outputs(v_review);
  v_source := public.get_content_review_source(v_review.kind, v_review.target_id, v_review.week_no);
  IF v_source->>'source_hash' IS DISTINCT FROM v_review.source_hash THEN RAISE EXCEPTION 'Content changed: review the current version'; END IF;
  IF v_review.kind = 'weekly_material' THEN
    FOR v_assignment IN SELECT scenario_id FROM public.curriculum_week_scenarios
      WHERE outline_id = v_review.target_id AND week_no = v_review.week_no LOOP
      v_dependency_hash := public.get_content_review_source('mission', v_assignment.scenario_id, 0)->>'source_hash';
      IF NOT EXISTS (SELECT 1 FROM public.content_review_runs r WHERE r.kind = 'mission'
        AND r.target_id = v_assignment.scenario_id AND r.source_hash = v_dependency_hash
        AND r.criteria_version = 'content_review_v2' AND r.approved_at IS NOT NULL) THEN
        RAISE EXCEPTION 'Approve the current version of each assigned mission first';
      END IF;
    END LOOP;
  END IF;
  RETURN v_review;
END;
$$;
REVOKE ALL ON FUNCTION public.assert_content_review_ready(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_content_review_ready(uuid, text) TO authenticated;

-- Kept in the still-unapplied migration: one exact decision per Claude finding.
-- A decision to revise/defer is a record, never permission to publish this version.
CREATE FUNCTION public.validate_content_review_decisions(p_findings jsonb, p_decisions jsonb, p_require_clear boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
BEGIN
  IF jsonb_typeof(p_findings) IS DISTINCT FROM 'array' OR jsonb_typeof(p_decisions) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Professor decisions must match the Claude findings';
  END IF;
  IF jsonb_array_length(p_findings) <> jsonb_array_length(p_decisions)
    OR (SELECT count(DISTINCT d->>'finding_id') FROM jsonb_array_elements(p_decisions) d) <> jsonb_array_length(p_decisions)
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_decisions) d
      WHERE jsonb_typeof(d) IS DISTINCT FROM 'object'
        OR COALESCE(d->>'decision', '') NOT IN ('revision_required','no_change','defer')
        OR jsonb_typeof(d->'rationale_ko') IS DISTINCT FROM 'string'
        OR length(btrim(COALESCE(d->>'rationale_ko', ''))) < 10
        OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_findings) f WHERE f->>'id' = d->>'finding_id')
        OR (p_require_clear AND d->>'decision' <> 'no_change')) THEN
    RAISE EXCEPTION 'Record every professor decision; revision or defer cannot be approved';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_content_review_decisions(jsonb, jsonb, boolean) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.save_content_review_decisions(p_review_id uuid, p_content_hash text, p_decisions jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_review public.content_review_runs;
BEGIN
  v_review := public.assert_content_review_ready(p_review_id, p_content_hash);
  IF v_review.approved_at IS NOT NULL THEN RAISE EXCEPTION 'Final professor decisions are immutable'; END IF;
  PERFORM public.validate_content_review_decisions(v_review.claude_review#>'{result,findings}', p_decisions);
  UPDATE public.content_review_runs SET professor_decisions = p_decisions,
    professor_decisions_by = auth.uid(), professor_decisions_at = now() WHERE id = p_review_id;
  RETURN p_review_id;
END;
$$;
REVOKE ALL ON FUNCTION public.save_content_review_decisions(uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_content_review_decisions(uuid, text, jsonb) TO authenticated;

-- Used for weekly material and retrospective QA of already-approved missions.
-- Generated missions are approved atomically by finalize_reviewed_mission below.
CREATE FUNCTION public.approve_content_review(p_review_id uuid, p_content_hash text, p_note text, p_openai_fail_override text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_review public.content_review_runs;
BEGIN
  v_review := public.assert_content_review_ready(p_review_id, p_content_hash);
  PERFORM public.validate_content_review_decisions(v_review.claude_review#>'{result,findings}', v_review.professor_decisions, true);
  IF length(btrim(COALESCE(p_note, ''))) < 10 THEN RAISE EXCEPTION 'Record a professor approval rationale (10+ characters)'; END IF;
  IF v_review.openai_review#>>'{result,verdict}' = 'fail' AND length(btrim(COALESCE(p_openai_fail_override,''))) < 10 THEN
    RAISE EXCEPTION 'Record an explicit rationale for OpenAI critical findings';
  END IF;
  IF v_review.kind = 'mission' AND NOT EXISTS (SELECT 1 FROM public.scenarios WHERE scenario_id = v_review.target_id AND mission_status IN ('reviewed','released')) THEN
    RAISE EXCEPTION 'Use mission finalization to approve a generated mission';
  END IF;
  IF v_review.approved_at IS NULL THEN
    UPDATE public.content_review_runs SET approved_by = auth.uid(), approved_at = now(), professor_note = btrim(p_note),
      openai_fail_override = CASE WHEN v_review.openai_review#>>'{result,verdict}' = 'fail' THEN btrim(p_openai_fail_override) END WHERE id = p_review_id;
  END IF;
  RETURN p_review_id;
END;
$$;
REVOKE ALL ON FUNCTION public.approve_content_review(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_content_review(uuid, text, text, text) TO authenticated;

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
  PERFORM public.validate_content_review_decisions(v_review.claude_review#>'{result,findings}', v_review.professor_decisions, true);
  IF v_review.kind <> 'mission' OR v_review.target_id <> p_scenario_id THEN RAISE EXCEPTION 'Review target mismatch'; END IF;
  IF length(btrim(COALESCE(p_payload->>'professor_note', ''))) < 10 THEN RAISE EXCEPTION 'Professor rationale required'; END IF;
  IF v_review.openai_review#>>'{result,verdict}' = 'fail' AND length(btrim(COALESCE(p_payload->>'openai_fail_override',''))) < 10 THEN
    RAISE EXCEPTION 'Record an explicit rationale for OpenAI critical findings';
  END IF;
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
  -- The scenario trigger checks this approved record against NEW. All following
  -- writes roll back together if finalization or lineage insertion fails.
  UPDATE public.content_review_runs SET approved_by = auth.uid(), approved_at = now(),
    professor_note = btrim(p_payload->>'professor_note'),
    openai_fail_override = CASE WHEN v_review.openai_review#>>'{result,verdict}' = 'fail' THEN btrim(p_payload->>'openai_fail_override') END
    WHERE id = v_review.id AND approved_at IS NULL;
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
    actor_id, reviewed_by, reviewed_at, content_review_run_id
  ) VALUES (
    p_scenario_id, v_version, v_parent.id, 'reviewed',
    v_final, v_final->'item_lineage', v_final->'provenance'->>'mission_content_hash',
    v_parent.realization_pack_id, v_parent.realization_pack_version, v_parent.coverage_status,
    v_parent.rule_scope_ids, v_parent.risk_scope_ids, v_parent.evidence_scope_ids,
    v_parent.generation_provider, v_parent.generation_model, v_parent.prompt_version,
    v_parent.prompt_snapshot_hash, v_parent.prompt_instance_hash, v_parent.generation_attempt,
    v_parent.validation_result, v_final->'quality_check',
    auth.uid(), auth.uid(), now(), v_review.id
  );
  RETURN p_scenario_id;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_reviewed_mission(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_reviewed_mission(uuid, jsonb) TO authenticated, service_role;

CREATE FUNCTION public.freeze_approved_content_review()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.approved_at IS NOT NULL THEN RAISE EXCEPTION 'Approved review evidence is immutable'; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.freeze_approved_content_review() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER freeze_approved_content_review_trg BEFORE UPDATE OR DELETE ON public.content_review_runs
  FOR EACH ROW EXECUTE FUNCTION public.freeze_approved_content_review();

-- No session flag or caller-supplied "approved" boolean. Existing approved rows
-- stay readable, but their instructional content cannot be replaced or deleted.
CREATE FUNCTION public.guard_content_review_scenario()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_hash text;
BEGIN
  IF TG_OP <> 'INSERT' AND OLD.mission_status IN ('reviewed','released') THEN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Keep approved mission history; do not delete it'; END IF;
    IF public.content_review_scenario_source(to_jsonb(NEW)) IS DISTINCT FROM public.content_review_scenario_source(to_jsonb(OLD))
      OR NEW.mission_status IS DISTINCT FROM OLD.mission_status THEN
      RAISE EXCEPTION 'Approved mission content is immutable; create a new draft';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF NEW.mission_status IN ('reviewed','released') THEN
    v_hash := public.content_review_mission_source_hash(to_jsonb(NEW));
    IF NOT EXISTS (SELECT 1 FROM public.content_review_runs r WHERE r.kind = 'mission' AND r.target_id = NEW.scenario_id
      AND r.source_hash = v_hash AND r.criteria_version = 'content_review_v2' AND r.approved_at IS NOT NULL) THEN
      RAISE EXCEPTION 'Current content requires five-stage professor approval';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_content_review_scenario() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_content_review_scenario_trg BEFORE INSERT OR UPDATE OR DELETE ON public.scenarios
  FOR EACH ROW EXECUTE FUNCTION public.guard_content_review_scenario();
REVOKE ALL ON FUNCTION public.review_mission(uuid) FROM PUBLIC, anon, authenticated;

-- A public handout is the approved snapshot, never the private review envelope.
CREATE FUNCTION public.get_approved_weekly_material(p_outline_id uuid, p_week_no integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_source jsonb; v_review public.content_review_runs;
BEGIN
  IF NOT COALESCE(public.is_admin(), false) AND NOT (
    COALESCE(public.has_completed_learner_profile(), false) AND EXISTS (
      SELECT 1 FROM public.curriculum_outlines WHERE id = p_outline_id AND status = 'published'
    )
  ) THEN RAISE EXCEPTION 'Published course and learner profile required'; END IF;
  v_source := public.content_review_source_internal('weekly_material', p_outline_id, p_week_no);
  SELECT * INTO v_review FROM public.content_review_runs WHERE kind = 'weekly_material'
    AND target_id = p_outline_id AND week_no = p_week_no AND source_hash = v_source->>'source_hash'
    AND criteria_version = 'content_review_v2' AND approved_at IS NOT NULL;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('reviewId', v_review.id, 'contentHash', v_review.content_hash,
    'material', v_review.snapshot#>'{content,public_material}');
END;
$$;
REVOKE ALL ON FUNCTION public.get_approved_weekly_material(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_approved_weekly_material(uuid, integer) TO authenticated;
