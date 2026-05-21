ALTER TABLE public.archive_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access"
ON public.archive_items
FOR SELECT
USING (true);

CREATE POLICY "Allow public insert access"
ON public.archive_items
FOR INSERT
WITH CHECK (true);