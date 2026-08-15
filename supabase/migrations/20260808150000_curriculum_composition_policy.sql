-- 15주 강좌 편성 정책을 실제 배정 결과와 분리해 저장한다.
-- 빈 composition_theme_codes는 "전체 주제", target_interpreting_ratio는
-- 자동 채우기의 목표값이며 실제 배정 비율을 강제하는 게시 조건이 아니다.

ALTER TABLE public.curriculum_outlines
  ADD COLUMN IF NOT EXISTS composition_theme_codes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS target_interpreting_ratio numeric NOT NULL DEFAULT 0.3;
ALTER TABLE public.curriculum_outlines
  DROP CONSTRAINT IF EXISTS curriculum_outlines_composition_theme_codes_check,
  ADD CONSTRAINT curriculum_outlines_composition_theme_codes_check
    CHECK (
      composition_theme_codes <@ ARRAY[
        'campus_study',
        'daily_living',
        'travel_mobility',
        'relationship_social',
        'career_workplace',
        'commerce_customer',
        'digital_content',
        'international_exchange'
      ]::text[]
    ),
  DROP CONSTRAINT IF EXISTS curriculum_outlines_target_interpreting_ratio_check,
  ADD CONSTRAINT curriculum_outlines_target_interpreting_ratio_check
    CHECK (target_interpreting_ratio >= 0 AND target_interpreting_ratio <= 1);
COMMENT ON COLUMN public.curriculum_outlines.composition_theme_codes IS
  '교수자가 선택한 자동 편성 주제. 빈 배열은 전체 주제.';
COMMENT ON COLUMN public.curriculum_outlines.target_interpreting_ratio IS
  '자동 편성 목표 통역 비율(0~1). 실제 배정 결과와 별도.';
