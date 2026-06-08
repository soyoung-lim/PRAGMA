CREATE TABLE public.decision_traces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id text,
  scenario_id uuid,
  scenario_key text NOT NULL,
  speech_act text NOT NULL,
  genre text,
  analysis_scope text DEFAULT 'core',
  pdr_response jsonb,
  selected_best_option_id text,
  selected_worst_option_id text,
  choice_reason_legacy text,
  feedback_legacy jsonb,
  final_translation text,
  final_justification text,
  decision_trace_complete boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz
);

GRANT SELECT, INSERT ON public.decision_traces TO authenticated;
GRANT ALL ON public.decision_traces TO service_role;

ALTER TABLE public.decision_traces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "learner_insert_own_trace"
  ON public.decision_traces FOR INSERT
  TO authenticated
  WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "learner_select_own_trace"
  ON public.decision_traces FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

CREATE POLICY "admin_select_all_traces"
  ON public.decision_traces FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE INDEX idx_decision_traces_auth_user ON public.decision_traces(auth_user_id);
CREATE INDEX idx_decision_traces_session ON public.decision_traces(session_id);
CREATE UNIQUE INDEX uniq_decision_traces_session_scenario
  ON public.decision_traces(session_id, scenario_key)
  WHERE session_id IS NOT NULL;

CREATE TRIGGER trg_decision_traces_updated_at
  BEFORE UPDATE ON public.decision_traces
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();