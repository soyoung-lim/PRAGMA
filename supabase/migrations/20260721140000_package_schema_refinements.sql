-- D2 보정 (2026-07-21, 교차검토 반영). 20260721130000이 이미 적용된 뒤라 ALTER로 처리한다.
--
-- ① 주차 소유권을 배치층으로 이동 — 패키지는 화행×목표 특징이므로 주차를 소유하면
--    같은 패키지를 다른 주차에 재사용할 수 없고, course_week/learning_unit 분리도 막힌다.
-- ② 전이 쌍을 표현할 필드 — "한 축만 바꾼다"가 전이의 정의인데 기존 스키마로는
--    어느 두 문항이 쌍이고 무엇이 바뀌었는지 표현할 수 없었다.
-- ③ 수준 정책 정본은 코드 상수(policy_ver로 동결). DB에는 예외 override만 둔다.
-- ④ 학습자 노출 조건을 DB에서 강제 — 앵커 셀 비오염을 RLS로 보장한다.

-- ── ① 주차 배치 = 배치층 소유 ─────────────────────────────
CREATE TABLE public.course_week_package_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_week int NOT NULL,                -- 15주 수업연계 배치
  package_id uuid NOT NULL REFERENCES public.feature_packages(id) ON DELETE CASCADE,
  sequence int NOT NULL DEFAULT 1,         -- 한 주에 여러 패키지가 올 때의 순서
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_week, package_id),
  UNIQUE (course_week, sequence)
);

DROP INDEX IF EXISTS idx_packages_week;
ALTER TABLE public.feature_packages DROP COLUMN IF EXISTS week_no;

CREATE INDEX idx_week_assignments_week ON public.course_week_package_assignments(course_week);
CREATE INDEX idx_week_assignments_package ON public.course_week_package_assignments(package_id);

GRANT SELECT ON public.course_week_package_assignments TO authenticated;
GRANT ALL ON public.course_week_package_assignments TO service_role;
ALTER TABLE public.course_week_package_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "learner_select_week_assignments"
  ON public.course_week_package_assignments FOR SELECT TO authenticated
  USING (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.feature_packages p
      WHERE p.id = package_id AND p.status = 'approved'
    )
  );
CREATE POLICY "admin_write_week_assignments"
  ON public.course_week_package_assignments FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── ② 전이 쌍 ────────────────────────────────────────────
ALTER TABLE public.package_items
  ADD COLUMN pair_id uuid,                                   -- 같은 값 = 한 쌍
  ADD COLUMN pair_role text CHECK (pair_role IN ('base', 'switched')),
  ADD COLUMN changed_axis text CHECK (changed_axis IN ('P', 'D', 'R', 'medium'));

-- 전이 슬롯은 쌍 정보를 반드시 갖고, 전이가 아니면 갖지 않는다.
-- (전이 = 정확히 한 축만 변경 — 다축 복합은 별도 '통합 과제' 유형)
ALTER TABLE public.package_items
  ADD CONSTRAINT package_items_transfer_pair_ck CHECK (
    (slot = 'transfer' AND pair_id IS NOT NULL AND pair_role IS NOT NULL
       AND (pair_role = 'base' OR changed_axis IS NOT NULL))
    OR
    (slot <> 'transfer' AND pair_id IS NULL AND pair_role IS NULL AND changed_axis IS NULL)
  );

CREATE INDEX idx_package_items_pair ON public.package_items(pair_id) WHERE pair_id IS NOT NULL;

-- ── ③ 수준 정책: 코드가 정본, DB는 예외 override만 ────────
ALTER TABLE public.package_level_variants
  RENAME COLUMN level_policy TO policy_override;
COMMENT ON COLUMN public.package_level_variants.policy_override IS
  '수준 정책의 정본은 코드 상수(policy_ver로 동결). 이 컬럼은 해당 패키지에만 적용할 예외가 있을 때만 채운다. 평소 NULL.';

-- ── ④ 학습자 노출 조건을 DB에서 강제 ─────────────────────
-- 기존 정책은 authenticated 전원에게 모든 시나리오를 열어줘, 학습자가 앵커 셀을
-- 직접 조회할 수 있었다(비오염 LOCK의 실제 구멍). 학습자는 coursework_published만 본다.
DROP POLICY IF EXISTS "Authenticated can read scenarios" ON public.scenarios;
CREATE POLICY "Learners read published scenarios only"
  ON public.scenarios FOR SELECT
  TO authenticated
  USING (public.is_admin() OR usage_assignment = 'coursework_published');
