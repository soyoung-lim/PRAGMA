
-- archive_items: replace public read with authenticated-only read
DROP POLICY IF EXISTS "Allow public read access" ON public.archive_items;
REVOKE SELECT ON public.archive_items FROM anon;
GRANT SELECT ON public.archive_items TO authenticated;
CREATE POLICY "Authenticated can read archive items"
  ON public.archive_items
  FOR SELECT
  TO authenticated
  USING (true);

-- scenario_feedback: give admins read access
GRANT SELECT ON public.scenario_feedback TO authenticated;
CREATE POLICY "Admins can read scenario feedback"
  ON public.scenario_feedback
  FOR SELECT
  TO authenticated
  USING (public.is_admin());
