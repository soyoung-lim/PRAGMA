-- Streamline the current native MPJ5 learner contract without invalidating the
-- release-matched cores: direct reason selection and four comparison candidates
-- with exactly one BEST and one WORST.

DO $migration$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_get_functiondef(
    'public.validate_current_mission_v5_item_lineage()'::regprocedure
  ) INTO v_definition;

  IF position('mission_v5_mpj5_minidiscourse_v2_multidimensional' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Previous mission_v5 item-lineage gate is not the expected version';
  END IF;

  EXECUTE replace(
    v_definition,
    'mission_v5_mpj5_minidiscourse_v2_multidimensional',
    'mission_v5_mpj5_minidiscourse_v3_streamlined'
  );

  SELECT pg_get_functiondef(
    'public.validate_current_mission_v5_native_mpj5()'::regprocedure
  ) INTO v_definition;

  IF position('mission_v5_mpj5_minidiscourse_v2_multidimensional' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Previous native MPJ5 gate is not the expected version';
  END IF;

  EXECUTE replace(
    v_definition,
    'mission_v5_mpj5_minidiscourse_v2_multidimensional',
    'mission_v5_mpj5_minidiscourse_v3_streamlined'
  );
END;
$migration$;

CREATE OR REPLACE FUNCTION public.validate_current_mission_v5_streamlined_comparison()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_mission jsonb := NEW.mission_content;
  v_candidates jsonb;
  v_best_count integer;
  v_middle_count integer;
  v_worst_count integer;
BEGIN
  IF v_mission IS NULL
     OR v_mission->'provenance'->>'prompt_version'
        IS DISTINCT FROM 'mission_v5_mpj5_minidiscourse_v3_streamlined' THEN
    RETURN NEW;
  END IF;

  v_candidates := v_mission->'mpj_items'->4->'candidates';
  IF jsonb_typeof(v_candidates) IS DISTINCT FROM 'array'
     OR jsonb_array_length(v_candidates) <> 4 THEN
    RAISE EXCEPTION 'Current streamlined MPJ5 requires exactly four comparison candidates';
  END IF;

  SELECT
    count(*) FILTER (WHERE candidate->>'comparison_role' = 'best'),
    count(*) FILTER (WHERE candidate->>'comparison_role' = 'middle'),
    count(*) FILTER (WHERE candidate->>'comparison_role' = 'worst')
  INTO v_best_count, v_middle_count, v_worst_count
  FROM jsonb_array_elements(v_candidates) source(candidate);

  IF v_best_count <> 1 OR v_middle_count <> 2 OR v_worst_count <> 1 THEN
    RAISE EXCEPTION 'Current streamlined MPJ5 requires BEST 1, middle 2, and WORST 1';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_current_mission_v5_streamlined_comparison()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS validate_current_mission_v5_streamlined_comparison_trg ON public.scenarios;
CREATE TRIGGER validate_current_mission_v5_streamlined_comparison_trg
  BEFORE INSERT OR UPDATE OF mission_content ON public.scenarios
  FOR EACH ROW EXECUTE FUNCTION public.validate_current_mission_v5_streamlined_comparison();
