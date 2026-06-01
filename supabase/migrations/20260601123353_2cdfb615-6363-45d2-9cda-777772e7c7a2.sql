-- Remove the overly permissive public INSERT policy on archive_items
DROP POLICY IF EXISTS "Allow public insert access" ON public.archive_items;

-- Revoke INSERT/UPDATE/DELETE from anon on archive_items; keep public SELECT (read-only library)
REVOKE INSERT, UPDATE, DELETE ON public.archive_items FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.archive_items FROM authenticated;
GRANT ALL ON public.archive_items TO service_role;

-- scenarios and scenario_feedback are admin-only (accessed via service_role from admin tooling).
-- RLS remains enabled with no policies => deny-all for anon/authenticated. This is intentional
-- until an admin auth layer is added in a later phase.
REVOKE ALL ON public.scenarios FROM anon, authenticated;
REVOKE ALL ON public.scenario_feedback FROM anon, authenticated;
GRANT ALL ON public.scenarios TO service_role;
GRANT ALL ON public.scenario_feedback TO service_role;
