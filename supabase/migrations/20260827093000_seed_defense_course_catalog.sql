-- Publish only the three defense course shells and their shared 15-week plan.
-- No mission content or week assignment is generated here. Existing assignments
-- on the flagship course are preserved, including existing week IDs and
-- instructor-entered context metadata. The app hides mode-incompatible legacy
-- assignments from the new learning plan without deleting them.

ALTER TABLE public.curriculum_outlines
  DROP CONSTRAINT IF EXISTS curriculum_outlines_course_mode_check;

-- The mode policy now uses all 12 learning weeks (OT/midterm/final excluded).
UPDATE public.curriculum_outlines
SET target_interpreting_week_count = CASE course_mode
  WHEN 'translation' THEN 0
  WHEN 'interpreting' THEN 12
  ELSE greatest(
    1,
    least(11, round(target_interpreting_week_count::numeric * 12 / 9)::integer)
  )
END;

UPDATE public.curriculum_outlines
SET target_interpreting_ratio = target_interpreting_week_count::numeric / 12;

ALTER TABLE public.curriculum_outlines
  ADD CONSTRAINT curriculum_outlines_course_mode_check
    CHECK (
      (course_mode = 'translation' AND target_interpreting_week_count = 0)
      OR (course_mode = 'interpreting' AND target_interpreting_week_count = 12)
      OR (
        course_mode = 'mixed'
        AND target_interpreting_week_count BETWEEN 1 AND 11
      )
    );

COMMENT ON COLUMN public.curriculum_outlines.target_interpreting_week_count IS
  'OT·중간·기말을 제외한 실제 학습 12주 중 통역 주차 수. 혼합은 학기 뒤쪽 n개 학습 주차에 적용.';

INSERT INTO public.curriculum_outlines (
  id,
  title,
  status,
  level,
  language_direction,
  domain,
  industry,
  semester_goal,
  target_speech_acts,
  week_count,
  midterm_week,
  final_week,
  scenarios_per_week,
  composition_theme_codes,
  course_mode,
  target_interpreting_week_count,
  target_interpreting_ratio
)
VALUES
  (
    '915fec24-cc38-4b00-a2a0-c3628abcd3f7'::uuid,
    'AI 기반 한중 화용 통번역 실습',
    'published',
    'intermediate',
    'ko_zh',
    'school',
    NULL,
    '일상·학업 맥락의 화용 판단을 전반부 번역에서 익히고 후반부 통역 상황에 다시 적용한다.',
    ARRAY['request','thanks','compliment','agreement','refusal','apology','proposal','opposition','complaint']::text[],
    15, 8, 15, 2,
    ARRAY['campus_study','international_exchange','relationship_social','daily_living']::text[],
    'mixed', 6, 0.5
  ),
  (
    'a10c5b2e-7c5a-4f0c-9f4a-6d61cf6b8e21'::uuid,
    'AI 기반 한중 비즈니스 커뮤니케이션',
    'published',
    'advanced',
    'ko_zh',
    'work',
    NULL,
    '직장·고객·플랫폼 맥락에서 권한관계와 공식성을 판단하고 고부담 화행에 다시 적용한다.',
    ARRAY['request','thanks','compliment','agreement','refusal','apology','proposal','opposition','complaint']::text[],
    15, 8, 15, 2,
    ARRAY['career_workplace','commerce_customer','digital_content']::text[],
    'mixed', 2, 0.1666666667
  ),
  (
    'c3f9a2d7-6e84-4f61-a953-2b7d9c0e4a12'::uuid,
    'AI 기반 중한 실전 번역',
    'published',
    'intermediate',
    'zh_ko',
    'daily',
    NULL,
    '여러 생활 영역의 중국어 원문을 한국어 독자와 상황에 맞게 조정하는 화용 번역을 반복한다.',
    ARRAY['request','thanks','compliment','agreement','refusal','apology','proposal','opposition','complaint']::text[],
    15, 8, 15, 2,
    ARRAY['digital_content','career_workplace','commerce_customer','campus_study','daily_living']::text[],
    'translation', 0, 0
  )
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  status = EXCLUDED.status,
  level = EXCLUDED.level,
  language_direction = EXCLUDED.language_direction,
  domain = EXCLUDED.domain,
  industry = EXCLUDED.industry,
  semester_goal = EXCLUDED.semester_goal,
  target_speech_acts = EXCLUDED.target_speech_acts,
  week_count = EXCLUDED.week_count,
  midterm_week = EXCLUDED.midterm_week,
  final_week = EXCLUDED.final_week,
  scenarios_per_week = EXCLUDED.scenarios_per_week,
  composition_theme_codes = EXCLUDED.composition_theme_codes,
  course_mode = EXCLUDED.course_mode,
  target_interpreting_week_count = EXCLUDED.target_interpreting_week_count,
  target_interpreting_ratio = EXCLUDED.target_interpreting_ratio,
  updated_at = now();

INSERT INTO public.curriculum_weeks (
  outline_id,
  week_no,
  type,
  title,
  can_do,
  speech_act,
  scenario_slots
)
SELECT
  course.id,
  canonical.week_no,
  canonical.type,
  canonical.title,
  canonical.can_do,
  canonical.speech_act,
  canonical.scenario_slots
FROM (
  VALUES
    ('915fec24-cc38-4b00-a2a0-c3628abcd3f7'::uuid),
    ('a10c5b2e-7c5a-4f0c-9f4a-6d61cf6b8e21'::uuid),
    ('c3f9a2d7-6e84-4f61-a953-2b7d9c0e4a12'::uuid)
) AS course(id)
CROSS JOIN (
  VALUES
    (1,  'orientation', '오리엔테이션 · 출발점 확인', NULL::text, NULL::text[], 0),
    (2,  'regular', '요청', 'request', ARRAY['부탁을 부드럽고 분명하게 말하기']::text[], 2),
    (3,  'regular', '감사', 'thanks', ARRAY['도움의 크기에 맞게 감사하기']::text[], 2),
    (4,  'regular', '칭찬하기', 'compliment', ARRAY['근거를 들어 구체적으로 칭찬하기']::text[], 2),
    (5,  'regular', '초대 · 공동행동 권유', 'agreement', ARRAY['부담 없이 답할 수 있게 초대하기']::text[], 2),
    (6,  'regular', '거절', 'refusal', ARRAY['거절을 부드럽고 분명하게 말하기']::text[], 2),
    (7,  'regular', '중간 메타화용 클리닉', NULL::text, NULL::text[], 0),
    (8,  'midterm', '중간 통합 점검', NULL::text, NULL::text[], 0),
    (9,  'regular', '사과 · 수리', 'apology', ARRAY['책임과 해결 방법을 담아 사과하기']::text[], 2),
    (10, 'regular', '제안 · 조언', 'proposal', ARRAY['상대가 고를 수 있게 제안하기']::text[], 2),
    (11, 'regular', '반대 · 이견 제시', 'opposition', ARRAY['입장을 분명하고 부드럽게 반대하기']::text[], 2),
    (12, 'regular', '불만 · 문제 제기', 'complaint', ARRAY['문제와 영향을 구체적으로 말하기']::text[], 2),
    (13, 'regular', '고부담 맥락 집중 실전', NULL::text, NULL::text[], 2),
    (14, 'regular', '종합 메타화용 클리닉', NULL::text, NULL::text[], 0),
    (15, 'final', '기말 통합 수행 점검', NULL::text, NULL::text[], 0)
) AS canonical(week_no, type, title, speech_act, can_do, scenario_slots)
ON CONFLICT (outline_id, week_no) DO UPDATE SET
  type = EXCLUDED.type,
  title = EXCLUDED.title,
  can_do = EXCLUDED.can_do,
  speech_act = EXCLUDED.speech_act,
  scenario_slots = EXCLUDED.scenario_slots,
  updated_at = now();
