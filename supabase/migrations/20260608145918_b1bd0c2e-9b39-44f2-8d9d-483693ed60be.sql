ALTER TABLE public.decision_traces
  ADD COLUMN IF NOT EXISTS option_display_mapping jsonb;

UPDATE public.decision_traces
   SET option_display_mapping = '{"1":"A","2":"B","3":"C"}'::jsonb
 WHERE option_display_mapping IS NULL;