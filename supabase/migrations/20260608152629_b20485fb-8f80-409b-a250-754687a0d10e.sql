ALTER TABLE public.decision_traces
  ADD COLUMN IF NOT EXISTS student_proposed_translation_pre_feedback text,
  ADD COLUMN IF NOT EXISTS student_proposal_reason_pre_feedback text;