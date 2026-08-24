-- Move the current native MPJ5 prompt lineage to concise self-contained scenes
-- and the three-option single-repair learner flow.
-- Existing missions and legacy MPJ4 data remain readable; only the exact
-- current prompt version used by the authoritative gates changes.

DO $migration$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_get_functiondef(
    'public.validate_current_mission_v5_item_lineage()'::regprocedure
  ) INTO v_definition;

  IF position('mission_v5_mpj5_minidiscourse_v3_streamlined' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Previous mission_v5 item-lineage gate is not the expected version';
  END IF;

  EXECUTE replace(
    v_definition,
    'mission_v5_mpj5_minidiscourse_v3_streamlined',
    'mission_v5_mpj5_minidiscourse_v4_concise_learner_flow'
  );

  SELECT pg_get_functiondef(
    'public.validate_current_mission_v5_native_mpj5()'::regprocedure
  ) INTO v_definition;

  IF position('mission_v5_mpj5_minidiscourse_v3_streamlined' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Previous native MPJ5 gate is not the expected version';
  END IF;

  v_definition := replace(
    v_definition,
    'mission_v5_mpj5_minidiscourse_v3_streamlined',
    'mission_v5_mpj5_minidiscourse_v4_concise_learner_flow'
  );
  v_definition := replace(
    v_definition,
    'pragma_content_candidate_20260824_02',
    'pragma_content_candidate_20260825_01'
  );
  EXECUTE v_definition;

  SELECT pg_get_functiondef(
    'public.validate_current_mission_v5_streamlined_comparison()'::regprocedure
  ) INTO v_definition;

  IF position('mission_v5_mpj5_minidiscourse_v3_streamlined' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Previous streamlined comparison gate is not the expected version';
  END IF;

  EXECUTE replace(
    v_definition,
    'mission_v5_mpj5_minidiscourse_v3_streamlined',
    'mission_v5_mpj5_minidiscourse_v4_concise_learner_flow'
  );
END;
$migration$;
