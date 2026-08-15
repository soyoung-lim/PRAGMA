-- PRAGMA moat v1: evidence-to-change queue.
-- 반복 이견·회귀 실패는 자동 규칙 변경이 아니라 immutable candidate로 들어가며,
-- 인간 승인과 새 pack/Gold 버전이 있어야 applied 결정을 기록할 수 있다.

CREATE TABLE public.pragma_improvement_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_key text NOT NULL UNIQUE,
  signal_type text NOT NULL CHECK (signal_type IN (
    'learner_dissent_cluster', 'gold_regression_drift', 'expert_disagreement'
  )),
  target_feature text,
  content_hash text,
  realization_pack_id text,
  realization_pack_version text,
  source_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  suggested_action text NOT NULL CHECK (suggested_action IN (
    'review_content_and_rule_scope',
    'review_gold_label_or_evaluator',
    'resolve_expert_boundary_case'
  )),
  proposed_change jsonb,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.pragma_improvement_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.pragma_improvement_candidates(id) ON DELETE RESTRICT,
  decision text NOT NULL CHECK (decision IN ('triage', 'approve', 'reject', 'applied')),
  note_ko text NOT NULL CHECK (length(btrim(note_ko)) > 0),
  resulting_pack_id text,
  resulting_pack_version text,
  resulting_gold_case_ids text[] NOT NULL DEFAULT '{}',
  decided_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  decided_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    decision <> 'applied'
    OR (
      resulting_pack_id IS NOT NULL
      AND resulting_pack_version IS NOT NULL
      AND resulting_pack_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'
      AND cardinality(resulting_gold_case_ids) > 0
    )
  )
);

CREATE INDEX pragma_improvement_candidates_signal_idx
  ON public.pragma_improvement_candidates(signal_type, created_at DESC);
CREATE INDEX pragma_improvement_decisions_candidate_idx
  ON public.pragma_improvement_decisions(candidate_id, decided_at);
CREATE UNIQUE INDEX pragma_improvement_one_applied_idx
  ON public.pragma_improvement_decisions(candidate_id)
  WHERE decision = 'applied';

GRANT SELECT, INSERT ON public.pragma_improvement_candidates TO authenticated;
GRANT SELECT, INSERT ON public.pragma_improvement_decisions TO authenticated;
GRANT ALL ON public.pragma_improvement_candidates TO service_role;
GRANT ALL ON public.pragma_improvement_decisions TO service_role;
REVOKE UPDATE, DELETE ON public.pragma_improvement_candidates FROM authenticated, anon;
REVOKE UPDATE, DELETE ON public.pragma_improvement_decisions FROM authenticated, anon;

ALTER TABLE public.pragma_improvement_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pragma_improvement_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_improvement_candidates"
  ON public.pragma_improvement_candidates FOR SELECT
  TO authenticated
  USING (public.is_admin());
CREATE POLICY "admin_insert_improvement_candidates"
  ON public.pragma_improvement_candidates FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() AND created_by = auth.uid());
CREATE POLICY "admin_read_improvement_decisions"
  ON public.pragma_improvement_decisions FOR SELECT
  TO authenticated
  USING (public.is_admin());
CREATE POLICY "admin_insert_improvement_decisions"
  ON public.pragma_improvement_decisions FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() AND decided_by = auth.uid());

-- applied는 같은 candidate에 대한 선행 approve가 있어야 하며, 기존 pack 버전을
-- 그대로 재기록할 수 없다. 실제 코드·Gold 변경의 새 버전을 요구한다.
CREATE OR REPLACE FUNCTION public.validate_pragma_improvement_decision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_candidate public.pragma_improvement_candidates%ROWTYPE;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.pragma_improvement_decisions d
    WHERE d.candidate_id = NEW.candidate_id AND d.decision = 'applied'
  ) THEN
    RAISE EXCEPTION 'improvement candidate is already closed by an applied decision';
  END IF;

  IF NEW.decision <> 'applied' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_candidate
  FROM public.pragma_improvement_candidates
  WHERE id = NEW.candidate_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.pragma_improvement_decisions d
    WHERE d.candidate_id = NEW.candidate_id AND d.decision = 'approve'
  ) THEN
    RAISE EXCEPTION 'an approved decision is required before applied';
  END IF;

  IF v_candidate.realization_pack_id = NEW.resulting_pack_id
     AND v_candidate.realization_pack_version = NEW.resulting_pack_version THEN
    RAISE EXCEPTION 'applied decision must reference a new realization pack version';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_pragma_improvement_decision_trg
  BEFORE INSERT ON public.pragma_improvement_decisions
  FOR EACH ROW EXECUTE FUNCTION public.validate_pragma_improvement_decision();

REVOKE ALL ON FUNCTION public.validate_pragma_improvement_decision() FROM PUBLIC;
