ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS affiliation_or_status text,
  ADD COLUMN IF NOT EXISTS academic_year_or_program text,
  ADD COLUMN IF NOT EXISTS language_background text,
  ADD COLUMN IF NOT EXISTS chinese_proficiency_self_report text,
  ADD COLUMN IF NOT EXISTS business_chinese_experience text,
  ADD COLUMN IF NOT EXISTS ti_experience_level text,
  ADD COLUMN IF NOT EXISTS ti_experience_modes text[],
  ADD COLUMN IF NOT EXISTS genai_use_frequency text,
  ADD COLUMN IF NOT EXISTS ai_prompting_style_for_ti text,
  ADD COLUMN IF NOT EXISTS perceived_ai_ti_difficulty text,
  ADD COLUMN IF NOT EXISTS perceived_business_chinese_ti_risk text;