-- PRAGMA moat v1.3: operational expert protocol.
-- Adds a versioned expert registry, forces blind same-round review, validates every
-- candidate/lineage judgment, and makes resolution an append-only revision with
-- explicit reviewer sign-off for discussion-based consensus.

CREATE TABLE public.pragma_expert_registry_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expert_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  registry_version integer NOT NULL CHECK (registry_version > 0),
  status text NOT NULL CHECK (status IN ('active', 'retired')),
  language_pairs text[] NOT NULL CHECK (cardinality(language_pairs) > 0),
  expertise_areas text[] NOT NULL CHECK (cardinality(expertise_areas) > 0),
  qualification_note text NOT NULL CHECK (length(btrim(qualification_note)) > 0),
  protocol_version text NOT NULL CHECK (protocol_version = 'expert_review_protocol_v1'),
  registered_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (expert_user_id, registry_version)
);

GRANT SELECT ON public.pragma_expert_registry_versions TO authenticated;
GRANT ALL ON public.pragma_expert_registry_versions TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.pragma_expert_registry_versions FROM authenticated, anon;

ALTER TABLE public.pragma_expert_registry_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_expert_registry"
  ON public.pragma_expert_registry_versions FOR SELECT
  TO authenticated USING (public.is_admin());

CREATE POLICY "expert_read_own_registry"
  ON public.pragma_expert_registry_versions FOR SELECT
  TO authenticated USING (expert_user_id = auth.uid());

ALTER TABLE public.mission_expert_review_assignments
  ADD COLUMN protocol_version text NOT NULL DEFAULT 'expert_review_protocol_v1'
    CHECK (protocol_version = 'expert_review_protocol_v1'),
  ADD COLUMN expert_registry_version_id uuid
    REFERENCES public.pragma_expert_registry_versions(id) ON DELETE RESTRICT;

ALTER TABLE public.mission_expert_reviews
  ADD COLUMN schema_version text NOT NULL DEFAULT 'mission_expert_review_v1'
    CHECK (schema_version IN ('mission_expert_review_v1', 'mission_expert_review_v2')),
  ADD COLUMN protocol_version text NOT NULL DEFAULT 'expert_review_protocol_v1'
    CHECK (protocol_version = 'expert_review_protocol_v1'),
  ADD COLUMN review_round integer,
  ADD COLUMN independence_declaration jsonb;

UPDATE public.mission_expert_reviews review
SET review_round = assignment.review_round
FROM public.mission_expert_review_assignments assignment
WHERE assignment.id = review.assignment_id
  AND review.review_round IS NULL;

ALTER TABLE public.mission_expert_reviews
  ALTER COLUMN review_round SET NOT NULL,
  ALTER COLUMN review_round SET DEFAULT 1,
  ADD CONSTRAINT mission_expert_reviews_round_positive CHECK (review_round > 0);

ALTER TABLE public.mission_review_resolutions
  ADD COLUMN review_round integer NOT NULL DEFAULT 1 CHECK (review_round > 0),
  ADD COLUMN resolution_revision integer NOT NULL DEFAULT 1 CHECK (resolution_revision > 0),
  ADD COLUMN supersedes_resolution_id uuid
    REFERENCES public.mission_review_resolutions(id) ON DELETE RESTRICT,
  ADD COLUMN protocol_version text NOT NULL DEFAULT 'expert_review_protocol_v1'
    CHECK (protocol_version = 'expert_review_protocol_v1');

WITH numbered AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY lineage_version_id, review_round
           ORDER BY resolved_at, id
         ) AS revision
  FROM public.mission_review_resolutions
)
UPDATE public.mission_review_resolutions resolution
SET resolution_revision = numbered.revision
FROM numbered
WHERE numbered.id = resolution.id;

CREATE UNIQUE INDEX mission_review_resolution_revision_idx
  ON public.mission_review_resolutions(lineage_version_id, review_round, resolution_revision);
CREATE UNIQUE INDEX mission_review_resolution_superseded_once_idx
  ON public.mission_review_resolutions(supersedes_resolution_id)
  WHERE supersedes_resolution_id IS NOT NULL;

CREATE TABLE public.mission_review_resolution_signoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resolution_id uuid NOT NULL
    REFERENCES public.mission_review_resolutions(id) ON DELETE RESTRICT,
  reviewer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  decision text NOT NULL CHECK (decision IN ('agree', 'disagree')),
  rationale_ko text NOT NULL CHECK (length(btrim(rationale_ko)) > 0),
  signed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (resolution_id, reviewer_user_id)
);

GRANT SELECT, INSERT ON public.mission_review_resolution_signoffs TO authenticated;
GRANT ALL ON public.mission_review_resolution_signoffs TO service_role;
REVOKE UPDATE, DELETE ON public.mission_review_resolution_signoffs FROM authenticated, anon;

ALTER TABLE public.mission_review_resolution_signoffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_resolution_signoffs"
  ON public.mission_review_resolution_signoffs FOR SELECT
  TO authenticated USING (public.is_admin());

CREATE POLICY "reviewer_read_own_resolution_signoff"
  ON public.mission_review_resolution_signoffs FOR SELECT
  TO authenticated USING (reviewer_user_id = auth.uid());

CREATE POLICY "reviewer_insert_resolution_signoff"
  ON public.mission_review_resolution_signoffs FOR INSERT
  TO authenticated WITH CHECK (reviewer_user_id = auth.uid());

CREATE POLICY "reviewer_read_own_review_resolution"
  ON public.mission_review_resolutions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.mission_expert_reviews review
      WHERE review.id = ANY(mission_review_resolutions.review_ids)
        AND review.reviewer_user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.register_pragma_expert(
  p_expert_user_id uuid,
  p_status text,
  p_language_pairs text[],
  p_expertise_areas text[],
  p_qualification_note text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_version integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can register experts';
  END IF;
  IF p_status NOT IN ('active', 'retired')
     OR cardinality(p_language_pairs) = 0
     OR cardinality(p_expertise_areas) = 0
     OR length(btrim(COALESCE(p_qualification_note, ''))) = 0
  THEN
    RAISE EXCEPTION 'Complete expert registration metadata is required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = p_expert_user_id
      AND role = 'learner'::public.app_role
  ) THEN
    RAISE EXCEPTION 'Expert must be a non-admin authenticated profile';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_expert_user_id::text, 0));
  SELECT COALESCE(max(registry_version), 0) + 1 INTO v_version
  FROM public.pragma_expert_registry_versions
  WHERE expert_user_id = p_expert_user_id;

  INSERT INTO public.pragma_expert_registry_versions (
    expert_user_id, registry_version, status, language_pairs, expertise_areas,
    qualification_note, protocol_version, registered_by
  ) VALUES (
    p_expert_user_id, v_version, p_status, p_language_pairs, p_expertise_areas,
    p_qualification_note, 'expert_review_protocol_v1', auth.uid()
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.register_pragma_expert(uuid, text, text[], text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_pragma_expert(uuid, text, text[], text[], text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.validate_mission_expert_assignment_v2()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_registry public.pragma_expert_registry_versions%ROWTYPE;
BEGIN
  IF NEW.blind_review IS DISTINCT FROM true
     OR NEW.protocol_version IS DISTINCT FROM 'expert_review_protocol_v1'
     OR NEW.expert_registry_version_id IS NULL
  THEN
    RAISE EXCEPTION 'expert assignment requires the blind versioned protocol';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = NEW.reviewer_user_id AND role = 'admin'::public.app_role
  ) THEN
    RAISE EXCEPTION 'administrators cannot serve as blind expert reviewers';
  END IF;

  SELECT * INTO v_registry
  FROM public.pragma_expert_registry_versions
  WHERE id = NEW.expert_registry_version_id
    AND expert_user_id = NEW.reviewer_user_id;
  IF NOT FOUND OR v_registry.status <> 'active'
     OR v_registry.protocol_version <> NEW.protocol_version
     OR NOT ('ko_zh' = ANY(v_registry.language_pairs))
  THEN
    RAISE EXCEPTION 'assignment requires the latest active ko_zh expert registry version';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.pragma_expert_registry_versions later
    WHERE later.expert_user_id = NEW.reviewer_user_id
      AND later.registry_version > v_registry.registry_version
  ) THEN
    RAISE EXCEPTION 'assignment must use the latest expert registry version';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.mission_lineage_versions lineage
    WHERE lineage.id = NEW.lineage_version_id
      AND lineage.stage = 'reviewed'
      AND lineage.coverage_status = 'covered'
      AND lineage.item_lineage IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'only reviewed covered item-lineage versions can be assigned';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_mission_expert_assignment_v2_trg
  ON public.mission_expert_review_assignments;
CREATE TRIGGER validate_mission_expert_assignment_v2_trg
  BEFORE INSERT ON public.mission_expert_review_assignments
  FOR EACH ROW EXECUTE FUNCTION public.validate_mission_expert_assignment_v2();

CREATE OR REPLACE FUNCTION public.assign_mission_expert_review(
  p_lineage_version_id uuid,
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
    RAISE EXCEPTION 'Only admins can create valid expert assignments';
  END IF;

  SELECT id INTO v_registry_id
  FROM public.pragma_expert_registry_versions
  WHERE expert_user_id = p_reviewer_user_id
  ORDER BY registry_version DESC
  LIMIT 1;

  INSERT INTO public.mission_expert_review_assignments (
    lineage_version_id, reviewer_user_id, review_round, blind_review,
    assigned_by, protocol_version, expert_registry_version_id
  ) VALUES (
    p_lineage_version_id, p_reviewer_user_id, p_review_round, true,
    auth.uid(), 'expert_review_protocol_v1', v_registry_id
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE INSERT ON public.mission_expert_review_assignments FROM authenticated;
REVOKE ALL ON FUNCTION public.assign_mission_expert_review(uuid, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_mission_expert_review(uuid, uuid, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.validate_mission_expert_review_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assignment public.mission_expert_review_assignments%ROWTYPE;
  v_lineage public.mission_lineage_versions%ROWTYPE;
  v_expected_claims integer;
  v_received_claims integer;
BEGIN
  SELECT * INTO v_assignment
  FROM public.mission_expert_review_assignments
  WHERE id = NEW.assignment_id
    AND lineage_version_id = NEW.lineage_version_id
    AND reviewer_user_id = NEW.reviewer_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'expert review does not match its assignment';
  END IF;

  SELECT * INTO v_lineage
  FROM public.mission_lineage_versions
  WHERE id = NEW.lineage_version_id;

  IF NEW.schema_version = 'mission_expert_review_v2' THEN
    IF v_assignment.blind_review IS DISTINCT FROM true
       OR NEW.protocol_version IS DISTINCT FROM v_assignment.protocol_version
       OR NEW.review_round IS DISTINCT FROM v_assignment.review_round
       OR NEW.independence_declaration IS DISTINCT FROM jsonb_build_object(
         'reviewed_independently', true,
         'conflict_of_interest', false,
         'chinese_proficiency_confirmed', true
       )
    THEN
      RAISE EXCEPTION 'v2 review requires same-round blind protocol and independence declaration';
    END IF;
  END IF;

  IF v_lineage.item_lineage IS NULL THEN
    IF NEW.lineage_claim_assessments <> '{}'::jsonb THEN
      RAISE EXCEPTION 'legacy lineage without item claims cannot receive claim assessments';
    END IF;
    RETURN NEW;
  END IF;

  IF jsonb_typeof(NEW.lineage_claim_assessments) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'lineage_claim_assessments must be an object keyed by claim_id';
  END IF;
  SELECT jsonb_array_length(v_lineage.item_lineage->'claims'), count(*)
    INTO v_expected_claims, v_received_claims
  FROM jsonb_object_keys(NEW.lineage_claim_assessments);
  IF v_expected_claims <> v_received_claims OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_lineage.item_lineage->'claims') claim
    WHERE NOT (NEW.lineage_claim_assessments ? (claim->>'claim_id'))
  ) THEN
    RAISE EXCEPTION 'every item lineage claim must have exactly one expert assessment';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_each(NEW.lineage_claim_assessments) assessment
    WHERE jsonb_typeof(assessment.value) <> 'object'
       OR assessment.value->>'verdict' NOT IN ('support', 'revise', 'reject', 'uncertain')
       OR length(btrim(COALESCE(assessment.value->>'rationale_ko', ''))) = 0
       OR (assessment.value ? 'proposed_rule_ids' AND jsonb_typeof(assessment.value->'proposed_rule_ids') <> 'array')
       OR (assessment.value ? 'proposed_risk_ids' AND jsonb_typeof(assessment.value->'proposed_risk_ids') <> 'array')
  ) THEN
    RAISE EXCEPTION 'each claim assessment needs a valid verdict, rationale, and ID arrays';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_each(NEW.lineage_claim_assessments) assessment
    WHERE (
      assessment.value->>'verdict' = 'revise'
      AND jsonb_array_length(COALESCE(assessment.value->'proposed_rule_ids', '[]'::jsonb))
        + jsonb_array_length(COALESCE(assessment.value->'proposed_risk_ids', '[]'::jsonb)) = 0
    ) OR (
      assessment.value->>'verdict' <> 'revise'
      AND jsonb_array_length(COALESCE(assessment.value->'proposed_rule_ids', '[]'::jsonb))
        + jsonb_array_length(COALESCE(assessment.value->'proposed_risk_ids', '[]'::jsonb)) > 0
    )
  ) THEN
    RAISE EXCEPTION 'replacement IDs are required only for revise claim assessments';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_each(NEW.lineage_claim_assessments) assessment,
         LATERAL jsonb_array_elements_text(COALESCE(assessment.value->'proposed_rule_ids', '[]'::jsonb)) proposed(value)
    WHERE NOT (proposed.value = ANY(v_lineage.rule_scope_ids))
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_each(NEW.lineage_claim_assessments) assessment,
         LATERAL jsonb_array_elements_text(COALESCE(assessment.value->'proposed_risk_ids', '[]'::jsonb)) proposed(value)
    WHERE NOT (proposed.value = ANY(v_lineage.risk_scope_ids))
  ) THEN
    RAISE EXCEPTION 'proposed lineage IDs must stay inside the versioned mission scope';
  END IF;

  IF NEW.schema_version = 'mission_expert_review_v2' THEN
    IF jsonb_typeof(NEW.candidate_band_assessments) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'candidate_band_assessments must be an object keyed by claim_id';
    END IF;
    SELECT count(*) INTO v_received_claims
    FROM jsonb_object_keys(NEW.candidate_band_assessments);
    IF v_expected_claims <> v_received_claims OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_lineage.item_lineage->'claims') claim
      WHERE NOT (NEW.candidate_band_assessments ? (claim->>'claim_id'))
    ) THEN
      RAISE EXCEPTION 'every item lineage claim must have exactly one candidate band assessment';
    END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_each(NEW.candidate_band_assessments) assessment
      WHERE jsonb_typeof(assessment.value) <> 'object'
         OR assessment.value->>'band_code' NOT IN (
           'too_direct', 'within_band', 'too_indirect', 'too_blunt',
           'over_elaborate', 'insufficient', 'excessive', 'uncertain'
         )
         OR length(btrim(COALESCE(assessment.value->>'rationale_ko', ''))) = 0
    ) THEN
      RAISE EXCEPTION 'each candidate band assessment needs a valid band and rationale';
    END IF;
    IF jsonb_typeof(NEW.rule_findings) IS DISTINCT FROM 'array' OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(NEW.rule_findings) finding
      WHERE jsonb_typeof(finding) <> 'object'
         OR finding->>'kind' NOT IN (
           'missing_rule', 'overbroad_rule', 'unsupported_rule', 'language_issue', 'other'
         )
         OR length(btrim(COALESCE(finding->>'rationale_ko', ''))) = 0
    ) THEN
      RAISE EXCEPTION 'rule_findings must be a valid array';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

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
  v_assignment_count integer;
  v_submitted_count integer;
  v_item_lineage jsonb;
  v_rule_scope text[];
  v_risk_scope text[];
  v_expected_claims integer;
  v_resolved_claims integer;
  v_previous public.mission_review_resolutions%ROWTYPE;
  v_overall_variants integer;
  v_candidate_variants integer;
  v_claim_variants integer;
  v_unanimous_verdict text;
BEGIN
  SELECT cardinality(NEW.review_ids), count(DISTINCT review_id)
    INTO v_total, v_distinct
  FROM unnest(NEW.review_ids) AS review_id;

  SELECT count(*), count(DISTINCT review.reviewer_user_id)
    INTO v_matching, v_distinct_reviewers
  FROM public.mission_expert_reviews review
  JOIN public.mission_expert_review_assignments assignment
    ON assignment.id = review.assignment_id
  WHERE review.id = ANY(NEW.review_ids)
    AND review.lineage_version_id = NEW.lineage_version_id
    AND review.review_round = NEW.review_round
    AND assignment.review_round = NEW.review_round
    AND assignment.blind_review = true
    AND review.schema_version = 'mission_expert_review_v2';

  SELECT count(*) INTO v_assignment_count
  FROM public.mission_expert_review_assignments
  WHERE lineage_version_id = NEW.lineage_version_id
    AND review_round = NEW.review_round
    AND blind_review = true;
  SELECT count(*) INTO v_submitted_count
  FROM public.mission_expert_reviews
  WHERE lineage_version_id = NEW.lineage_version_id
    AND review_round = NEW.review_round
    AND schema_version = 'mission_expert_review_v2';

  IF v_total <> v_distinct OR v_matching <> v_total OR v_distinct_reviewers < 2
     OR v_assignment_count <> v_submitted_count OR v_total <> v_submitted_count
  THEN
    RAISE EXCEPTION 'resolution requires every same-round blind assignment and at least two independent reviewers';
  END IF;

  IF NEW.resolution_revision = 1 THEN
    IF NEW.supersedes_resolution_id IS NOT NULL THEN
      RAISE EXCEPTION 'first resolution revision cannot supersede another row';
    END IF;
  ELSE
    SELECT * INTO v_previous
    FROM public.mission_review_resolutions
    WHERE id = NEW.supersedes_resolution_id
      AND lineage_version_id = NEW.lineage_version_id
      AND review_round = NEW.review_round
      AND resolution_revision = NEW.resolution_revision - 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'resolution revisions must form a contiguous same-round chain';
    END IF;
  END IF;

  SELECT item_lineage, rule_scope_ids, risk_scope_ids
    INTO v_item_lineage, v_rule_scope, v_risk_scope
  FROM public.mission_lineage_versions
  WHERE id = NEW.lineage_version_id;

  IF NEW.resolution_status = 'unresolved' THEN
    IF NEW.final_verdict IS NOT NULL OR NEW.resolved_candidate_bands IS NOT NULL
       OR NEW.resolved_lineage_claims IS NOT NULL
    THEN
      RAISE EXCEPTION 'unresolved resolution cannot contain final judgments';
    END IF;
    RETURN NEW;
  END IF;

  IF jsonb_typeof(NEW.resolved_candidate_bands) IS DISTINCT FROM 'object'
     OR jsonb_typeof(NEW.resolved_lineage_claims) IS DISTINCT FROM 'object'
  THEN
    RAISE EXCEPTION 'resolved candidate bands and lineage claims are required';
  END IF;
  SELECT jsonb_array_length(v_item_lineage->'claims'), count(*)
    INTO v_expected_claims, v_resolved_claims
  FROM jsonb_object_keys(NEW.resolved_candidate_bands);
  IF v_expected_claims <> v_resolved_claims OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_item_lineage->'claims') claim
    WHERE NOT (NEW.resolved_candidate_bands ? (claim->>'claim_id'))
  ) THEN
    RAISE EXCEPTION 'resolved candidate bands must cover every claim exactly once';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_each(NEW.resolved_candidate_bands) assessment
    WHERE jsonb_typeof(assessment.value) <> 'object'
       OR assessment.value->>'band_code' NOT IN (
         'too_direct', 'within_band', 'too_indirect', 'too_blunt',
         'over_elaborate', 'insufficient', 'excessive', 'uncertain'
       )
       OR length(btrim(COALESCE(assessment.value->>'rationale_ko', ''))) = 0
  ) THEN
    RAISE EXCEPTION 'resolved candidate bands need valid bands and rationales';
  END IF;

  SELECT count(*) INTO v_resolved_claims
  FROM jsonb_object_keys(NEW.resolved_lineage_claims);
  IF v_expected_claims <> v_resolved_claims OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_item_lineage->'claims') claim
    WHERE NOT (NEW.resolved_lineage_claims ? (claim->>'claim_id'))
  ) THEN
    RAISE EXCEPTION 'resolution must cover every item lineage claim exactly once';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_each(NEW.resolved_lineage_claims) resolved
    WHERE jsonb_typeof(resolved.value) <> 'object'
       OR resolved.value->>'verdict' NOT IN ('supported', 'revised', 'rejected')
       OR length(btrim(COALESCE(resolved.value->>'rationale_ko', ''))) = 0
       OR jsonb_typeof(COALESCE(resolved.value->'final_rule_ids', '[]'::jsonb)) <> 'array'
       OR jsonb_typeof(COALESCE(resolved.value->'final_risk_ids', '[]'::jsonb)) <> 'array'
  ) THEN
    RAISE EXCEPTION 'each resolved lineage claim needs a valid verdict, rationale, and final ID arrays';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_each(NEW.resolved_lineage_claims) resolved,
         LATERAL jsonb_array_elements_text(COALESCE(resolved.value->'final_rule_ids', '[]'::jsonb)) final_id(value)
    WHERE NOT (final_id.value = ANY(v_rule_scope))
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_each(NEW.resolved_lineage_claims) resolved,
         LATERAL jsonb_array_elements_text(COALESCE(resolved.value->'final_risk_ids', '[]'::jsonb)) final_id(value)
    WHERE NOT (final_id.value = ANY(v_risk_scope))
  ) THEN
    RAISE EXCEPTION 'resolved lineage IDs must stay inside the versioned mission scope';
  END IF;
  IF NEW.final_verdict = 'approve' AND EXISTS (
    SELECT 1 FROM jsonb_each(NEW.resolved_lineage_claims) resolved
    WHERE resolved.value->>'verdict' = 'rejected'
       OR COALESCE(resolved.value->'final_rule_ids', '[]'::jsonb)
          || COALESCE(resolved.value->'final_risk_ids', '[]'::jsonb) = '[]'::jsonb
  ) THEN
    RAISE EXCEPTION 'approved resolution requires a non-rejected, attributed result for every claim';
  END IF;

  IF NEW.resolution_status = 'unanimous' THEN
    SELECT count(DISTINCT overall_verdict),
           count(DISTINCT candidate_band_assessments::text),
           count(DISTINCT lineage_claim_assessments::text),
           min(overall_verdict)
      INTO v_overall_variants, v_candidate_variants, v_claim_variants, v_unanimous_verdict
    FROM public.mission_expert_reviews
    WHERE id = ANY(NEW.review_ids);
    IF v_overall_variants <> 1 OR v_candidate_variants <> 1 OR v_claim_variants <> 1
       OR NEW.final_verdict IS DISTINCT FROM v_unanimous_verdict
       OR EXISTS (
         SELECT 1 FROM public.mission_expert_reviews review,
              LATERAL jsonb_each(review.lineage_claim_assessments) assessment
         WHERE review.id = ANY(NEW.review_ids)
           AND assessment.value->>'verdict' = 'uncertain'
       )
    THEN
      RAISE EXCEPTION 'unanimous status requires actually identical, non-uncertain reviews';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.propose_mission_review_resolution(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_lineage_id uuid := (p_payload->>'lineage_version_id')::uuid;
  v_round integer := (p_payload->>'review_round')::integer;
  v_revision integer;
  v_previous uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can propose review resolutions';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_lineage_id::text || ':' || v_round::text, 0));
  SELECT id, resolution_revision + 1 INTO v_previous, v_revision
  FROM public.mission_review_resolutions
  WHERE lineage_version_id = v_lineage_id AND review_round = v_round
  ORDER BY resolution_revision DESC
  LIMIT 1;
  v_revision := COALESCE(v_revision, 1);

  INSERT INTO public.mission_review_resolutions (
    lineage_version_id, review_ids, resolution_status, final_verdict,
    resolved_candidate_bands, resolved_lineage_claims, rationale_ko, resolved_by,
    review_round, resolution_revision, supersedes_resolution_id, protocol_version
  ) VALUES (
    v_lineage_id,
    ARRAY(SELECT jsonb_array_elements_text(p_payload->'review_ids'))::uuid[],
    p_payload->>'resolution_status', NULLIF(p_payload->>'final_verdict', ''),
    p_payload->'resolved_candidate_bands', p_payload->'resolved_lineage_claims',
    p_payload->>'rationale_ko', auth.uid(),
    v_round, v_revision, v_previous, 'expert_review_protocol_v1'
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE INSERT ON public.mission_review_resolutions FROM authenticated;
REVOKE ALL ON FUNCTION public.propose_mission_review_resolution(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.propose_mission_review_resolution(jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.validate_mission_review_resolution_signoff()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.mission_review_resolutions resolution
    JOIN public.mission_expert_reviews review
      ON review.id = ANY(resolution.review_ids)
    WHERE resolution.id = NEW.resolution_id
      AND resolution.resolution_status = 'consensus_after_discussion'
      AND review.reviewer_user_id = NEW.reviewer_user_id
  ) THEN
    RAISE EXCEPTION 'only included reviewers may sign a discussion resolution';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_mission_review_resolution_signoff_trg
  BEFORE INSERT ON public.mission_review_resolution_signoffs
  FOR EACH ROW EXECUTE FUNCTION public.validate_mission_review_resolution_signoff();

REVOKE ALL ON FUNCTION public.validate_mission_expert_assignment_v2() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_mission_expert_review_assignment() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_mission_review_resolution() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_mission_review_resolution_signoff() FROM PUBLIC;

