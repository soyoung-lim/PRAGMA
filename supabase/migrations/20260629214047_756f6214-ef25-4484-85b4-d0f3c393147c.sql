ALTER TABLE public.scenarios
  ADD COLUMN week_no integer,
  ADD COLUMN language_direction text,
  ADD COLUMN mode text,
  ADD COLUMN speech_act_text text,
  ADD COLUMN scenario_p text,
  ADD COLUMN scenario_d text,
  ADD COLUMN scenario_r text,
  ADD COLUMN pragmatic_challenge text[],
  ADD COLUMN challenge_intensity text,
  ADD COLUMN hsk_level_min integer;