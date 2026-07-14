CREATE TABLE public.curriculum_outlines (
  id                  uuid NOT NULL DEFAULT gen_random_uuid(),
  title               text NOT NULL,
  status              text NOT NULL DEFAULT 'draft',
  level               text NOT NULL,
  language_direction  text NOT NULL,
  domain              text NOT NULL,
  industry            text,
  semester_goal       text,
  target_speech_acts  text[] NOT NULL DEFAULT '{}',
  week_count          int NOT NULL DEFAULT 15,
  midterm_week        int,
  final_week          int,
  scenarios_per_week  int NOT NULL DEFAULT 2,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT curriculum_outlines_pkey PRIMARY KEY (id),
  CONSTRAINT curriculum_outlines_status_check
    CHECK (status IN ('draft', 'published', 'archived')),
  CONSTRAINT curriculum_outlines_level_check
    CHECK (level IN ('beginner_intermediate', 'intermediate', 'advanced')),
  CONSTRAINT curriculum_outlines_language_direction_check
    CHECK (language_direction IN ('ko_zh', 'zh_ko')),
  CONSTRAINT curriculum_outlines_domain_check
    CHECK (domain IN ('daily', 'school', 'work')),
  CONSTRAINT curriculum_outlines_industry_check
    CHECK (
      industry IS NULL OR industry IN (
        'trade_distribution', 'IT_platform', 'manufacturing',
        'tourism_hospitality', 'education_research',
        'public_international_affairs', 'culture_content_media'
      )
    ),
  CONSTRAINT curriculum_outlines_week_count_check
    CHECK (week_count = 15),
  CONSTRAINT curriculum_outlines_scenarios_per_week_check
    CHECK (scenarios_per_week >= 0)
);

CREATE TABLE public.curriculum_weeks (
  id                    uuid NOT NULL DEFAULT gen_random_uuid(),
  outline_id            uuid NOT NULL,
  week_no               int NOT NULL,
  type                  text NOT NULL DEFAULT 'regular',
  title                 text,
  can_do                text[],
  speech_act            text,
  channel               text,
  pdr_power             text,
  pdr_distance          text,
  pdr_imposition        text,
  curriculum_load_band  int,
  competency_focus      text,
  domain                text,
  industry              text,
  scenario_slots        int,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT curriculum_weeks_pkey PRIMARY KEY (id),
  CONSTRAINT curriculum_weeks_outline_id_fkey
    FOREIGN KEY (outline_id) REFERENCES public.curriculum_outlines(id) ON DELETE CASCADE,
  CONSTRAINT curriculum_weeks_outline_id_week_no_key
    UNIQUE (outline_id, week_no),
  CONSTRAINT curriculum_weeks_week_no_check
    CHECK (week_no >= 1),
  CONSTRAINT curriculum_weeks_type_check
    CHECK (type IN ('orientation', 'regular', 'midterm', 'final')),
  CONSTRAINT curriculum_weeks_speech_act_check
    CHECK (
      speech_act IS NULL OR speech_act IN (
        'request', 'refusal', 'apology', 'thanks', 'proposal',
        'agreement', 'opposition', 'compliment', 'complaint'
      )
    ),
  CONSTRAINT curriculum_weeks_channel_check
    CHECK (channel IS NULL OR channel IN ('email', 'messenger', 'facetoface', 'phone')),
  CONSTRAINT curriculum_weeks_pdr_power_check
    CHECK (pdr_power IS NULL OR pdr_power IN ('higher', 'equal', 'lower')),
  CONSTRAINT curriculum_weeks_pdr_distance_check
    CHECK (pdr_distance IS NULL OR pdr_distance IN ('formal', 'close')),
  CONSTRAINT curriculum_weeks_pdr_imposition_check
    CHECK (pdr_imposition IS NULL OR pdr_imposition IN ('high', 'low')),
  CONSTRAINT curriculum_weeks_load_band_check
    CHECK (curriculum_load_band IS NULL OR (curriculum_load_band BETWEEN 1 AND 5)),
  CONSTRAINT curriculum_weeks_scenario_slots_check
    CHECK (scenario_slots IS NULL OR scenario_slots >= 0),
  CONSTRAINT curriculum_weeks_domain_check
    CHECK (domain IS NULL OR domain IN ('daily', 'school', 'work')),
  CONSTRAINT curriculum_weeks_industry_check
    CHECK (
      industry IS NULL OR industry IN (
        'trade_distribution', 'IT_platform', 'manufacturing',
        'tourism_hospitality', 'education_research',
        'public_international_affairs', 'culture_content_media'
      )
    )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.curriculum_outlines TO authenticated;
GRANT ALL ON public.curriculum_outlines TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.curriculum_weeks TO authenticated;
GRANT ALL ON public.curriculum_weeks TO service_role;

ALTER TABLE public.curriculum_outlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_weeks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "curriculum_outlines_admin_all"
  ON public.curriculum_outlines FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "curriculum_weeks_admin_all"
  ON public.curriculum_weeks FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TRIGGER curriculum_outlines_set_updated_at
  BEFORE UPDATE ON public.curriculum_outlines
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER curriculum_weeks_set_updated_at
  BEFORE UPDATE ON public.curriculum_weeks
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();