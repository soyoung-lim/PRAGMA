-- HSK 3.0 reference data: official source -> deterministic derivation -> researcher mapping.
-- This migration creates schema only. The separately reviewed seed is not applied automatically.
-- HSK levels are cumulative Chinese lexical reference ceilings, not PRAGMA proficiency equivalents.

BEGIN;

CREATE TABLE public.hsk_reference_sources (
  id text PRIMARY KEY,
  title text NOT NULL,
  publisher text NOT NULL,
  released_at text,
  effective_at text,
  official_url text NOT NULL,
  sha256 text NOT NULL,
  manifest_version text NOT NULL,
  extraction_version text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hsk_reference_sources_sha256_check CHECK (sha256 ~ '^[0-9A-F]{64}$')
);

CREATE TABLE public.hsk3_vocab (
  source_id text NOT NULL REFERENCES public.hsk_reference_sources(id) ON DELETE RESTRICT,
  seq integer NOT NULL,
  headword text NOT NULL,
  pinyin text NOT NULL,
  sense_no smallint NOT NULL DEFAULT 1,
  source_form text NOT NULL,
  pinyin_norm text NOT NULL,
  pos text,
  intro_level smallint NOT NULL,
  intro_band text NOT NULL,
  extra_levels smallint[] NOT NULL DEFAULT '{}',
  is_multi_sense boolean NOT NULL DEFAULT false,
  is_polyphone boolean NOT NULL DEFAULT false,
  is_phrase boolean NOT NULL DEFAULT false,
  source_note text,
  PRIMARY KEY (source_id, seq),
  CONSTRAINT hsk3_vocab_sense_key UNIQUE (source_id, headword, pinyin, sense_no),
  CONSTRAINT hsk3_vocab_seq_check CHECK (seq BETWEEN 1 AND 11000),
  CONSTRAINT hsk3_vocab_level_check CHECK (intro_level BETWEEN 1 AND 7),
  CONSTRAINT hsk3_vocab_band_check CHECK (intro_band IN ('1','2','3','4','5','6','7-9')),
  CONSTRAINT hsk3_vocab_extra_levels_check CHECK (extra_levels <@ ARRAY[1,2,3,4,5,6,7]::smallint[])
);

CREATE INDEX hsk3_vocab_level_idx ON public.hsk3_vocab (source_id, intro_level);
CREATE INDEX hsk3_vocab_headword_idx ON public.hsk3_vocab (source_id, headword);
CREATE INDEX hsk3_vocab_pinyin_norm_idx ON public.hsk3_vocab (source_id, pinyin_norm);
CREATE INDEX hsk3_vocab_extra_levels_idx ON public.hsk3_vocab USING gin (extra_levels);

CREATE TABLE public.hsk3_topics (
  source_id text NOT NULL REFERENCES public.hsk_reference_sources(id) ON DELETE RESTRICT,
  topic_seq integer NOT NULL,
  level_band text NOT NULL,
  level_int smallint NOT NULL,
  l1 text NOT NULL,
  l2 text NOT NULL,
  l3 text NOT NULL,
  PRIMARY KEY (source_id, topic_seq),
  CONSTRAINT hsk3_topics_seq_check CHECK (topic_seq BETWEEN 1 AND 427),
  CONSTRAINT hsk3_topics_level_check CHECK (level_int BETWEEN 1 AND 7),
  CONSTRAINT hsk3_topics_band_check CHECK (level_band IN ('1','2','3','4','5','6','7-9')),
  CONSTRAINT hsk3_topics_official_row_key UNIQUE (source_id, level_band, l1, l2, l3)
);

CREATE INDEX hsk3_topics_level_idx ON public.hsk3_topics (source_id, level_int);
CREATE INDEX hsk3_topics_path_idx ON public.hsk3_topics (source_id, l1, l2);

CREATE TABLE public.hsk3_topic_derivations (
  source_id text NOT NULL,
  topic_seq integer NOT NULL,
  derivation_version text NOT NULL,
  l3_terms text[] NOT NULL,
  n_terms smallint NOT NULL,
  has_explicit_open_marker boolean NOT NULL,
  path text NOT NULL,
  appears_in_levels smallint[] NOT NULL,
  n_levels smallint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_id, topic_seq, derivation_version),
  FOREIGN KEY (source_id, topic_seq)
    REFERENCES public.hsk3_topics(source_id, topic_seq) ON DELETE CASCADE,
  CONSTRAINT hsk3_topic_derivations_term_count_check CHECK (n_terms = cardinality(l3_terms)),
  CONSTRAINT hsk3_topic_derivations_level_count_check CHECK (n_levels = cardinality(appears_in_levels)),
  CONSTRAINT hsk3_topic_derivations_levels_check CHECK (appears_in_levels <@ ARRAY[1,2,3,4,5,6,7]::smallint[])
);

CREATE TABLE public.pragma_hsk_topic_mappings (
  source_id text NOT NULL,
  topic_seq integer NOT NULL,
  mapping_version text NOT NULL,
  axis_code text NOT NULL,
  scope_code text NOT NULL,
  app_domain_code text,
  has_state_administration_frame boolean NOT NULL DEFAULT false,
  coding_status text NOT NULL,
  selection_status text NOT NULL DEFAULT 'unreviewed',
  exclusion_reason_code text,
  coded_by text,
  coded_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_id, topic_seq, mapping_version),
  FOREIGN KEY (source_id, topic_seq)
    REFERENCES public.hsk3_topics(source_id, topic_seq) ON DELETE CASCADE,
  CONSTRAINT pragma_hsk_topic_mappings_axis_check CHECK (axis_code IN ('situation','subject')),
  CONSTRAINT pragma_hsk_topic_mappings_scope_check CHECK (scope_code IN ('scenario','topic')),
  CONSTRAINT pragma_hsk_topic_mappings_coding_status_check CHECK (
    coding_status IN ('legacy_imported_unverified','coded','double_checked')
  ),
  CONSTRAINT pragma_hsk_topic_mappings_selection_status_check CHECK (
    selection_status IN ('unreviewed','candidate','in_scope','out_of_scope')
  ),
  CONSTRAINT pragma_hsk_topic_mappings_exclusion_reason_check CHECK (
    selection_status = 'out_of_scope' OR exclusion_reason_code IS NULL
  )
);

CREATE INDEX pragma_hsk_topic_mappings_selection_idx
  ON public.pragma_hsk_topic_mappings (source_id, mapping_version, selection_status);

ALTER TABLE public.hsk_reference_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hsk3_vocab ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hsk3_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hsk3_topic_derivations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pragma_hsk_topic_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hsk reference sources readable by authenticated"
  ON public.hsk_reference_sources FOR SELECT TO authenticated USING (true);
CREATE POLICY "hsk3 vocab readable by authenticated"
  ON public.hsk3_vocab FOR SELECT TO authenticated USING (true);
CREATE POLICY "hsk3 topics readable by authenticated"
  ON public.hsk3_topics FOR SELECT TO authenticated USING (true);
CREATE POLICY "hsk3 topic derivations readable by authenticated"
  ON public.hsk3_topic_derivations FOR SELECT TO authenticated USING (true);
CREATE POLICY "pragma hsk topic mappings readable by authenticated"
  ON public.pragma_hsk_topic_mappings FOR SELECT TO authenticated USING (true);

GRANT SELECT ON public.hsk_reference_sources TO authenticated;
GRANT SELECT ON public.hsk3_vocab TO authenticated;
GRANT SELECT ON public.hsk3_topics TO authenticated;
GRANT SELECT ON public.hsk3_topic_derivations TO authenticated;
GRANT SELECT ON public.pragma_hsk_topic_mappings TO authenticated;

GRANT ALL ON public.hsk_reference_sources TO service_role;
GRANT ALL ON public.hsk3_vocab TO service_role;
GRANT ALL ON public.hsk3_topics TO service_role;
GRANT ALL ON public.hsk3_topic_derivations TO service_role;
GRANT ALL ON public.pragma_hsk_topic_mappings TO service_role;

CREATE VIEW public.hsk3_vocab_cumulative
WITH (security_invoker = true)
AS
SELECT ceiling.level AS reference_ceiling, vocab.*
FROM generate_series(1, 7) AS ceiling(level)
JOIN public.hsk3_vocab AS vocab ON vocab.intro_level <= ceiling.level;

CREATE VIEW public.hsk3_reference_status
WITH (security_invoker = true)
AS
SELECT
  source.id AS source_id,
  source.title,
  source.publisher,
  source.released_at,
  source.effective_at,
  source.official_url,
  source.sha256,
  source.manifest_version,
  source.extraction_version,
  (SELECT count(*) FROM public.hsk3_vocab vocab WHERE vocab.source_id = source.id) AS vocabulary_entries,
  (SELECT count(*) FROM public.hsk3_topics topic WHERE topic.source_id = source.id) AS official_topic_rows,
  (SELECT count(*) FROM public.hsk3_topic_derivations derived WHERE derived.source_id = source.id) AS derived_topic_rows,
  (SELECT count(*) FROM public.pragma_hsk_topic_mappings mapping WHERE mapping.source_id = source.id) AS researcher_mapping_rows
FROM public.hsk_reference_sources source;

GRANT SELECT ON public.hsk3_vocab_cumulative TO authenticated, service_role;
GRANT SELECT ON public.hsk3_reference_status TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.hsk3_match_tokens(
  p_source_id text,
  p_max_intro_level smallint,
  p_tokens text[]
)
RETURNS TABLE (headword text, intro_level smallint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT vocab.headword, min(vocab.intro_level)::smallint AS intro_level
  FROM public.hsk3_vocab vocab
  WHERE vocab.source_id = p_source_id
    AND vocab.intro_level <= p_max_intro_level
    AND vocab.headword = ANY (p_tokens)
  GROUP BY vocab.headword
  ORDER BY vocab.headword;
$$;

REVOKE ALL ON FUNCTION public.hsk3_match_tokens(text, smallint, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hsk3_match_tokens(text, smallint, text[]) TO service_role;

COMMENT ON TABLE public.hsk_reference_sources IS
  'HSK official-source manifest. URL, version and SHA-256 are provenance, not a licensing claim.';
COMMENT ON TABLE public.hsk3_vocab IS
  'HSK 3.0 syllabus vocabulary entries. 11,000 entries include distinct pronunciation and sense rows.';
COMMENT ON TABLE public.hsk3_topics IS
  'Official HSK syllabus L1/L2/L3 topic transcription only.';
COMMENT ON TABLE public.hsk3_topic_derivations IS
  'Deterministic topic fields derived from official topic strings.';
COMMENT ON TABLE public.pragma_hsk_topic_mappings IS
  'Researcher-coded PRAGMA mappings, versioned and separated from official HSK rows.';
COMMENT ON FUNCTION public.hsk3_match_tokens(text, smallint, text[]) IS
  'Matches pre-tokenized Chinese strings under a cumulative HSK reference ceiling. It does not certify proficiency or block generation.';

COMMIT;
