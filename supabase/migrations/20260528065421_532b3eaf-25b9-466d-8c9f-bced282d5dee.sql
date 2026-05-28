
-- Enums (safe creation)
DO $$ BEGIN
  CREATE TYPE review_status AS ENUM ('generated','needs_review','revise_required','revised','approved');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE usage_assignment AS ENUM ('archived_only','coursework_published','experiment_locked','excluded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE auto_check_result AS ENUM ('pass','warning','fail');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE speech_act AS ENUM ('request','refusal');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- scenarios table
CREATE TABLE IF NOT EXISTS public.scenarios (
  scenario_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_status review_status NOT NULL DEFAULT 'generated',
  usage_assignment usage_assignment NOT NULL DEFAULT 'archived_only',
  auto_check_result auto_check_result,
  speech_act speech_act NOT NULL,
  title text NOT NULL,
  topic text,
  source_text text,
  industry_sector text,
  business_function text,
  interaction_context text,
  genre text,
  learner_level text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scenarios TO authenticated;
GRANT SELECT ON public.scenarios TO anon;
GRANT ALL ON public.scenarios TO service_role;

ALTER TABLE public.scenarios ENABLE ROW LEVEL SECURITY;

-- scenario_feedback table
CREATE TABLE IF NOT EXISTS public.scenario_feedback (
  feedback_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id uuid REFERENCES public.scenarios(scenario_id) ON DELETE CASCADE,
  recipient_perspective text,
  teacher_perspective text,
  field_expert_perspective text,
  created_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scenario_feedback TO authenticated;
GRANT SELECT ON public.scenario_feedback TO anon;
GRANT ALL ON public.scenario_feedback TO service_role;

ALTER TABLE public.scenario_feedback ENABLE ROW LEVEL SECURITY;
