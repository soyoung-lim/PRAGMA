-- 강좌 수행 모드를 9개 목표 화행 주차 단위의 명시적 정책으로 저장한다.
-- 혼합 강좌의 실제 순서는 앱 계약상 앞쪽 번역 → 뒤쪽 통역이다.

ALTER TABLE public.curriculum_outlines
  ADD COLUMN IF NOT EXISTS course_mode text,
  ADD COLUMN IF NOT EXISTS target_interpreting_week_count smallint;

-- 기존 강좌는 역사값인 ratio를 가장 가까운 9주 정수 정책으로 이관한다.
UPDATE public.curriculum_outlines
SET target_interpreting_week_count = greatest(
  0,
  least(9, round(coalesce(target_interpreting_ratio, 0) * 9)::integer)
)
WHERE target_interpreting_week_count IS NULL;

UPDATE public.curriculum_outlines
SET course_mode = CASE target_interpreting_week_count
  WHEN 0 THEN 'translation'
  WHEN 9 THEN 'interpreting'
  ELSE 'mixed'
END
WHERE course_mode IS NULL;

ALTER TABLE public.curriculum_outlines
  ALTER COLUMN course_mode SET DEFAULT 'translation',
  ALTER COLUMN course_mode SET NOT NULL,
  ALTER COLUMN target_interpreting_week_count SET DEFAULT 0,
  ALTER COLUMN target_interpreting_week_count SET NOT NULL,
  DROP CONSTRAINT IF EXISTS curriculum_outlines_course_mode_check,
  ADD CONSTRAINT curriculum_outlines_course_mode_check
    CHECK (
      (course_mode = 'translation' AND target_interpreting_week_count = 0)
      OR (course_mode = 'interpreting' AND target_interpreting_week_count = 9)
      OR (
        course_mode = 'mixed'
        AND target_interpreting_week_count BETWEEN 1 AND 8
      )
    );

COMMENT ON COLUMN public.curriculum_outlines.course_mode IS
  '강좌 수행 모드: translation, interpreting, mixed.';
COMMENT ON COLUMN public.curriculum_outlines.target_interpreting_week_count IS
  '9개 목표 화행 주차 중 통역 주차 수. 혼합은 학기 뒤쪽 n개 화행 주차에 적용.';
COMMENT ON COLUMN public.curriculum_outlines.target_interpreting_ratio IS
  '폐기 예정 legacy 값. 새 편성은 course_mode와 target_interpreting_week_count를 사용.';
