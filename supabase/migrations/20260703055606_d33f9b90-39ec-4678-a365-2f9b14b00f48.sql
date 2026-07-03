
CREATE TABLE public.scenario_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id uuid NOT NULL REFERENCES public.scenarios(scenario_id) ON DELETE CASCADE,
  candidate_text text,
  directness_level int CHECK (directness_level BETWEEN 1 AND 5),
  appropriateness_label text,
  failed_challenge text[],
  rationale text,
  display_order int,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.scenario_candidates TO authenticated;
GRANT ALL ON public.scenario_candidates TO service_role;

ALTER TABLE public.scenario_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scenario_candidates_select_approved"
  ON public.scenario_candidates
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.scenarios s
      WHERE s.scenario_id = scenario_candidates.scenario_id
        AND s.review_status = 'approved'
    )
  );

CREATE POLICY "scenario_candidates_admin_insert"
  ON public.scenario_candidates
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "scenario_candidates_admin_update"
  ON public.scenario_candidates
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "scenario_candidates_admin_delete"
  ON public.scenario_candidates
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

CREATE INDEX scenario_candidates_scenario_id_idx ON public.scenario_candidates(scenario_id);
