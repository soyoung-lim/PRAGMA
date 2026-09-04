-- 2026-09-04 확정된 논문·수업용 세 표준 강좌의 이름과 수행모드 비중을 맞춘다.
-- 실제 학습 12주가 분모이며 혼합 강좌는 앞쪽 번역 → 뒤쪽 통역을 따른다.

UPDATE public.curriculum_outlines AS outline
SET
  title = preset.title,
  course_mode = 'mixed',
  target_interpreting_week_count = preset.interpreting_weeks,
  target_interpreting_ratio = preset.interpreting_weeks::numeric / 12,
  semester_goal = preset.semester_goal,
  updated_at = now()
FROM (
  VALUES
    (
      '915fec24-cc38-4b00-a2a0-c3628abcd3f7'::uuid,
      'AI 한중 화용 통번역 실습'::text,
      6::smallint,
      '일상·학업 맥락의 화용 판단을 전반부 번역에서 익히고 후반부 통역 상황에 다시 적용한다.'::text
    ),
    (
      'c3f9a2d7-6e84-4f61-a953-2b7d9c0e4a12'::uuid,
      'AI 중한 실전 통번역'::text,
      3::smallint,
      '여러 생활 영역의 중국어 원문을 한국어 독자와 상황에 맞게 조정하고 후반부 통역 상황에 다시 적용한다.'::text
    ),
    (
      'a10c5b2e-7c5a-4f0c-9f4a-6d61cf6b8e21'::uuid,
      'AI 한중 비즈니스 통번역 실습'::text,
      6::smallint,
      '직장·고객·플랫폼 맥락의 화용 판단을 전반부 번역에서 익히고 후반부 통역 상황에 다시 적용한다.'::text
    )
) AS preset(id, title, interpreting_weeks, semester_goal)
WHERE outline.id = preset.id;

COMMENT ON COLUMN public.curriculum_outlines.target_interpreting_week_count IS
  'OT·중간·기말을 제외한 실제 학습 12주 중 통역 주차 수. 현행 표준 혼합값은 3 또는 6.';
