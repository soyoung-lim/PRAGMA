-- Remove the remaining plpgsql_check warnings without rewriting already-applied
-- migration history. CREATE OR REPLACE retains each function's identity and ACLs.

DO $migration$
DECLARE
  v_definition text;
  v_original text;
  v_replacement text;
BEGIN
  SELECT pg_get_functiondef(
    'public.materialize_pragma_improvement_candidates(timestamptz,timestamptz,integer,integer)'::regprocedure
  ) INTO STRICT v_definition;
  v_original := 'v_candidate_ids uuid[] := ''{}'';';
  v_replacement := 'v_candidate_ids uuid[] := ARRAY[]::uuid[];';
  IF strpos(v_definition, v_original) = 0 THEN
    RAISE EXCEPTION 'Unexpected materialize_pragma_improvement_candidates definition';
  END IF;
  EXECUTE replace(v_definition, v_original, v_replacement);

  SELECT pg_get_functiondef(
    'public.get_pragma_moat_expansion_readiness(text)'::regprocedure
  ) INTO STRICT v_definition;
  v_original := 'v_missing text[] := ''{}'';';
  v_replacement := 'v_missing text[] := ARRAY[]::text[];';
  IF strpos(v_definition, v_original) = 0 THEN
    RAISE EXCEPTION 'Unexpected get_pragma_moat_expansion_readiness definition';
  END IF;
  EXECUTE replace(v_definition, v_original, v_replacement);

  SELECT pg_get_functiondef(
    'public.get_pragma_final_corpus_generation_readiness(text)'::regprocedure
  ) INTO STRICT v_definition;
  v_original := 'v_missing text[] := ''{}'';';
  v_replacement := 'v_missing text[] := ARRAY[]::text[];';
  IF strpos(v_definition, v_original) = 0 THEN
    RAISE EXCEPTION 'Unexpected get_pragma_final_corpus_generation_readiness definition';
  END IF;
  EXECUTE replace(v_definition, v_original, v_replacement);
END
$migration$;

-- concat_ws(any ...) is STABLE, so the validator must not claim the stronger
-- IMMUTABLE volatility even though it performs no table reads.
ALTER FUNCTION public.validate_pragma_final_corpus_plan(jsonb) STABLE;
