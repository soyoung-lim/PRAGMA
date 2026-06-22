
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS affiliation text,
  ADD COLUMN IF NOT EXISTS grade_or_program text,
  ADD COLUMN IF NOT EXISTS chinese_level text,
  ADD COLUMN IF NOT EXISTS interpreting_experience text,
  ADD COLUMN IF NOT EXISTS consent_data_use boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_anonymous_analysis boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_email_report boolean NOT NULL DEFAULT false;
