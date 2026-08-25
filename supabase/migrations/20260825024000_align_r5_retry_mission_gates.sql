-- Point the remaining current-prompt gates at the R5 diagnostic retry version.
-- The scoped native MPJ5 gate is updated separately because its definition also
-- owns the uncovered-pack exception.

DO $migration$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_get_functiondef(
    'public.validate_current_mission_v5_item_lineage()'::regprocedure
  ) INTO v_definition;

  IF position('mission_v5_mpj5_minidiscourse_v4_concise_learner_flow' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Previous mission_v5 item-lineage gate is not the expected version';
  END IF;

  EXECUTE replace(
    v_definition,
    'mission_v5_mpj5_minidiscourse_v4_concise_learner_flow',
    'mission_v5_mpj5_minidiscourse_v5_r5_diagnostic_retry'
  );

  SELECT pg_get_functiondef(
    'public.validate_current_mission_v5_streamlined_comparison()'::regprocedure
  ) INTO v_definition;

  IF position('mission_v5_mpj5_minidiscourse_v4_concise_learner_flow' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Previous streamlined comparison gate is not the expected version';
  END IF;

  EXECUTE replace(
    v_definition,
    'mission_v5_mpj5_minidiscourse_v4_concise_learner_flow',
    'mission_v5_mpj5_minidiscourse_v5_r5_diagnostic_retry'
  );
END;
$migration$;
