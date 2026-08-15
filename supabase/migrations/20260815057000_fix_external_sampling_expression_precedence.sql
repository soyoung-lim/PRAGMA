-- PostgreSQL parses JSON extraction next to text concatenation ambiguously in
-- plpgsql_check. Preserve the 560 function body and parenthesize the extracted
-- UUID explicitly. Also use typed empty arrays in the two functions introduced
-- by 550 so lint can verify their declared state types.

DO $$
DECLARE
  v_definition text;
  v_fixed text;
BEGIN
  SELECT pg_get_functiondef(
    'public.create_pragma_gold_external_sampling_plan(text)'::regprocedure
  ) INTO v_definition;
  v_fixed := replace(
    v_definition,
    'v_seed || '':'' || population.snapshot_item::jsonb->>''calibration_resolution_id''',
    'v_seed || '':'' || (population.snapshot_item::jsonb->>''calibration_resolution_id'')'
  );
  IF v_fixed = v_definition THEN
    RAISE EXCEPTION 'Expected sampling rank expression was not found';
  END IF;
  EXECUTE v_fixed;

  SELECT pg_get_functiondef(
    'public.get_pragma_gold_external_validation_status(uuid)'::regprocedure
  ) INTO v_definition;
  v_fixed := replace(v_definition, 'v_flagged text[] := ''{}'';', 'v_flagged text[] := ARRAY[]::text[];');
  v_fixed := replace(v_fixed, 'v_blocking text[] := ''{}'';', 'v_blocking text[] := ARRAY[]::text[];');
  v_fixed := replace(v_fixed, 'v_required uuid[] := ''{}'';', 'v_required uuid[] := ARRAY[]::uuid[];');
  IF v_fixed = v_definition THEN
    RAISE EXCEPTION 'Expected external-status empty-array declarations were not found';
  END IF;
  EXECUTE v_fixed;

  SELECT pg_get_functiondef(
    'public.get_pragma_final_corpus_generation_readiness(text)'::regprocedure
  ) INTO v_definition;
  v_fixed := replace(v_definition, 'v_missing text[] := ''{}'';', 'v_missing text[] := ARRAY[]::text[];');
  IF v_fixed = v_definition THEN
    RAISE EXCEPTION 'Expected generation-readiness empty-array declaration was not found';
  END IF;
  EXECUTE v_fixed;
END;
$$;
