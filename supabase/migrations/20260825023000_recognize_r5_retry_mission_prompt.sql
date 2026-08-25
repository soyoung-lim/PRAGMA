-- Keep the native MPJ5 database contract active after the R5 retry prompt fix.
-- The content schema and release remain unchanged; only failure-specific retry
-- instructions distinguish length failures from band/role failures.

CREATE OR REPLACE FUNCTION public.validate_current_mission_v5_native_mpj5()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_mission jsonb := NEW.mission_content;
  v_expected_types constant text[] := ARRAY[
    'scale4',
    'judge3',
    'fix_choice',
    'reason',
    'multi_judge'
  ];
  v_actual_types text[];
  v_dimension_count integer;
  v_distinct_dimension_count integer;
  v_distinct_evidence_count integer;
BEGIN
  IF v_mission IS NULL
     OR v_mission->'provenance'->>'prompt_version' NOT IN (
       'mission_v5_mpj5_minidiscourse_v4_concise_learner_flow',
       'mission_v5_mpj5_minidiscourse_v5_r5_diagnostic_retry'
     ) THEN
    RETURN NEW;
  END IF;

  IF v_mission->>'schema_version' IS DISTINCT FROM 'mission_v5'
     OR v_mission->'provenance'->>'content_release_id'
        IS DISTINCT FROM 'pragma_content_candidate_20260825_01'
     OR jsonb_typeof(v_mission->'mpj_items') IS DISTINCT FROM 'array'
     OR jsonb_array_length(v_mission->'mpj_items') <> 5 THEN
    RAISE EXCEPTION 'Current mission_v5 diagnostic contract requires release-matched MPJ5 content';
  END IF;

  SELECT array_agg(item->>'type' ORDER BY ordinality)
  INTO v_actual_types
  FROM jsonb_array_elements(v_mission->'mpj_items')
    WITH ORDINALITY source(item, ordinality);

  IF v_actual_types IS DISTINCT FROM v_expected_types
     OR EXISTS (
       SELECT 1
       FROM jsonb_array_elements(v_mission->'mpj_items')
         WITH ORDINALITY source(item, ordinality)
       WHERE COALESCE(item->>'id', '') !~ '^[1-5]$'
          OR (item->>'id')::integer <> ordinality
     )
     OR (
       v_mission->>'direction' = 'ko_zh'
       AND NEW.speech_act::text IN ('request', 'refusal', 'thanks')
       AND v_mission->'item_lineage'->'attribution_provenance'->>'prompt_version'
           IS DISTINCT FROM 'item_lineage_attribution_v4_mission_v5_mpj5'
     ) THEN
    RAISE EXCEPTION 'Current mission_v5 diagnostic contract requires exact MPJ5 order, ids, and in-scope lineage version';
  END IF;

  IF jsonb_typeof(v_mission->'diagnostic_dimensions') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Current mission_v5 diagnostic_dimensions must be an array';
  END IF;

  v_dimension_count := jsonb_array_length(v_mission->'diagnostic_dimensions');
  IF v_dimension_count < 2 OR v_dimension_count > 6 THEN
    RAISE EXCEPTION 'Current mission_v5 requires 2 to 6 diagnostic dimensions';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_mission->'diagnostic_dimensions') source(dimension)
    WHERE jsonb_typeof(dimension) IS DISTINCT FROM 'object'
       OR COALESCE(dimension->>'code', '') NOT IN (
         'illocutionary_clarity',
         'force_calibration',
         'relational_calibration',
         'burden_optionality',
         'supportive_move_fit',
         'channel_sequence_fit'
       )
       OR btrim(COALESCE(dimension->>'evidence_ko', '')) = ''
       OR jsonb_typeof(dimension->'evidence_refs') IS DISTINCT FROM 'array'
  ) THEN
    RAISE EXCEPTION 'Current mission_v5 diagnostic dimension has an invalid code or evidence shape';
  END IF;

  SELECT count(*), count(DISTINCT dimension->>'code')
  INTO v_dimension_count, v_distinct_dimension_count
  FROM jsonb_array_elements(v_mission->'diagnostic_dimensions') source(dimension);

  IF v_dimension_count <> v_distinct_dimension_count THEN
    RAISE EXCEPTION 'Current mission_v5 diagnostic dimension codes must be unique';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_mission->'diagnostic_dimensions') source(dimension)
    WHERE jsonb_array_length(dimension->'evidence_refs') < 1
       OR jsonb_array_length(dimension->'evidence_refs') > 6
       OR EXISTS (
         SELECT 1
         FROM jsonb_array_elements_text(dimension->'evidence_refs') source_ref(ref)
         WHERE ref NOT IN ('mpj:1', 'mpj:2', 'mpj:3', 'mpj:4', 'mpj:5', 'dct')
       )
       OR (
         SELECT count(*)
         FROM jsonb_array_elements_text(dimension->'evidence_refs') source_ref(ref)
       ) <> (
         SELECT count(DISTINCT ref)
         FROM jsonb_array_elements_text(dimension->'evidence_refs') source_ref(ref)
       )
  ) THEN
    RAISE EXCEPTION 'Current mission_v5 diagnostic evidence refs must be non-empty, valid, and unique';
  END IF;

  SELECT count(DISTINCT ref)
  INTO v_distinct_evidence_count
  FROM jsonb_array_elements(v_mission->'diagnostic_dimensions') source(dimension)
  CROSS JOIN LATERAL jsonb_array_elements_text(dimension->'evidence_refs') source_ref(ref);

  IF v_distinct_evidence_count < 2 THEN
    RAISE EXCEPTION 'Current mission_v5 diagnostic coverage must span at least two MPJ/DCT refs';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_current_mission_v5_native_mpj5()
  FROM PUBLIC, anon, authenticated;
