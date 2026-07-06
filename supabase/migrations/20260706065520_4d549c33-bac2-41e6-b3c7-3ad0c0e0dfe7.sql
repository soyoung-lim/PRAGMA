
CREATE TABLE public.prompt_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_key text NOT NULL,
  title text,
  content text NOT NULL DEFAULT '',
  category text,
  version int NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (prompt_key, version)
);

CREATE INDEX prompt_templates_prompt_key_idx ON public.prompt_templates (prompt_key);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prompt_templates TO authenticated;
GRANT ALL ON public.prompt_templates TO service_role;

ALTER TABLE public.prompt_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can select prompt_templates"
  ON public.prompt_templates FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can insert prompt_templates"
  ON public.prompt_templates FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update prompt_templates"
  ON public.prompt_templates FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete prompt_templates"
  ON public.prompt_templates FOR DELETE
  TO authenticated
  USING (public.is_admin());

CREATE TRIGGER prompt_templates_set_updated_at
  BEFORE UPDATE ON public.prompt_templates
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.prompt_templates (prompt_key, title, category, content, notes) VALUES
  ('metadata_lock_block', '메타데이터 잠금 블록', 'generation', '', '9축 메타(화행/장르/수준/맥락/산업/기능/P/D/R) 잠금 규칙'),
  ('source_text_responsibility_block', 'ST 책임 블록', 'generation', '', '원문(ST) 책임 소재 및 인용 규칙'),
  ('candidate_contrast_block', '후보 대비 블록', 'generation', '', '5개 후보 번역안의 대비 규칙(directness 등)'),
  ('reviewer_checklist_block', '검수 체크리스트 블록', 'review', '', '시나리오 검수 시 확인 항목'),
  ('report_schema_block', '리포트 스키마 블록', 'report', '', '개인화 리포트 JSON 스키마'),
  ('golden_examples', '골든 예시', 'golden', '', '모범 시나리오·번역안 예시 모음'),
  ('fta_design_note', 'FTA 설계 노트', 'fta', '', 'Face-Threatening Act 설계 원칙');
