-- Align the released learner course with the approved 15-week canonical plan.
--
-- This is a data repair for the course already used in the learner UI. Existing
-- mission assignments are preserved and moved by their actual speech act; no
-- mission content is created or deleted. Week 13 remains unassigned until two
-- reviewed, high-burden missions from different learned speech acts are chosen.

CREATE TEMP TABLE pragma_course_assignment_remap (
  id uuid PRIMARY KEY,
  scenario_id uuid NOT NULL,
  target_week_no int NOT NULL
) ON COMMIT DROP;

INSERT INTO pragma_course_assignment_remap (id, scenario_id, target_week_no)
SELECT
  assignment.id,
  assignment.scenario_id,
  CASE week.speech_act
    WHEN 'request' THEN 2
    WHEN 'thanks' THEN 3
    WHEN 'compliment' THEN 4
    WHEN 'agreement' THEN 5
    WHEN 'refusal' THEN 6
    WHEN 'apology' THEN 9
    WHEN 'proposal' THEN 10
    WHEN 'opposition' THEN 11
    WHEN 'complaint' THEN 12
  END
FROM public.curriculum_week_scenarios AS assignment
JOIN public.curriculum_weeks AS week
  ON week.outline_id = assignment.outline_id
 AND week.week_no = assignment.week_no
WHERE assignment.outline_id = '915fec24-cc38-4b00-a2a0-c3628abcd3f7'::uuid
  AND week.speech_act IN (
    'request', 'thanks', 'compliment', 'agreement', 'refusal',
    'apology', 'proposal', 'opposition', 'complaint'
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.curriculum_week_scenarios AS assignment
    LEFT JOIN pragma_course_assignment_remap AS remap ON remap.id = assignment.id
    WHERE assignment.outline_id = '915fec24-cc38-4b00-a2a0-c3628abcd3f7'::uuid
      AND remap.id IS NULL
  ) THEN
    RAISE EXCEPTION 'canonical course repair stopped: an assignment is not tied to one of the nine speech acts';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pragma_course_assignment_remap
    GROUP BY target_week_no, scenario_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'canonical course repair stopped: remapping would duplicate a scenario in one week';
  END IF;
END
$$;

-- Move through a temporary week range so week swaps cannot hit the unique key.
UPDATE public.curriculum_week_scenarios AS assignment
SET week_no = assignment.week_no + 100
FROM pragma_course_assignment_remap AS remap
WHERE assignment.id = remap.id;

UPDATE public.curriculum_week_scenarios AS assignment
SET week_no = remap.target_week_no
FROM pragma_course_assignment_remap AS remap
WHERE assignment.id = remap.id;

UPDATE public.curriculum_outlines
SET
  week_count = 15,
  midterm_week = 8,
  final_week = 15,
  scenarios_per_week = 2,
  target_speech_acts = ARRAY[
    'request', 'thanks', 'compliment', 'agreement', 'refusal',
    'apology', 'proposal', 'opposition', 'complaint'
  ]::text[]
WHERE id = '915fec24-cc38-4b00-a2a0-c3628abcd3f7'::uuid;

UPDATE public.curriculum_weeks AS week
SET
  type = canonical.type,
  title = canonical.title,
  speech_act = canonical.speech_act,
  can_do = canonical.can_do,
  scenario_slots = canonical.scenario_slots,
  channel = NULL,
  pdr_power = NULL,
  pdr_distance = NULL,
  pdr_imposition = NULL,
  curriculum_load_band = NULL,
  competency_focus = NULL,
  domain = NULL,
  industry = NULL
FROM (
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
WHERE week.outline_id = '915fec24-cc38-4b00-a2a0-c3628abcd3f7'::uuid
  AND week.week_no = canonical.week_no;
