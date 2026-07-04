CREATE TABLE public.hsk_vocab (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hsk_level int NOT NULL CHECK (hsk_level BETWEEN 3 AND 6),
  word text NOT NULL,
  pinyin text,
  pos text,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hsk_level, word)
);

CREATE INDEX hsk_vocab_hsk_level_idx ON public.hsk_vocab (hsk_level);

GRANT SELECT ON public.hsk_vocab TO authenticated;
GRANT ALL ON public.hsk_vocab TO service_role;

ALTER TABLE public.hsk_vocab ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hsk_vocab readable by authenticated"
  ON public.hsk_vocab FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "hsk_vocab insert by admin"
  ON public.hsk_vocab FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "hsk_vocab update by admin"
  ON public.hsk_vocab FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "hsk_vocab delete by admin"
  ON public.hsk_vocab FOR DELETE
  TO authenticated
  USING (public.is_admin());