-- PRAGMA moat v1.2: append-only researcher calibration for the 30-case Seed Gold set.
-- Seed/code state is never overwritten from the browser. Each review stores the exact
-- case snapshot that was judged, and a separate resolution records whether it may enter
-- the researcher-approved calibration layer. These cases remain test/benchmark assets,
-- not the future 500+ learner-content bank.

CREATE TABLE public.pragma_gold_calibration_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_version text NOT NULL CHECK (schema_version = 'pragma_gold_calibration_review_v1'),
  case_id text NOT NULL,
  case_version text NOT NULL,
  realization_pack_id text NOT NULL,
  realization_pack_version text NOT NULL,
  case_snapshot jsonb NOT NULL,
  case_content_hash text NOT NULL,
  reviewer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  review_round integer NOT NULL DEFAULT 1 CHECK (review_round > 0),
  context_assessment jsonb NOT NULL,
  candidate_assessments jsonb NOT NULL,
  overall_verdict text NOT NULL CHECK (overall_verdict IN ('approve', 'revise', 'reject')),
  rationale_ko text NOT NULL CHECK (length(btrim(rationale_ko)) > 0),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, case_version, reviewer_user_id, review_round)
);

CREATE TABLE public.pragma_gold_calibration_resolutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_review_id uuid NOT NULL UNIQUE
    REFERENCES public.pragma_gold_calibration_reviews(id) ON DELETE RESTRICT,
  case_id text NOT NULL,
  case_version text NOT NULL,
  resolution_round integer NOT NULL CHECK (resolution_round > 0),
  resolution_status text NOT NULL CHECK (
    resolution_status IN ('researcher_approved', 'revise_required', 'rejected')
  ),
  resolved_case_snapshot jsonb,
  rationale_ko text NOT NULL CHECK (length(btrim(rationale_ko)) > 0),
  resolved_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  resolved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, case_version, resolution_round),
  CHECK (
    (resolution_status = 'researcher_approved' AND resolved_case_snapshot IS NOT NULL)
    OR (resolution_status <> 'researcher_approved' AND resolved_case_snapshot IS NULL)
  )
);

CREATE INDEX pragma_gold_calibration_reviews_case_idx
  ON public.pragma_gold_calibration_reviews(case_id, case_version, review_round DESC);
CREATE INDEX pragma_gold_calibration_resolutions_status_idx
  ON public.pragma_gold_calibration_resolutions(resolution_status, resolved_at DESC);

GRANT SELECT, INSERT ON public.pragma_gold_calibration_reviews TO authenticated;
GRANT SELECT, INSERT ON public.pragma_gold_calibration_resolutions TO authenticated;
GRANT ALL ON public.pragma_gold_calibration_reviews TO service_role;
GRANT ALL ON public.pragma_gold_calibration_resolutions TO service_role;
REVOKE UPDATE, DELETE ON public.pragma_gold_calibration_reviews FROM authenticated, anon;
REVOKE UPDATE, DELETE ON public.pragma_gold_calibration_resolutions FROM authenticated, anon;

ALTER TABLE public.pragma_gold_calibration_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pragma_gold_calibration_resolutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_gold_calibration_reviews"
  ON public.pragma_gold_calibration_reviews FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "admin_insert_gold_calibration_reviews"
  ON public.pragma_gold_calibration_reviews FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() AND reviewer_user_id = auth.uid());

CREATE POLICY "admin_read_gold_calibration_resolutions"
  ON public.pragma_gold_calibration_resolutions FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "admin_insert_gold_calibration_resolutions"
  ON public.pragma_gold_calibration_resolutions FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() AND resolved_by = auth.uid());

CREATE OR REPLACE FUNCTION public.validate_pragma_gold_calibration_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_context_keys integer;
  v_candidate_keys integer;
  v_snapshot_candidates integer;
BEGIN
  -- Client가 보낸 hash를 신뢰하지 않고, 저장될 정확한 jsonb snapshot에서 서버가 다시 계산한다.
  NEW.case_content_hash := encode(
    extensions.digest(convert_to(NEW.case_snapshot::text, 'UTF8'), 'sha256'::text),
    'hex'
  );

  IF jsonb_typeof(NEW.case_snapshot) IS DISTINCT FROM 'object'
     OR NEW.case_snapshot->>'case_id' IS DISTINCT FROM NEW.case_id
     OR NEW.case_snapshot->>'version' IS DISTINCT FROM NEW.case_version
     OR NEW.case_snapshot->>'realization_pack_id' IS DISTINCT FROM NEW.realization_pack_id
     OR NEW.case_snapshot->>'realization_pack_version' IS DISTINCT FROM NEW.realization_pack_version
     OR NEW.case_snapshot->>'direction' IS DISTINCT FROM 'ko_zh'
     OR NEW.case_snapshot#>>'{review,status}' IS DISTINCT FROM 'researcher_seed'
  THEN
    RAISE EXCEPTION 'calibration review identity or researcher_seed snapshot is invalid';
  END IF;

  IF jsonb_typeof(NEW.context_assessment) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'context_assessment must be an object';
  END IF;
  SELECT count(*) INTO v_context_keys FROM jsonb_object_keys(NEW.context_assessment);
  IF v_context_keys <> 3 OR EXISTS (
    SELECT 1 FROM jsonb_each(NEW.context_assessment) item
    WHERE item.key NOT IN ('scenario_valid', 'pdr_valid', 'semantic_invariant_valid')
       OR jsonb_typeof(item.value) <> 'boolean'
  ) THEN
    RAISE EXCEPTION 'context_assessment requires exactly three boolean gates';
  END IF;

  IF jsonb_typeof(NEW.candidate_assessments) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'candidate_assessments must be an object';
  END IF;
  SELECT count(*) INTO v_candidate_keys FROM jsonb_object_keys(NEW.candidate_assessments);
  IF v_candidate_keys <> 3 OR EXISTS (
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
    RAISE EXCEPTION 'candidate assessments require complete A/B/C band, semantic, and rationale judgments';
  END IF;

  IF jsonb_typeof(NEW.case_snapshot->'candidates') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'case snapshot candidates must be an array';
  END IF;
  SELECT count(DISTINCT candidate->>'candidate_id')
    INTO v_snapshot_candidates
  FROM jsonb_array_elements(NEW.case_snapshot->'candidates') candidate
  WHERE candidate->>'candidate_id' IN ('A', 'B', 'C');
  IF jsonb_array_length(NEW.case_snapshot->'candidates') <> 3 OR v_snapshot_candidates <> 3 THEN
    RAISE EXCEPTION 'case snapshot must contain exactly candidates A/B/C';
  END IF;

  IF NEW.overall_verdict = 'approve' AND (
    EXISTS (
      SELECT 1 FROM jsonb_each(NEW.context_assessment) item
      WHERE item.value <> 'true'::jsonb
    )
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(NEW.case_snapshot->'candidates') candidate
      WHERE NEW.candidate_assessments->(candidate->>'candidate_id')->>'semantic_fidelity' <> 'pass'
         OR NEW.candidate_assessments->(candidate->>'candidate_id')->>'assessed_band_code'
              IS DISTINCT FROM candidate->>'expected_band_code'
    )
  ) THEN
    RAISE EXCEPTION 'approve requires all context gates, semantic fidelity, and seed bands to agree';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_pragma_gold_calibration_review_trg
  BEFORE INSERT ON public.pragma_gold_calibration_reviews
  FOR EACH ROW EXECUTE FUNCTION public.validate_pragma_gold_calibration_review();

CREATE OR REPLACE FUNCTION public.validate_pragma_gold_calibration_resolution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_review public.pragma_gold_calibration_reviews%ROWTYPE;
BEGIN
  SELECT * INTO v_review
  FROM public.pragma_gold_calibration_reviews
  WHERE id = NEW.source_review_id;

  IF NOT FOUND
     OR NEW.case_id IS DISTINCT FROM v_review.case_id
     OR NEW.case_version IS DISTINCT FROM v_review.case_version
     OR NEW.resolution_round IS DISTINCT FROM v_review.review_round
  THEN
    RAISE EXCEPTION 'resolution identity must match its source review';
  END IF;

  IF (v_review.overall_verdict = 'approve' AND NEW.resolution_status <> 'researcher_approved')
     OR (v_review.overall_verdict = 'revise' AND NEW.resolution_status <> 'revise_required')
     OR (v_review.overall_verdict = 'reject' AND NEW.resolution_status <> 'rejected')
  THEN
    RAISE EXCEPTION 'resolution status must preserve the researcher review verdict';
  END IF;

  IF NEW.resolution_status = 'researcher_approved' AND (
    NEW.resolved_case_snapshot->>'case_id' IS DISTINCT FROM v_review.case_id
    OR NEW.resolved_case_snapshot->>'version' IS DISTINCT FROM v_review.case_version
    OR NEW.resolved_case_snapshot->>'realization_pack_id' IS DISTINCT FROM v_review.realization_pack_id
    OR NEW.resolved_case_snapshot->>'realization_pack_version' IS DISTINCT FROM v_review.realization_pack_version
    OR NEW.resolved_case_snapshot#>>'{review,status}' IS DISTINCT FROM 'researcher_approved'
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(NEW.resolved_case_snapshot->'candidates') candidate
      WHERE candidate->>'semantic_fidelity' <> 'pass'
    )
  ) THEN
    RAISE EXCEPTION 'researcher-approved resolution requires a matching approved case snapshot';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_pragma_gold_calibration_resolution_trg
  BEFORE INSERT ON public.pragma_gold_calibration_resolutions
  FOR EACH ROW EXECUTE FUNCTION public.validate_pragma_gold_calibration_resolution();

REVOKE ALL ON FUNCTION public.validate_pragma_gold_calibration_review() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_pragma_gold_calibration_resolution() FROM PUBLIC;
