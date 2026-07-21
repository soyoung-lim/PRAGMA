-- 앞 마이그레이션(20260721140000)이 겨냥한 정책 이름이 실제와 달라, 관대한 정책이
-- 그대로 남았다. RLS 정책은 OR로 합쳐지므로 남아 있으면 제한이 무력화된다.
--
-- 실제 현행 정책: "Approved scenarios readable, admins read all"
--   USING (review_status = 'approved' OR is_admin())
--   → 승인된 앵커 셀(usage_assignment='experiment_locked')까지 학습자가 읽을 수 있었다.
--     연구 앵커 비오염 원칙의 실제 구멍.
--
-- 두 조건을 모두 요구하는 단일 정책으로 정리한다:
--   승인됨(review_status) AND 학습용으로 배정됨(usage_assignment)

DROP POLICY IF EXISTS "Approved scenarios readable, admins read all" ON public.scenarios;
DROP POLICY IF EXISTS "Learners read published scenarios only" ON public.scenarios;

CREATE POLICY "Learners read approved coursework scenarios"
  ON public.scenarios FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR (
      review_status = 'approved'::public.review_status
      AND usage_assignment = 'coursework_published'::public.usage_assignment
    )
  );
