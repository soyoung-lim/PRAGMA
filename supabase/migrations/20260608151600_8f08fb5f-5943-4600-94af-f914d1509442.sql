ALTER TABLE public.decision_traces
  ADD COLUMN IF NOT EXISTS best_choice_reason text,
  ADD COLUMN IF NOT EXISTS worst_choice_reason text;