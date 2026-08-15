-- PRAGMA moat v1: blind independent expert review and explicit resolution.
-- 검토자는 제출 전 서로의 판정을 읽지 못하고, 불일치는 삭제·덮어쓰기 대신
-- 후보별 판정과 근거를 그대로 보존한다.

CREATE TABLE public.mission_expert_review_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lineage_version_id uuid NOT NULL
    REFERENCES public.mission_lineage_versions(id) ON DELETE CASCADE,
  reviewer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  review_round integer NOT NULL DEFAULT 1 CHECK (review_round > 0),
  blind_review boolean NOT NULL DEFAULT true,
  assigned_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lineage_version_id, reviewer_user_id, review_round)
);

CREATE TABLE public.mission_expert_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL UNIQUE
    REFERENCES public.mission_expert_review_assignments(id) ON DELETE RESTRICT,
  lineage_version_id uuid NOT NULL
    REFERENCES public.mission_lineage_versions(id) ON DELETE CASCADE,
  reviewer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  overall_verdict text NOT NULL CHECK (overall_verdict IN ('approve', 'revise', 'reject')),
  confidence smallint NOT NULL CHECK (confidence BETWEEN 1 AND 5),
  candidate_band_assessments jsonb NOT NULL DEFAULT '{}'::jsonb,
  rule_findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- claim_id → {verdict, rationale_ko, proposed_rule_ids?, proposed_risk_ids?}
  -- AI의 pending claim을 덮어쓰지 않고 전문가별 판정을 별도 보존한다.
  lineage_claim_assessments jsonb NOT NULL DEFAULT '{}'::jsonb,
  rationale_ko text NOT NULL CHECK (length(btrim(rationale_ko)) > 0),
  submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.mission_review_resolutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lineage_version_id uuid NOT NULL
    REFERENCES public.mission_lineage_versions(id) ON DELETE CASCADE,
  review_ids uuid[] NOT NULL CHECK (cardinality(review_ids) >= 2),
  resolution_status text NOT NULL CHECK (
    resolution_status IN (
      'unanimous', 'consensus_after_discussion', 'researcher_decision', 'unresolved'
    )
  ),
  final_verdict text CHECK (final_verdict IN ('approve', 'revise', 'reject')),
  resolved_candidate_bands jsonb,
  -- claim_id → {verdict, final_rule_ids, final_risk_ids, rationale_ko}
  resolved_lineage_claims jsonb,
  rationale_ko text NOT NULL CHECK (length(btrim(rationale_ko)) > 0),
  resolved_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  resolved_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (resolution_status = 'unresolved' AND final_verdict IS NULL)
    OR (resolution_status <> 'unresolved' AND final_verdict IS NOT NULL)
  )
);

CREATE INDEX mission_expert_assignment_reviewer_idx
  ON public.mission_expert_review_assignments(reviewer_user_id, assigned_at DESC);
CREATE INDEX mission_expert_reviews_lineage_idx
  ON public.mission_expert_reviews(lineage_version_id, submitted_at DESC);
CREATE INDEX mission_review_resolutions_lineage_idx
  ON public.mission_review_resolutions(lineage_version_id, resolved_at DESC);

GRANT SELECT, INSERT ON public.mission_expert_review_assignments TO authenticated;
GRANT SELECT, INSERT ON public.mission_expert_reviews TO authenticated;
GRANT SELECT, INSERT ON public.mission_review_resolutions TO authenticated;
GRANT ALL ON public.mission_expert_review_assignments TO service_role;
GRANT ALL ON public.mission_expert_reviews TO service_role;
GRANT ALL ON public.mission_review_resolutions TO service_role;
REVOKE UPDATE, DELETE ON public.mission_expert_review_assignments FROM authenticated, anon;
REVOKE UPDATE, DELETE ON public.mission_expert_reviews FROM authenticated, anon;
REVOKE UPDATE, DELETE ON public.mission_review_resolutions FROM authenticated, anon;

ALTER TABLE public.mission_expert_review_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_expert_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_review_resolutions ENABLE ROW LEVEL SECURITY;

-- 배정된 검토자는 해당 불변 lineage snapshot만 읽을 수 있다. 다른 버전과
-- 다른 검토자의 판정은 보이지 않아 blind review를 유지한다.
CREATE POLICY "reviewer_read_assigned_lineage"
  ON public.mission_lineage_versions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.mission_expert_review_assignments a
      WHERE a.lineage_version_id = mission_lineage_versions.id
        AND a.reviewer_user_id = auth.uid()
    )
  );

CREATE POLICY "admin_manage_expert_assignments"
  ON public.mission_expert_review_assignments FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin() AND assigned_by = auth.uid());

CREATE POLICY "reviewer_read_own_assignment"
  ON public.mission_expert_review_assignments FOR SELECT
  TO authenticated
  USING (reviewer_user_id = auth.uid());

CREATE POLICY "admin_read_all_expert_reviews"
  ON public.mission_expert_reviews FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "reviewer_read_own_review"
  ON public.mission_expert_reviews FOR SELECT
  TO authenticated
  USING (reviewer_user_id = auth.uid());

CREATE POLICY "reviewer_submit_assigned_review"
  ON public.mission_expert_reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    reviewer_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.mission_expert_review_assignments a
      WHERE a.id = assignment_id
        AND a.lineage_version_id = lineage_version_id
        AND a.reviewer_user_id = auth.uid()
    )
  );

CREATE POLICY "admin_read_review_resolutions"
  ON public.mission_review_resolutions FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "admin_insert_review_resolutions"
  ON public.mission_review_resolutions FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() AND resolved_by = auth.uid());

-- RLS를 우회하는 service_role 경로에서도 assignment/lineage 위조를 막는다.
CREATE OR REPLACE FUNCTION public.validate_mission_expert_review_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lineage public.mission_lineage_versions%ROWTYPE;
  v_expected_claims integer;
  v_received_claims integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.mission_expert_review_assignments a
    WHERE a.id = NEW.assignment_id
      AND a.lineage_version_id = NEW.lineage_version_id
      AND a.reviewer_user_id = NEW.reviewer_user_id
  ) THEN
    RAISE EXCEPTION 'expert review does not match its assignment';
  END IF;

  SELECT * INTO v_lineage
  FROM public.mission_lineage_versions
  WHERE id = NEW.lineage_version_id;

  IF v_lineage.item_lineage IS NULL THEN
    IF NEW.lineage_claim_assessments <> '{}'::jsonb THEN
      RAISE EXCEPTION 'legacy lineage without item claims cannot receive claim assessments';
    END IF;
    RETURN NEW;
  END IF;

  IF jsonb_typeof(NEW.lineage_claim_assessments) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'lineage_claim_assessments must be an object keyed by claim_id';
  END IF;

  SELECT jsonb_array_length(v_lineage.item_lineage->'claims'),
         count(*)
    INTO v_expected_claims, v_received_claims
  FROM jsonb_object_keys(NEW.lineage_claim_assessments);

  IF v_expected_claims <> v_received_claims OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_lineage.item_lineage->'claims') claim
    WHERE NOT (NEW.lineage_claim_assessments ? (claim->>'claim_id'))
  ) THEN
    RAISE EXCEPTION 'every item lineage claim must have exactly one expert assessment';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_each(NEW.lineage_claim_assessments) assessment
    WHERE jsonb_typeof(assessment.value) <> 'object'
       OR assessment.value->>'verdict' IS NULL
       OR assessment.value->>'verdict' NOT IN ('support', 'revise', 'reject', 'uncertain')
       OR length(btrim(COALESCE(assessment.value->>'rationale_ko', ''))) = 0
  ) THEN
    RAISE EXCEPTION 'each claim assessment needs a valid verdict and non-empty rationale';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_each(NEW.lineage_claim_assessments) assessment
    WHERE (assessment.value ? 'proposed_rule_ids' AND jsonb_typeof(assessment.value->'proposed_rule_ids') <> 'array')
       OR (assessment.value ? 'proposed_risk_ids' AND jsonb_typeof(assessment.value->'proposed_risk_ids') <> 'array')
  ) THEN
    RAISE EXCEPTION 'proposed rule/risk IDs must be arrays';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_each(NEW.lineage_claim_assessments) assessment
    WHERE assessment.value->>'verdict' = 'revise'
      AND jsonb_array_length(COALESCE(assessment.value->'proposed_rule_ids', '[]'::jsonb))
        + jsonb_array_length(COALESCE(assessment.value->'proposed_risk_ids', '[]'::jsonb)) = 0
  ) THEN
    RAISE EXCEPTION 'revise claim assessment requires at least one proposed rule or risk ID';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_each(NEW.lineage_claim_assessments) assessment,
         LATERAL jsonb_array_elements_text(COALESCE(assessment.value->'proposed_rule_ids', '[]'::jsonb)) proposed_id(value)
    WHERE NOT (proposed_id.value = ANY(v_lineage.rule_scope_ids))
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_each(NEW.lineage_claim_assessments) assessment,
         LATERAL jsonb_array_elements_text(COALESCE(assessment.value->'proposed_risk_ids', '[]'::jsonb)) proposed_id(value)
    WHERE NOT (proposed_id.value = ANY(v_lineage.risk_scope_ids))
  ) THEN
    RAISE EXCEPTION 'proposed lineage IDs must stay inside the versioned mission scope';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_mission_expert_review_assignment_trg
  BEFORE INSERT ON public.mission_expert_reviews
  FOR EACH ROW EXECUTE FUNCTION public.validate_mission_expert_review_assignment();

-- resolution의 review_ids는 모두 존재하고 같은 lineage에 속하며 중복이 없어야 한다.
CREATE OR REPLACE FUNCTION public.validate_mission_review_resolution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer;
  v_distinct integer;
  v_matching integer;
  v_distinct_reviewers integer;
  v_item_lineage jsonb;
  v_expected_claims integer;
  v_resolved_claims integer;
BEGIN
  SELECT cardinality(NEW.review_ids), count(DISTINCT review_id)
    INTO v_total, v_distinct
  FROM unnest(NEW.review_ids) AS review_id;

  SELECT count(*), count(DISTINCT reviewer_user_id)
    INTO v_matching, v_distinct_reviewers
  FROM public.mission_expert_reviews r
  WHERE r.id = ANY(NEW.review_ids)
    AND r.lineage_version_id = NEW.lineage_version_id;

  IF v_total <> v_distinct OR v_matching <> v_total OR v_distinct_reviewers < 2 THEN
    RAISE EXCEPTION 'resolution reviews must belong to the same lineage version and at least two independent reviewers';
  END IF;

  SELECT item_lineage INTO v_item_lineage
  FROM public.mission_lineage_versions
  WHERE id = NEW.lineage_version_id;

  IF NEW.resolution_status <> 'unresolved' AND v_item_lineage IS NOT NULL THEN
    IF jsonb_typeof(NEW.resolved_lineage_claims) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'resolved lineage claims are required for a resolved item-lineage review';
    END IF;
    SELECT jsonb_array_length(v_item_lineage->'claims'), count(*)
      INTO v_expected_claims, v_resolved_claims
    FROM jsonb_object_keys(NEW.resolved_lineage_claims);
    IF v_expected_claims <> v_resolved_claims OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_item_lineage->'claims') claim
      WHERE NOT (NEW.resolved_lineage_claims ? (claim->>'claim_id'))
    ) THEN
      RAISE EXCEPTION 'resolution must cover every item lineage claim exactly once';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM jsonb_each(NEW.resolved_lineage_claims) resolved
      WHERE jsonb_typeof(resolved.value) <> 'object'
         OR resolved.value->>'verdict' IS NULL
         OR resolved.value->>'verdict' NOT IN ('supported', 'revised', 'rejected')
         OR length(btrim(COALESCE(resolved.value->>'rationale_ko', ''))) = 0
    ) THEN
      RAISE EXCEPTION 'each resolved lineage claim needs a valid verdict and rationale';
    END IF;
    IF NEW.final_verdict = 'approve' AND EXISTS (
      SELECT 1
      FROM jsonb_each(NEW.resolved_lineage_claims) resolved
      WHERE resolved.value->>'verdict' = 'rejected'
    ) THEN
      RAISE EXCEPTION 'an approved mission cannot retain a rejected lineage claim';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_mission_review_resolution_trg
  BEFORE INSERT ON public.mission_review_resolutions
  FOR EACH ROW EXECUTE FUNCTION public.validate_mission_review_resolution();

REVOKE ALL ON FUNCTION public.validate_mission_expert_review_assignment() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_mission_review_resolution() FROM PUBLIC;
