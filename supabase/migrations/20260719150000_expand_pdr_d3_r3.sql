-- Expand curriculum_weeks P·D·R checks: D 2→3 (add 'acquaintance'), R 2→3 (add 'mid').
-- Per scenario-matrix LOCK (2026-07-18): D = 친밀(close)·지인(acquaintance)·초면(formal),
-- R = 저(low)·중(mid)·고(high). Existing 2-value data remains valid (subset). Non-breaking.
-- scenarios.scenario_d / scenario_r are unconstrained text — no change needed there.

ALTER TABLE public.curriculum_weeks
  DROP CONSTRAINT IF EXISTS curriculum_weeks_pdr_distance_check;
ALTER TABLE public.curriculum_weeks
  ADD CONSTRAINT curriculum_weeks_pdr_distance_check
  CHECK (pdr_distance IS NULL OR pdr_distance IN ('close', 'acquaintance', 'formal'));

ALTER TABLE public.curriculum_weeks
  DROP CONSTRAINT IF EXISTS curriculum_weeks_pdr_imposition_check;
ALTER TABLE public.curriculum_weeks
  ADD CONSTRAINT curriculum_weeks_pdr_imposition_check
  CHECK (pdr_imposition IS NULL OR pdr_imposition IN ('low', 'mid', 'high'));
