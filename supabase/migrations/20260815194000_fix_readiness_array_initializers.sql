-- Make empty-array initializers explicit so plpgsql_check does not treat text
-- literals as assignments without a cast. Function behavior is unchanged.

DO $$
DECLARE
  v_definition text;
  v_updated text;
BEGIN
  SELECT pg_get_functiondef(
    'public.get_pragma_gold_external_validation_status(uuid)'::regprocedure
  ) INTO v_definition;

  v_updated := replace(v_definition,
    'v_flagged text[] := ''{}'';',
    'v_flagged text[] := ARRAY[]::text[];');
  v_updated := replace(v_updated,
    'v_terminal text[] := ''{}'';',
    'v_terminal text[] := ARRAY[]::text[];');
  v_updated := replace(v_updated,
    'v_blocking text[] := ''{}'';',
    'v_blocking text[] := ARRAY[]::text[];');
  v_updated := replace(v_updated,
    'v_required uuid[] := ''{}'';',
    'v_required uuid[] := ARRAY[]::uuid[];');

  IF v_updated = v_definition THEN
    RAISE EXCEPTION 'Gold45 status array initializer patch did not match';
  END IF;
  EXECUTE v_updated;

  SELECT pg_get_functiondef(
    'public.get_pragma_moat_expansion_readiness(text)'::regprocedure
  ) INTO v_definition;
  v_updated := replace(v_definition,
    'v_missing text[] := ''{}'';',
    'v_missing text[] := ARRAY[]::text[];');

  IF v_updated = v_definition THEN
    RAISE EXCEPTION 'Moat readiness array initializer patch did not match';
  END IF;
  EXECUTE v_updated;
END;
$$;
