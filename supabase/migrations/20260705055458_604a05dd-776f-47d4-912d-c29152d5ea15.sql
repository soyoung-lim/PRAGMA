CREATE TABLE public.youtube_sources (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  video_title text,
  lang text,
  available_langs text[],
  transcript text,
  extract_status text default 'extracted',
  created_by uuid,
  created_at timestamptz not null default now()
);

GRANT SELECT, INSERT ON public.youtube_sources TO authenticated;
GRANT ALL ON public.youtube_sources TO service_role;

ALTER TABLE public.youtube_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view youtube_sources"
  ON public.youtube_sources FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can insert youtube_sources"
  ON public.youtube_sources FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());
