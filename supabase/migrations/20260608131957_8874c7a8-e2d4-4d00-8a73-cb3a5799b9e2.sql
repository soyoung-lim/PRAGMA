ALTER TABLE public.decision_traces ADD COLUMN IF NOT EXISTS task_mode text;
ALTER TABLE public.decision_traces ADD COLUMN IF NOT EXISTS language_direction text;

UPDATE public.decision_traces SET task_mode = 'translation' WHERE task_mode IS NULL;
UPDATE public.decision_traces SET language_direction = 'ko_to_zh' WHERE language_direction IS NULL;