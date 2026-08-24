-- Versioned curriculum contract for one speech act + two complete MPJ5+DCT1 missions.
-- Historical assignments stay readable. The hard gate activates only for rows that
-- explicitly claim speech_act_ab_v1.

ALTER TABLE public.curriculum_week_scenarios
  ADD COLUMN IF NOT EXISTS pair_contract_version text,
  ADD COLUMN IF NOT EXISTS mission_role text,
  ADD COLUMN IF NOT EXISTS changed_context_axes text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS diagnostic_dimensions text[] NOT NULL DEFAULT ARRAY[]::text[];

CREATE OR REPLACE FUNCTION public.weekly_pair_text_array_is_unique(value text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT cardinality(value) = (
    SELECT count(DISTINCT member)
    FROM unnest(value) AS members(member)
  );
$$;

ALTER TABLE public.curriculum_week_scenarios
  DROP CONSTRAINT IF EXISTS curriculum_week_scenarios_ab_contract_check;

ALTER TABLE public.curriculum_week_scenarios
  ADD CONSTRAINT curriculum_week_scenarios_ab_contract_check
  CHECK (
    (
      pair_contract_version IS NULL
      AND mission_role IS NULL
      AND cardinality(changed_context_axes) = 0
      AND cardinality(diagnostic_dimensions) = 0
    )
    OR
    (
      pair_contract_version = 'speech_act_ab_v1'
      AND mission_role IN ('A', 'B')
      AND changed_context_axes <@ ARRAY[
        'counterpart', 'power', 'distance', 'burden', 'channel'
      ]::text[]
      AND public.weekly_pair_text_array_is_unique(changed_context_axes)
      AND diagnostic_dimensions <@ ARRAY[
        'illocutionary_clarity',
        'force_calibration',
        'relational_calibration',
        'burden_optionality',
        'supportive_move_fit',
        'channel_sequence_fit'
      ]::text[]
      AND public.weekly_pair_text_array_is_unique(diagnostic_dimensions)
      AND cardinality(diagnostic_dimensions) >= 2
      AND (
        (
          mission_role = 'A'
          AND position = 0
          AND cardinality(changed_context_axes) = 0
        )
        OR
        (
          mission_role = 'B'
          AND position = 1
          AND cardinality(changed_context_axes) BETWEEN 1 AND 2
        )
      )
    )
  );

COMMENT ON COLUMN public.curriculum_week_scenarios.pair_contract_version IS
  'NULL=historical assignment; speech_act_ab_v1=current one-speech-act/two-mission contract';
COMMENT ON COLUMN public.curriculum_week_scenarios.mission_role IS
  'Stable order inside a current weekly pair: A at position 0, B at position 1';
COMMENT ON COLUMN public.curriculum_week_scenarios.changed_context_axes IS
  'Observable context axes changed from A; empty for A and one or two axes for B';
COMMENT ON COLUMN public.curriculum_week_scenarios.diagnostic_dimensions IS
  'Multiple whole-speech-act diagnostic dimensions covered by this mission; not target_feature';
