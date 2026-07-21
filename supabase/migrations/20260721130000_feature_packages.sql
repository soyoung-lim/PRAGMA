-- D2 (2026-07-21): TARGET FEATURE PACKAGE 최소 스키마.
-- 패키지 = 화행 × 목표 특징 (수준은 독립 패키지가 아니라 변형 — 경량화 확정).
-- 셀 본체는 scenarios에만 존재, package_items는 참조만 (조합층 LOCK: 이중 관리 금지).
-- 상태 기계는 기존 review_status enum 재사용. 검수 이력(audit trail) 포함 — 커미티 증빙.
--
-- 승인·배포 모델 (GPT 점검 2026-07-21 ① 반영):
--   feature_packages.status = 패키지 구조·공통 콘텐츠 승인
--   package_level_variants.variant_status = 수준별 draft|validated|published (서로 배포를 막지 않음)
--   → HSK5만 먼저 publish 가능, HSK4·6은 이후 독립 publish (희생 순서 정합)
--
-- 연구 앵커는 학습 패키지 소유물이 아님 (GPT 점검 ② 반영):
--   package_items 에는 anchor 슬롯 없음. 앵커는 assessment_forms(A/B)에 연결된다.

-- ── 패키지 본체 (공통 구조·교수 자료) ────────────────────────
CREATE TABLE public.feature_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  speech_act public.speech_act NOT NULL,
  target_feature text NOT NULL,          -- 예: request_entry_mitigation (요청_진입완화)
  week_no int,
  package_ver text NOT NULL DEFAULT 'pkg_v1',
  status public.review_status NOT NULL DEFAULT 'generated',  -- 공통부 승인 상태

  -- 패키지 소유 콘텐츠 (셀이 아닌 교수 자료)
  intro_hook jsonb,                      -- 도입 훅(장면)
  ref_cases jsonb,                       -- 참조 사례 A/B/경계 (intro 사례 ≠ 산출 문항 LOCK)
  mpj_items jsonb,                       -- 감각 확인 MPJ 문항
  mpj_labels jsonb,                      -- feature별 3분류 라벨 (예: 너무 직접적/적절/지나치게 우회적)

  -- 검수 이력 (audit trail)
  generation_model text,
  generation_prompt_ver text,
  rule_check_result jsonb,               -- 결정론적 규칙검사 결과 (코드, D2~3)
  reviewer_model text,                   -- 독립 제2모델 (경고 장치, D7 가동)
  reviewer_prompt_ver text,
  review_warnings jsonb,
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (speech_act, target_feature, package_ver)
);

-- ── 수준 변형 (구조 공유, 텍스트·정책만 수준별, 배포는 독립) ──
CREATE TABLE public.package_level_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.feature_packages(id) ON DELETE CASCADE,
  level text NOT NULL CHECK (level IN ('beginner', 'intermediate', 'advanced')),
  level_policy jsonb,                    -- 힌트량·선택지 수·산출 표적 등 (정책=데이터)
  level_text_variant jsonb,              -- 어휘 난이도 조정 텍스트 (필요 시에만)
  -- 검수 결과와 배포 생명주기를 분리:
  validation_status public.auto_check_result NOT NULL DEFAULT 'fail',   -- 규칙·제2모델 검사 결과
  variant_status text NOT NULL DEFAULT 'draft'                          -- 배포 생명주기 (수준별 독립)
    CHECK (variant_status IN ('draft', 'validated', 'published')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (package_id, level)
);

-- ── 셀 참조 (소유 아님) — anchor 슬롯 없음 ───────────────────
CREATE TABLE public.package_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.feature_packages(id) ON DELETE CASCADE,
  scenario_id uuid NOT NULL REFERENCES public.scenarios(scenario_id) ON DELETE RESTRICT,
  slot text NOT NULL CHECK (slot IN ('practice', 'transfer', 'mastery', 'voice')),
  position int NOT NULL DEFAULT 1,
  activity_type text,                    -- 위챗/이메일/분류/엑스레이/… (표면 활동 다양화)
  task_type text,                        -- direct_production | translation | interpreting | mpj
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (package_id, slot, position)
);

-- ── 연구 측정 폼 (앵커 전용, 학습 패키지와 분리) ─────────────
-- A/B 병렬형 + 참가자 간 교차배정(form_order). anchor 셀은 여기에만 연결된다.
CREATE TABLE public.assessment_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id text NOT NULL,                 -- A | B
  measurement_point text NOT NULL,       -- pre | mid | post
  cohort_id text,
  form_ver text NOT NULL DEFAULT 'form_v1',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (form_id, measurement_point, form_ver)
);

CREATE TABLE public.assessment_form_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.assessment_forms(id) ON DELETE CASCADE,
  scenario_id uuid NOT NULL REFERENCES public.scenarios(scenario_id) ON DELETE RESTRICT,
  position int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (form_id, position)
);

-- ── 패키지 공통부 승인 시 승인자·일시 스탬프 ─────────────────
-- (수준 변형 배포는 여기서 막지 않음 — 변형별 독립. GPT 점검 ①)
CREATE OR REPLACE FUNCTION public.tg_stamp_package_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    NEW.approved_at := now();
    IF NEW.approved_by IS NULL THEN
      NEW.approved_by := auth.uid();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_stamp_package_approval
  BEFORE UPDATE ON public.feature_packages
  FOR EACH ROW EXECUTE FUNCTION public.tg_stamp_package_approval();

-- ── 변형 배포 게이트: validated/published는 검사 pass일 때만 ──
CREATE OR REPLACE FUNCTION public.tg_guard_variant_publish()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.variant_status IN ('validated', 'published')
     AND NEW.validation_status <> 'pass' THEN
    RAISE EXCEPTION 'variant % cannot be %: validation_status is % (must be pass)',
      NEW.id, NEW.variant_status, NEW.validation_status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_variant_publish
  BEFORE INSERT OR UPDATE ON public.package_level_variants
  FOR EACH ROW EXECUTE FUNCTION public.tg_guard_variant_publish();

-- ── 앵커 오염 방지: assessment 폼은 experiment_locked 셀만 참조 ─
CREATE OR REPLACE FUNCTION public.tg_guard_assessment_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  usage public.usage_assignment;
BEGIN
  SELECT s.usage_assignment INTO usage
  FROM public.scenarios s WHERE s.scenario_id = NEW.scenario_id;
  IF usage IS DISTINCT FROM 'experiment_locked' THEN
    RAISE EXCEPTION 'assessment form item requires an experiment_locked scenario (got %)', usage;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_assessment_item
  BEFORE INSERT OR UPDATE ON public.assessment_form_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_guard_assessment_item();

-- ── updated_at ───────────────────────────────────────────────
CREATE TRIGGER trg_feature_packages_updated_at
  BEFORE UPDATE ON public.feature_packages
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_package_variants_updated_at
  BEFORE UPDATE ON public.package_level_variants
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ── 권한·RLS ─────────────────────────────────────────────────
GRANT SELECT ON public.feature_packages, public.package_level_variants, public.package_items TO authenticated;
GRANT SELECT ON public.assessment_forms, public.assessment_form_items TO authenticated;
GRANT ALL ON public.feature_packages, public.package_level_variants, public.package_items TO service_role;
GRANT ALL ON public.assessment_forms, public.assessment_form_items TO service_role;

ALTER TABLE public.feature_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_level_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_form_items ENABLE ROW LEVEL SECURITY;

-- 학습자: 승인된 패키지만. 수준 변형은 published 상태만.
CREATE POLICY "learner_select_approved_packages"
  ON public.feature_packages FOR SELECT TO authenticated
  USING (status = 'approved' OR public.is_admin());

CREATE POLICY "admin_write_packages"
  ON public.feature_packages FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "learner_select_published_variants"
  ON public.package_level_variants FOR SELECT TO authenticated
  USING (public.is_admin() OR variant_status = 'published');

CREATE POLICY "admin_write_variants"
  ON public.package_level_variants FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "learner_select_approved_items"
  ON public.package_items FOR SELECT TO authenticated
  USING (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.feature_packages p
      WHERE p.id = package_id AND p.status = 'approved'
    )
  );

CREATE POLICY "admin_write_items"
  ON public.package_items FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 연구 측정 폼: 관리자만 (앵커 문항은 학습자에게 목록으로 노출하지 않는다).
CREATE POLICY "admin_all_assessment_forms"
  ON public.assessment_forms FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_all_assessment_items"
  ON public.assessment_form_items FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE INDEX idx_packages_week ON public.feature_packages(week_no);
CREATE INDEX idx_packages_status ON public.feature_packages(status);
CREATE INDEX idx_package_items_package ON public.package_items(package_id);
CREATE INDEX idx_package_variants_package ON public.package_level_variants(package_id);
CREATE INDEX idx_assessment_form_items_form ON public.assessment_form_items(form_id);
