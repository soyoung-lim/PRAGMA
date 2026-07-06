
DROP POLICY IF EXISTS "Authenticated can read scenarios" ON public.scenarios;

CREATE POLICY "Approved scenarios readable, admins read all"
  ON public.scenarios FOR SELECT
  TO authenticated
  USING (review_status = 'approved'::public.review_status OR public.is_admin());
