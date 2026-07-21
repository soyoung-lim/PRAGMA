-- D2 (2026-07-21): TARGET FEATURE PACKAGE 최소 스키마.
-- 패키지 = 화행 × 목표 특징 (수준은 독립 패키지가 아니라 변형 — 경량화 확정).
-- 셀 본체는 scenarios에만 존재, package_items는 참조만 (조합층 LOCK: 이중 관리 금지).
-- 상태 기계는 기존 review_status enum 재사용. 검수 이력(audit trail) 포함 — 커미티 증빙.

-- ── 패키지 본체 ──────────────────────────────────────────────
CREATE TABLE public.feature_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  speech_act public.speech_act NOT NULL,
  target_feature text NOT NULL,          -- 예: request_entry_mitigation (요청_진입완화)
  week_no int,
  package_ver text NOT NULL DEFAULT 'pkg_v1',
  status public.review_status NOT NULL DEFAULT 'generated',

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

-- ── 수준 변형 (구조 공유, 텍스트·정책만 수준별) ──────────────
CREATE TABLE public.package_level_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.feature_packages(id) ON DELETE CASCADE,
  level text NOT NULL CHECK (level IN ('beginner', 'intermediate', 'advanced')),
  level_policy jsonb,                    -- 힌트량·선택지 수·산출 표적 등 (정책=데이터)
  level_text_variant jsonb,              -- 어휘 난이도 조정 텍스트 (필요 시에만)
  validation_status public.auto_check_result NOT NULL DEFAULT 'fail',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (package_id, level)
);

-- ── 셀 참조 (소유 아님) ─────────────────────────────────────
CREATE TABLE public.package_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.feature_packages(id) ON DELETE CASCADE,
  scenario_id uuid NOT NULL REFERENCES public.scenarios(scenario_id) ON DELETE RESTRICT,
  slot text NOT NULL,                    -- practice | transfer | mastery | anchor | voice
  position int NOT NULL DEFAULT 1,
  activity_type text,                    -- 위챗/이메일/분류/엑스레이/… (표면 활동 다양화)
  task_type text,                        -- direct_production | translation | interpreting | mpj
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (package_id, slot, position)
);

-- ── 승인 게이트: 3수준 변형 전부 pass여야 승인 가능 ──────────
-- (UI 1클릭 유지, 내부 검증 상태는 수준별 분리 — 최종점검 ④)
CREATE OR REPLACE FUNCTION public.tg_guard_package_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  passing_count int;
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    SELECT count(*) INTO passing_count
    FROM public.package_level_variants v
    WHERE v.package_id = NEW.id AND v.validation_status = 'pass';
    IF passing_count < 3 THEN
      RAISE EXCEPTION 'package % cannot be approved: % of 3 level variants passing',
        NEW.id, passing_count;
    END IF;
    NEW.approved_at := now();
    IF NEW.approved_by IS NULL THEN
      NEW.approved_by := auth.uid();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_package_approval
  BEFORE UPDATE ON public.feature_packages
  FOR EACH ROW EXECUTE FUNCTION public.tg_guard_package_approval();

-- ── 앵커 슬롯 오염 방지: experiment_locked 셀만 참조 가능 ─────
CREATE OR REPLACE FUNCTION public.tg_guard_anchor_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  usage public.usage_assignment;
BEGIN
  IF NEW.slot = 'anchor' THEN
    SELECT s.usage_assignment INTO usage
    FROM public.scenarios s WHERE s.scenario_id = NEW.scenario_id;
    IF usage IS DISTINCT FROM 'experiment_locked' THEN
      RAISE EXCEPTION 'anchor slot requires an experiment_locked scenario (got %)', usage;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_anchor_item
  BEFORE INSERT OR UPDATE ON public.package_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_guard_anchor_item();

-- ── updated_at ───────────────────────────────────────────────
CREATE TRIGGER trg_feature_packages_updated_at
  BEFORE UPDATE ON public.feature_packages
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_package_variants_updated_at
  BEFORE UPDATE ON public.package_level_variants
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ── 권한·RLS: 학습자는 approved만, 관리자는 전부 ─────────────
GRANT SELECT ON public.feature_packages, public.package_level_variants, public.package_items TO authenticated;
GRANT ALL ON public.feature_packages, public.package_level_variants, public.package_items TO service_role;

ALTER TABLE public.feature_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_level_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "learner_select_approved_packages"
  ON public.feature_packages FOR SELECT TO authenticated
  USING (status = 'approved' OR public.is_admin());

CREATE POLICY "admin_write_packages"
  ON public.feature_packages FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "learner_select_approved_variants"
  ON public.package_level_variants FOR SELECT TO authenticated
  USING (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.feature_packages p
      WHERE p.id = package_id AND p.status = 'approved'
    )
  );

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

CREATE INDEX idx_packages_week ON public.feature_packages(week_no);
CREATE INDEX idx_packages_status ON public.feature_packages(status);
CREATE INDEX idx_package_items_package ON public.package_items(package_id);
CREATE INDEX idx_package_variants_package ON public.package_level_variants(package_id);
