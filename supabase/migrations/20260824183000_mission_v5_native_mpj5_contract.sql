-- Promote the covered current mission_v5 contract from transitional MPJ4 to native MPJ5.
-- Historical mission_v5 rows remain readable. Only rows claiming the new prompt contract
-- are required to satisfy this shape and the existing complete item-lineage hard gate.

DO $migration$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_get_functiondef(
    'public.validate_current_mission_v5_item_lineage()'::regprocedure
  ) INTO v_definition;

  IF position('mission_v5_mpj4_minidiscourse_v6_interpreter_roles' IN v_definition) = 0
     OR position('item_lineage_attribution_v3_mission_v5' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Previous mission_v5 item-lineage gate definition is not the expected version';
  END IF;

  v_definition := replace(
    replace(
      v_definition,
      'mission_v5_mpj4_minidiscourse_v6_interpreter_roles',
      'mission_v5_mpj5_minidiscourse_v1'
    ),
    'item_lineage_attribution_v3_mission_v5',
    'item_lineage_attribution_v4_mission_v5_mpj5'
  );
  EXECUTE v_definition;
END;
$migration$;

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
BEGIN
  -- Do not rewrite, delete, or reject historical rows merely because they are mission_v5.
  -- The gate activates only when a row claims the new native generation contract.
  IF v_mission IS NULL
     OR v_mission->'provenance'->>'prompt_version'
        IS DISTINCT FROM 'mission_v5_mpj5_minidiscourse_v1' THEN
    RETURN NEW;
  END IF;

  IF v_mission->>'schema_version' IS DISTINCT FROM 'mission_v5'
     OR v_mission->'provenance'->>'content_release_id'
        IS DISTINCT FROM 'pragma_content_candidate_20260824_01'
     OR jsonb_typeof(v_mission->'mpj_items') IS DISTINCT FROM 'array'
     OR jsonb_array_length(v_mission->'mpj_items') <> 5 THEN
    RAISE EXCEPTION 'Current mission_v5 native contract requires release-matched MPJ5 content';
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
     OR v_mission->'item_lineage'->'attribution_provenance'->>'prompt_version'
        IS DISTINCT FROM 'item_lineage_attribution_v4_mission_v5_mpj5' THEN
    RAISE EXCEPTION 'Current mission_v5 native contract requires exact MPJ5 order, ids, and lineage version';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_current_mission_v5_native_mpj5()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS validate_current_mission_v5_native_mpj5_trg ON public.scenarios;
CREATE TRIGGER validate_current_mission_v5_native_mpj5_trg
  BEFORE INSERT OR UPDATE OF mission_content ON public.scenarios
  FOR EACH ROW EXECUTE FUNCTION public.validate_current_mission_v5_native_mpj5();
