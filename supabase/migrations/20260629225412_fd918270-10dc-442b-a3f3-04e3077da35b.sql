
ALTER TABLE public.scenarios ADD COLUMN IF NOT EXISTS domain text;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scenarios TO authenticated;
GRANT ALL ON public.scenarios TO service_role;

DROP POLICY IF EXISTS "Authenticated can read scenarios" ON public.scenarios;
CREATE POLICY "Authenticated can read scenarios"
  ON public.scenarios FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can insert scenarios" ON public.scenarios;
CREATE POLICY "Admins can insert scenarios"
  ON public.scenarios FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update scenarios" ON public.scenarios;
CREATE POLICY "Admins can update scenarios"
  ON public.scenarios FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete scenarios" ON public.scenarios;
CREATE POLICY "Admins can delete scenarios"
  ON public.scenarios FOR DELETE
  TO authenticated
  USING (public.is_admin());
