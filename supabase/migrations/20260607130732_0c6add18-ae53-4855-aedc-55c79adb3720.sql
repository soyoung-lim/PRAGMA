ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS research_use_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS anonymization_notice_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS report_email_consent boolean DEFAULT false;