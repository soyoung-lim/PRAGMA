-- PRAGMA moat v1.4: blind external-expert validation for researcher-approved Gold.
-- Expected bands, researcher rationales, references, and review status never enter the
-- expert assignment snapshot. Full labels become visible only through an append-only
-- resolution after every same-round blind assignment has been submitted.

CREATE TABLE public.pragma_gold_expert_review_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calibration_resolution_id uuid NOT NULL
    REFERENCES public.pragma_gold_calibration_resolutions(id) ON DELETE RESTRICT,
  case_id text NOT NULL,
  case_version text NOT NULL,
  case_content_hash text NOT NULL,
  blind_case_snapshot jsonb NOT NULL,
  reviewer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  expert_registry_version_id uuid NOT NULL
    REFERENCES public.pragma_expert_registry_versions(id) ON DELETE RESTRICT,
  review_round integer NOT NULL CHECK (review_round > 0),
  blind_review boolean NOT NULL DEFAULT true CHECK (blind_review = true),
  protocol_version text NOT NULL DEFAULT 'gold_expert_review_protocol_v1'
    CHECK (protocol_version = 'gold_expert_review_protocol_v1'),
  assigned_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (calibration_resolution_id, reviewer_user_id, review_round)
);

CREATE TABLE public.pragma_gold_expert_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL UNIQUE
    REFERENCES public.pragma_gold_expert_review_assignments(id) ON DELETE RESTRICT,
  calibration_resolution_id uuid NOT NULL
    REFERENCES public.pragma_gold_calibration_resolutions(id) ON DELETE RESTRICT,
  reviewer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  schema_version text NOT NULL CHECK (schema_version = 'pragma_gold_expert_review_v1'),
  protocol_version text NOT NULL CHECK (protocol_version = 'gold_expert_review_protocol_v1'),
  review_round integer NOT NULL CHECK (review_round > 0),
  independence_declaration jsonb NOT NULL,
  context_assessment jsonb NOT NULL,
  candidate_assessments jsonb NOT NULL,
  overall_verdict text NOT NULL CHECK (overall_verdict IN ('approve', 'revise', 'reject')),
  rationale_ko text NOT NULL CHECK (length(btrim(rationale_ko)) > 0),
  submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.pragma_gold_expert_resolutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_version text NOT NULL DEFAULT 'pragma_gold_expert_resolution_v1'
    CHECK (schema_version = 'pragma_gold_expert_resolution_v1'),
  protocol_version text NOT NULL DEFAULT 'gold_expert_review_protocol_v1'
    CHECK (protocol_version = 'gold_expert_review_protocol_v1'),
  calibration_resolution_id uuid NOT NULL
    REFERENCES public.pragma_gold_calibration_resolutions(id) ON DELETE RESTRICT,
  review_round integer NOT NULL CHECK (review_round > 0),
  review_ids uuid[] NOT NULL CHECK (cardinality(review_ids) >= 2),
  resolution_revision integer NOT NULL CHECK (resolution_revision > 0),
  supersedes_resolution_id uuid REFERENCES public.pragma_gold_expert_resolutions(id) ON DELETE RESTRICT,
  resolution_method text NOT NULL CHECK (
    resolution_method IN ('unanimous', 'consensus_after_discussion', 'researcher_decision', 'unresolved')
  ),
  final_status text NOT NULL CHECK (
    final_status IN ('expert_approved', 'revise_required', 'rejected', 'unresolved')
  ),
  resolved_context_assessment jsonb,
  resolved_candidate_assessments jsonb,
  resolved_case_snapshot jsonb,
  rationale_ko text NOT NULL CHECK (length(btrim(rationale_ko)) > 0),
  resolved_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  resolved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (calibration_resolution_id, review_round, resolution_revision),
  CHECK (
    (final_status = 'unresolved' AND resolved_context_assessment IS NULL
      AND resolved_candidate_assessments IS NULL AND resolved_case_snapshot IS NULL)
    OR
    (final_status <> 'unresolved' AND resolved_context_assessment IS NOT NULL
      AND resolved_candidate_assessments IS NOT NULL)
  ),
  CHECK (
    (final_status = 'expert_approved' AND resolved_case_snapshot IS NOT NULL)
    OR (final_status <> 'expert_approved' AND resolved_case_snapshot IS NULL)
  )
);

CREATE TABLE public.pragma_gold_expert_resolution_signoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resolution_id uuid NOT NULL REFERENCES public.pragma_gold_expert_resolutions(id) ON DELETE RESTRICT,
  reviewer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  decision text NOT NULL CHECK (decision IN ('agree', 'disagree')),
  rationale_ko text NOT NULL CHECK (length(btrim(rationale_ko)) > 0),
  signed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (resolution_id, reviewer_user_id)
);

CREATE INDEX pragma_gold_expert_assignments_reviewer_idx
  ON public.pragma_gold_expert_review_assignments(reviewer_user_id, assigned_at DESC);
CREATE INDEX pragma_gold_expert_resolutions_case_idx
  ON public.pragma_gold_expert_resolutions(calibration_resolution_id, review_round DESC, resolution_revision DESC);

GRANT SELECT ON public.pragma_gold_expert_review_assignments TO authenticated;
GRANT SELECT, INSERT ON public.pragma_gold_expert_reviews TO authenticated;
GRANT SELECT ON public.pragma_gold_expert_resolutions TO authenticated;
GRANT SELECT, INSERT ON public.pragma_gold_expert_resolution_signoffs TO authenticated;
GRANT ALL ON public.pragma_gold_expert_review_assignments TO service_role;
GRANT ALL ON public.pragma_gold_expert_reviews TO service_role;
GRANT ALL ON public.pragma_gold_expert_resolutions TO service_role;
GRANT ALL ON public.pragma_gold_expert_resolution_signoffs TO service_role;
REVOKE UPDATE, DELETE ON public.pragma_gold_expert_review_assignments FROM authenticated, anon;
REVOKE UPDATE, DELETE ON public.pragma_gold_expert_reviews FROM authenticated, anon;
REVOKE UPDATE, DELETE ON public.pragma_gold_expert_resolutions FROM authenticated, anon;
REVOKE UPDATE, DELETE ON public.pragma_gold_expert_resolution_signoffs FROM authenticated, anon;

ALTER TABLE public.pragma_gold_expert_review_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pragma_gold_expert_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pragma_gold_expert_resolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pragma_gold_expert_resolution_signoffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY gold_expert_assignment_read
  ON public.pragma_gold_expert_review_assignments FOR SELECT TO authenticated
  USING (public.is_admin() OR reviewer_user_id = auth.uid());
CREATE POLICY gold_expert_review_read
  ON public.pragma_gold_expert_reviews FOR SELECT TO authenticated
  USING (public.is_admin() OR reviewer_user_id = auth.uid());
CREATE POLICY gold_expert_review_submit
  ON public.pragma_gold_expert_reviews FOR INSERT TO authenticated
  WITH CHECK (reviewer_user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.pragma_gold_expert_review_assignments assignment
    WHERE assignment.id = assignment_id
      AND assignment.reviewer_user_id = auth.uid()
  ));
CREATE POLICY gold_expert_resolution_admin_read
  ON public.pragma_gold_expert_resolutions FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY gold_expert_resolution_reviewer_read
  ON public.pragma_gold_expert_resolutions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.pragma_gold_expert_reviews review
    WHERE review.id = ANY(review_ids) AND review.reviewer_user_id = auth.uid()
  ));
CREATE POLICY gold_expert_signoff_read
  ON public.pragma_gold_expert_resolution_signoffs FOR SELECT TO authenticated
  USING (public.is_admin() OR reviewer_user_id = auth.uid());
CREATE POLICY gold_expert_signoff_insert
  ON public.pragma_gold_expert_resolution_signoffs FOR INSERT TO authenticated
  WITH CHECK (reviewer_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.make_gold_expert_blind_snapshot(p_case jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'schema_version', 'pragma_gold_expert_blind_case_v1',
    'case_id', p_case->'case_id',
    'version', p_case->'version',
    'direction', p_case->'direction',
    'realization_pack_id', p_case->'realization_pack_id',
    'realization_pack_version', p_case->'realization_pack_version',
    'speech_act', p_case->'speech_act',
    'target_feature', p_case->'target_feature',
    'level', p_case->'level',
    'domain', p_case->'domain',
    'mode', p_case->'mode',
    'pdr', p_case->'pdr',
    'scenario_ko', p_case->'scenario_ko',
    'source_text_ko', p_case->'source_text_ko',
    'preceding_turn_zh', p_case->'preceding_turn_zh',
    'semantic_invariant_ko', p_case->'semantic_invariant_ko',
    'candidates', (
      SELECT jsonb_agg(jsonb_build_object(
        'candidate_id', candidate->'candidate_id',
        'text_zh', candidate->'text_zh'
      ) ORDER BY candidate->>'candidate_id')
      FROM jsonb_array_elements(p_case->'candidates') candidate
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.validate_gold_expert_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resolution public.pragma_gold_calibration_resolutions%ROWTYPE;
  v_registry public.pragma_expert_registry_versions%ROWTYPE;
BEGIN
  SELECT * INTO v_resolution
  FROM public.pragma_gold_calibration_resolutions
  WHERE id = NEW.calibration_resolution_id
    AND resolution_status = 'researcher_approved';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gold expert assignment requires a researcher-approved calibration resolution';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = NEW.reviewer_user_id AND role = 'admin'::public.app_role
  ) THEN
    RAISE EXCEPTION 'administrators cannot serve as blind Gold expert reviewers';
  END IF;
  SELECT * INTO v_registry
  FROM public.pragma_expert_registry_versions
  WHERE id = NEW.expert_registry_version_id
    AND expert_user_id = NEW.reviewer_user_id;
  IF NOT FOUND OR v_registry.status <> 'active'
     OR NOT ('ko_zh' = ANY(v_registry.language_pairs))
  THEN
    RAISE EXCEPTION 'Gold assignment requires an active ko_zh expert registry version';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.pragma_expert_registry_versions later
    WHERE later.expert_user_id = NEW.reviewer_user_id
      AND later.registry_version > v_registry.registry_version
  ) THEN
    RAISE EXCEPTION 'Gold assignment must use the latest expert registry version';
  END IF;

  NEW.case_id := v_resolution.case_id;
  NEW.case_version := v_resolution.case_version;
  NEW.case_content_hash := encode(
    extensions.digest(convert_to(v_resolution.resolved_case_snapshot::text, 'UTF8'), 'sha256'::text),
    'hex'
  );
  NEW.blind_case_snapshot := public.make_gold_expert_blind_snapshot(v_resolution.resolved_case_snapshot);
  IF NEW.blind_review IS DISTINCT FROM true
     OR NEW.protocol_version IS DISTINCT FROM 'gold_expert_review_protocol_v1'
  THEN
    RAISE EXCEPTION 'Gold expert assignment requires the blind versioned protocol';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_gold_expert_assignment_trg
  BEFORE INSERT ON public.pragma_gold_expert_review_assignments
  FOR EACH ROW EXECUTE FUNCTION public.validate_gold_expert_assignment();

CREATE OR REPLACE FUNCTION public.assign_gold_expert_review(
  p_calibration_resolution_id uuid,
  p_reviewer_user_id uuid,
  p_review_round integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_registry_id uuid;
  v_id uuid;
BEGIN
  IF NOT public.is_admin() OR p_review_round IS NULL OR p_review_round < 1 THEN
    RAISE EXCEPTION 'Only admins can create valid Gold expert assignments';
  END IF;
  SELECT id INTO v_registry_id
  FROM public.pragma_expert_registry_versions
  WHERE expert_user_id = p_reviewer_user_id
  ORDER BY registry_version DESC
  LIMIT 1;

  INSERT INTO public.pragma_gold_expert_review_assignments (
    calibration_resolution_id, case_id, case_version, case_content_hash,
    blind_case_snapshot, reviewer_user_id, expert_registry_version_id,
    review_round, blind_review, protocol_version, assigned_by
  ) VALUES (
    p_calibration_resolution_id, '', '', '', '{}'::jsonb,
    p_reviewer_user_id, v_registry_id, p_review_round, true,
    'gold_expert_review_protocol_v1', auth.uid()
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE INSERT ON public.pragma_gold_expert_review_assignments FROM authenticated;
REVOKE ALL ON FUNCTION public.assign_gold_expert_review(uuid, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_gold_expert_review(uuid, uuid, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.validate_gold_expert_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assignment public.pragma_gold_expert_review_assignments%ROWTYPE;
  v_context_count integer;
  v_candidate_count integer;
BEGIN
  SELECT * INTO v_assignment
  FROM public.pragma_gold_expert_review_assignments
  WHERE id = NEW.assignment_id
    AND calibration_resolution_id = NEW.calibration_resolution_id
    AND reviewer_user_id = NEW.reviewer_user_id;
  IF NOT FOUND OR NEW.review_round IS DISTINCT FROM v_assignment.review_round
     OR NEW.protocol_version IS DISTINCT FROM v_assignment.protocol_version
     OR NEW.independence_declaration IS DISTINCT FROM jsonb_build_object(
       'reviewed_independently', true,
       'conflict_of_interest', false,
       'chinese_proficiency_confirmed', true
     )
  THEN
    RAISE EXCEPTION 'Gold expert review must match its same-round blind assignment and declaration';
  END IF;

  IF jsonb_typeof(NEW.context_assessment) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Gold expert context assessment must be an object';
  END IF;
  SELECT count(*) INTO v_context_count FROM jsonb_object_keys(NEW.context_assessment);
  IF v_context_count <> 3 OR EXISTS (
    SELECT 1 FROM jsonb_each(NEW.context_assessment) item
    WHERE item.key NOT IN ('scenario_valid', 'pdr_valid', 'semantic_invariant_valid')
      OR jsonb_typeof(item.value) <> 'boolean'
  ) THEN
    RAISE EXCEPTION 'Gold expert context assessment requires exactly three boolean gates';
  END IF;

  IF jsonb_typeof(NEW.candidate_assessments) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Gold expert candidate assessments must be an object';
  END IF;
  SELECT count(*) INTO v_candidate_count FROM jsonb_object_keys(NEW.candidate_assessments);
  IF v_candidate_count <> 3 OR EXISTS (
    SELECT 1 FROM jsonb_each(NEW.candidate_assessments) item
    WHERE item.key NOT IN ('A', 'B', 'C')
      OR jsonb_typeof(item.value) <> 'object'
      OR item.value->>'assessed_band_code' NOT IN (
        'too_direct', 'within_band', 'too_indirect',
        'too_blunt', 'over_elaborate', 'insufficient', 'excessive'
      )
      OR item.value->>'semantic_fidelity' NOT IN ('pass', 'fail')
      OR length(btrim(COALESCE(item.value->>'rationale_ko', ''))) = 0
  ) THEN
    RAISE EXCEPTION 'Gold expert review requires complete A/B/C band, semantic, and rationale judgments';
  END IF;

  IF NEW.overall_verdict = 'approve' AND (
    EXISTS (SELECT 1 FROM jsonb_each(NEW.context_assessment) item WHERE item.value <> 'true'::jsonb)
    OR EXISTS (
      SELECT 1 FROM jsonb_each(NEW.candidate_assessments) item
      WHERE item.value->>'semantic_fidelity' <> 'pass'
    )
  ) THEN
    RAISE EXCEPTION 'Gold expert approve requires every context gate and semantic judgment to pass';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_gold_expert_review_trg
  BEFORE INSERT ON public.pragma_gold_expert_reviews
  FOR EACH ROW EXECUTE FUNCTION public.validate_gold_expert_review();

CREATE OR REPLACE FUNCTION public.validate_gold_expert_resolution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer;
  v_distinct integer;
  v_matching integer;
  v_reviewers integer;
  v_assignments integer;
  v_submitted integer;
  v_previous public.pragma_gold_expert_resolutions%ROWTYPE;
  v_context_variants integer;
  v_candidate_variants integer;
  v_verdict_variants integer;
BEGIN
  SELECT cardinality(NEW.review_ids), count(DISTINCT review_id)
    INTO v_total, v_distinct FROM unnest(NEW.review_ids) review_id;
  SELECT count(*), count(DISTINCT reviewer_user_id)
    INTO v_matching, v_reviewers
  FROM public.pragma_gold_expert_reviews
  WHERE id = ANY(NEW.review_ids)
    AND calibration_resolution_id = NEW.calibration_resolution_id
    AND review_round = NEW.review_round
    AND schema_version = 'pragma_gold_expert_review_v1';
  SELECT count(*) INTO v_assignments
  FROM public.pragma_gold_expert_review_assignments
  WHERE calibration_resolution_id = NEW.calibration_resolution_id
    AND review_round = NEW.review_round AND blind_review = true;
  SELECT count(*) INTO v_submitted
  FROM public.pragma_gold_expert_reviews
  WHERE calibration_resolution_id = NEW.calibration_resolution_id
    AND review_round = NEW.review_round;
  IF v_total <> v_distinct OR v_matching <> v_total OR v_reviewers < 2
     OR v_assignments <> v_submitted OR v_total <> v_submitted
  THEN
    RAISE EXCEPTION 'Gold resolution requires every same-round blind assignment and two distinct experts';
  END IF;

  IF NEW.resolution_revision = 1 THEN
    IF NEW.supersedes_resolution_id IS NOT NULL THEN
      RAISE EXCEPTION 'first Gold resolution revision cannot supersede another row';
    END IF;
  ELSE
    SELECT * INTO v_previous
    FROM public.pragma_gold_expert_resolutions
    WHERE id = NEW.supersedes_resolution_id
      AND calibration_resolution_id = NEW.calibration_resolution_id
      AND review_round = NEW.review_round
      AND resolution_revision = NEW.resolution_revision - 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Gold resolution revisions must form a contiguous same-round chain';
    END IF;
  END IF;

  IF (NEW.final_status = 'unresolved') IS DISTINCT FROM (NEW.resolution_method = 'unresolved') THEN
    RAISE EXCEPTION 'Gold unresolved status and method must be used together';
  END IF;
  IF NEW.final_status = 'unresolved' THEN RETURN NEW; END IF;

  IF jsonb_typeof(NEW.resolved_context_assessment) IS DISTINCT FROM 'object'
     OR jsonb_typeof(NEW.resolved_candidate_assessments) IS DISTINCT FROM 'object'
     OR (SELECT count(*) FROM jsonb_object_keys(NEW.resolved_context_assessment)) <> 3
     OR (SELECT count(*) FROM jsonb_object_keys(NEW.resolved_candidate_assessments)) <> 3
     OR EXISTS (
       SELECT 1 FROM jsonb_each(NEW.resolved_context_assessment) item
       WHERE item.key NOT IN ('scenario_valid', 'pdr_valid', 'semantic_invariant_valid')
         OR jsonb_typeof(item.value) <> 'boolean'
     )
     OR EXISTS (
       SELECT 1 FROM jsonb_each(NEW.resolved_candidate_assessments) item
       WHERE item.key NOT IN ('A', 'B', 'C')
         OR item.value->>'assessed_band_code' NOT IN (
           'too_direct', 'within_band', 'too_indirect',
           'too_blunt', 'over_elaborate', 'insufficient', 'excessive'
         )
         OR item.value->>'semantic_fidelity' NOT IN ('pass', 'fail')
         OR length(btrim(COALESCE(item.value->>'rationale_ko', ''))) = 0
     )
  THEN
    RAISE EXCEPTION 'resolved Gold judgments must completely cover context and A/B/C';
  END IF;

  IF NEW.final_status = 'expert_approved' THEN
    IF NEW.resolution_method NOT IN ('unanimous', 'consensus_after_discussion')
       OR EXISTS (SELECT 1 FROM jsonb_each(NEW.resolved_context_assessment) item WHERE item.value <> 'true'::jsonb)
       OR EXISTS (
         SELECT 1 FROM jsonb_each(NEW.resolved_candidate_assessments) item
         WHERE item.value->>'semantic_fidelity' <> 'pass'
       )
       OR NEW.resolved_case_snapshot#>>'{review,status}' IS DISTINCT FROM 'expert_approved'
    THEN
      RAISE EXCEPTION 'expert-approved Gold requires expert agreement, complete context, and semantic pass';
    END IF;
  END IF;

  IF NEW.resolution_method = 'unanimous' THEN
    SELECT count(DISTINCT context_assessment::text),
           count(DISTINCT candidate_assessments::text),
           count(DISTINCT overall_verdict)
      INTO v_context_variants, v_candidate_variants, v_verdict_variants
    FROM public.pragma_gold_expert_reviews WHERE id = ANY(NEW.review_ids);
    IF v_context_variants <> 1 OR v_candidate_variants <> 1 OR v_verdict_variants <> 1
       OR NEW.resolved_context_assessment IS DISTINCT FROM (
         SELECT context_assessment FROM public.pragma_gold_expert_reviews WHERE id = NEW.review_ids[1]
       )
       OR NEW.resolved_candidate_assessments IS DISTINCT FROM (
         SELECT candidate_assessments FROM public.pragma_gold_expert_reviews WHERE id = NEW.review_ids[1]
       )
    THEN
      RAISE EXCEPTION 'unanimous Gold resolution requires actually identical expert judgments';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_gold_expert_resolution_trg
  BEFORE INSERT ON public.pragma_gold_expert_resolutions
  FOR EACH ROW EXECUTE FUNCTION public.validate_gold_expert_resolution();

CREATE OR REPLACE FUNCTION public.propose_gold_expert_resolution(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_calibration_id uuid := (p_payload->>'calibration_resolution_id')::uuid;
  v_round integer := (p_payload->>'review_round')::integer;
  v_review_ids uuid[] := ARRAY(SELECT jsonb_array_elements_text(p_payload->'review_ids'))::uuid[];
  v_revision integer;
  v_previous uuid;
  v_source jsonb;
  v_candidates jsonb;
  v_expert_reviews jsonb;
  v_snapshot jsonb;
  v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can propose Gold expert resolutions';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_calibration_id::text || ':' || v_round::text, 0));
  SELECT id, resolution_revision + 1 INTO v_previous, v_revision
  FROM public.pragma_gold_expert_resolutions
  WHERE calibration_resolution_id = v_calibration_id AND review_round = v_round
  ORDER BY resolution_revision DESC LIMIT 1;
  v_revision := COALESCE(v_revision, 1);

  IF p_payload->>'final_status' = 'expert_approved' THEN
    SELECT resolved_case_snapshot INTO v_source
    FROM public.pragma_gold_calibration_resolutions WHERE id = v_calibration_id;
    SELECT jsonb_agg(
      candidate || jsonb_build_object(
        'expected_band_code', p_payload->'resolved_candidate_assessments'->(candidate->>'candidate_id')->'assessed_band_code',
        'semantic_fidelity', p_payload->'resolved_candidate_assessments'->(candidate->>'candidate_id')->'semantic_fidelity'
      ) ORDER BY candidate->>'candidate_id'
    ) INTO v_candidates
    FROM jsonb_array_elements(v_source->'candidates') candidate;
    SELECT jsonb_agg(jsonb_build_object(
      'reviewer_id', reviewer_user_id,
      'verdict', overall_verdict,
      'reviewed_at', to_jsonb(submitted_at),
      'note_ko', rationale_ko
    ) ORDER BY reviewer_user_id) INTO v_expert_reviews
    FROM public.pragma_gold_expert_reviews WHERE id = ANY(v_review_ids);
    v_snapshot := jsonb_set(v_source, '{candidates}', v_candidates);
    v_snapshot := jsonb_set(v_snapshot, '{review}', jsonb_build_object(
      'status', 'expert_approved',
      'researcher_reviewer_id', v_source#>'{review,researcher_reviewer_id}',
      'expert_reviews', v_expert_reviews,
      'note_ko', p_payload->'rationale_ko'
    ));
    v_snapshot := jsonb_set(v_snapshot, '{provenance,supersedes_case_id}', v_source->'case_id');
  END IF;

  INSERT INTO public.pragma_gold_expert_resolutions (
    calibration_resolution_id, review_round, review_ids, resolution_revision,
    supersedes_resolution_id, resolution_method, final_status,
    resolved_context_assessment, resolved_candidate_assessments,
    resolved_case_snapshot, rationale_ko, resolved_by
  ) VALUES (
    v_calibration_id, v_round, v_review_ids, v_revision,
    v_previous, p_payload->>'resolution_method', p_payload->>'final_status',
    p_payload->'resolved_context_assessment', p_payload->'resolved_candidate_assessments',
    v_snapshot, p_payload->>'rationale_ko', auth.uid()
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE INSERT ON public.pragma_gold_expert_resolutions FROM authenticated;
REVOKE ALL ON FUNCTION public.propose_gold_expert_resolution(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.propose_gold_expert_resolution(jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.validate_gold_expert_resolution_signoff()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.pragma_gold_expert_resolutions resolution
    JOIN public.pragma_gold_expert_reviews review ON review.id = ANY(resolution.review_ids)
    WHERE resolution.id = NEW.resolution_id
      AND resolution.resolution_method = 'consensus_after_discussion'
      AND review.reviewer_user_id = NEW.reviewer_user_id
  ) THEN
    RAISE EXCEPTION 'only included Gold reviewers may sign a discussion resolution';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_gold_expert_resolution_signoff_trg
  BEFORE INSERT ON public.pragma_gold_expert_resolution_signoffs
  FOR EACH ROW EXECUTE FUNCTION public.validate_gold_expert_resolution_signoff();

REVOKE ALL ON FUNCTION public.make_gold_expert_blind_snapshot(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.validate_gold_expert_assignment() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_gold_expert_review() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_gold_expert_resolution() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_gold_expert_resolution_signoff() FROM PUBLIC;
