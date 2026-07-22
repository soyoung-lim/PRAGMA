-- 요청 패키지 1개 seed (2026-07-22) — D2의 마지막 조각이자 D4(학습자 화면 DB 연결)의 선행 조건.
--
-- 이 마이그레이션은 "새 콘텐츠를 집필"하지 않는다. 이미 LOCK 검수를 거쳐
-- src/lib/mission/mock*.ts 에 들어 있는 요청 단원을 그대로 DB로 옮긴다.
-- (자동화 퍼스트 원칙과 충돌하지 않음 — 나머지 화행은 AI 배치 생성 대상이다.
--  이 1개는 파이프라인이 만들어야 할 산출물의 '기준 견본'이다.)
--
-- 출처 매핑:
--   mockIntroArc.ts      → feature_packages.intro_hook / ref_cases / mpj_items / mpj_labels
--   mockPracticeMission.ts → scenarios(연습·전이 셀)
--   mockWeek.ts          → course_week_package_assignments (2주차)
--
-- 재실행 안전: 고정 UUID + ON CONFLICT DO NOTHING.

-- ── ⓪ 수준 값 정렬 (선행 결함 수정) ─────────────────────────
-- package_level_variants 만 'beginner'를 쓰고 있었다. enums.ts(LearnerLevel)와
-- curriculum_outlines 는 'beginner_intermediate'(입문·HSK4)를 쓴다.
-- 교강사 편성 화면의 수준 필터가 이 불일치에 걸리므로 여기서 정본으로 맞춘다.
-- 순서 주의: 제약을 먼저 풀지 않으면 UPDATE 자체가 기존 CHECK에 걸려 실패한다.
ALTER TABLE public.package_level_variants
  DROP CONSTRAINT IF EXISTS package_level_variants_level_check;

UPDATE public.package_level_variants SET level = 'beginner_intermediate' WHERE level = 'beginner';

ALTER TABLE public.package_level_variants
  ADD CONSTRAINT package_level_variants_level_check
  CHECK (level IN ('beginner_intermediate', 'intermediate', 'advanced'));

-- ── ① 시나리오 셀 (패키지는 참조만 — 셀 본체는 scenarios 소유) ──
INSERT INTO public.scenarios (
  scenario_id, review_status, usage_assignment, auto_check_result,
  speech_act, title, topic, source_text,
  domain, genre, mode, learner_level, language_direction,
  scenario_p, scenario_d, scenario_r,
  interaction_context, hsk_level_min,
  generation_provider, generator_model, generation_prompt_version
) VALUES
  -- 연습 셀 — 위챗 · 동급생 (mockPracticeMission.PRACTICE_SCENARIO)
  ('a1b2c3d4-0001-4000-8000-000000000001', 'approved', 'coursework_published', 'pass',
   'request', '발표 자료 마감 하루 연기 부탁 (위챗 · 동급생)', '조별 과제 일정 조율',
   '샤오린, 혹시 발표 자료 마감을 하루만 미뤄도 괜찮을까? 내 파트 정리가 좀 늦어져서… 안 되면 편하게 말해줘!',
   'school', 'messenger', 'translation', 'intermediate', 'ko_zh',
   'equal', 'acquaintance', 'mid',
   '이번 학기 처음 같은 조가 된 중국인 동급생에게 위챗으로 부탁해야 합니다.', 5,
   'seed', 'human_seed', 'mock_v1'),

  -- 전이 셀 — 매체 축 하나만 변경 (위챗 → 이메일). 상대·부담은 기준 셀과 동일하게 고정.
  -- ⚠️ 기존 mock(TRANSFER_CS)은 상대(P)·거리(D)·매체를 동시에 바꿔 전이 정의(한 축만)를
  --    위반했다. 여기서 정본을 매체 단일 축으로 정정한다. mock 쪽 코드는 D4에서 정리.
  ('a1b2c3d4-0001-4000-8000-000000000002', 'approved', 'coursework_published', 'pass',
   'request', '같은 부탁, 이메일로 (전이 · 매체 변경)', '조별 과제 일정 조율',
   '샤오린, 혹시 발표 자료 마감을 하루만 미뤄도 괜찮을까? 내 파트 정리가 좀 늦어져서… 안 되면 편하게 말해줘!',
   'school', 'email', 'translation', 'intermediate', 'ko_zh',
   'equal', 'acquaintance', 'mid',
   '같은 부탁을 이번엔 이메일로 전합니다. 상대는 그대로 샤오린이고, 매체만 바뀌었습니다.', 5,
   'seed', 'human_seed', 'mock_v1'),

  -- 통역 셀 — 대면 순차통역. 음성 최소 기능(D8) 연결 대상.
  -- ⚠️ 학습자 UI 미연결 상태. 슬롯·필터가 통역을 태울 수 있음을 증명하는 용도.
  ('a1b2c3d4-0001-4000-8000-000000000003', 'approved', 'coursework_published', 'pass',
   'request', '같은 부탁, 대면 순차통역', '조별 과제 일정 조율',
   '샤오린, 혹시 발표 자료 마감을 하루만 미뤄도 괜찮을까? 내 파트 정리가 좀 늦어져서… 안 되면 편하게 말해줘!',
   'school', 'facetoface', 'stt_interpreting', 'intermediate', 'ko_zh',
   'equal', 'acquaintance', 'mid',
   '조별 회의 자리에서 같은 부탁을 통역으로 전달합니다.', 5,
   'seed', 'human_seed', 'mock_v1')
ON CONFLICT (scenario_id) DO NOTHING;

-- ── ② 패키지 본체 (화행 × 목표 화용 요소) ────────────────────
INSERT INTO public.feature_packages (
  id, speech_act, target_feature, package_ver, status,
  intro_hook, ref_cases, mpj_items, mpj_labels,
  generation_model, generation_prompt_ver, rule_check_result, approved_at
) VALUES (
  'a1b2c3d4-0002-4000-8000-000000000001',
  'request', 'request_directness_mitigation', 'pkg_v1', 'approved',

  -- 도입 훅 = 장면 + 차이 찾기 단서 (mockIntroArc.HOOK_SCENE / CLUES)
  '{
    "eyebrow": "요청 · 직접성과 완화",
    "title": "어느 유학생의 3분 침묵",
    "lead": "민준 씨, 이번 학기 처음 같은 조가 된 리웨이에게 위챗으로 부탁을 보냈는데…",
    "direction": "밤 9시, 위챗. 아직 서로 존댓말도 어색한 사이.",
    "lines": [
      {"who": "민준", "zh": "把上次的课件发我一下。", "note": null},
      {"who": null, "zh": null, "note": "읽음 표시. 답장 없는 3분."},
      {"who": "리웨이", "zh": "哦，好。", "note": "파일만 툭. 그 뒤로 대화 끊김"}
    ],
    "closing": "문법은 완벽했습니다. 그런데 왜 차가워졌을까요? — 규칙 설명은 잠시 미뤄두고, 같은 상황을 잘 넘긴 사람들을 먼저 봅시다.",
    "clues": [
      {"zh": "李伟，在忙吗？", "why": "상황 묻기 — 본론 전에 상대 사정 확인"},
      {"zh": "不好意思，", "why": "완충 표현 — 부탁의 문을 부드럽게 엶"},
      {"zh": "我上次的课堂笔记没记全，", "why": "이유 제시 — 왜 부탁하는지 먼저"},
      {"zh": "不方便的话也没关系~", "why": "선택권 부여 — 거절할 여지를 열어둠"}
    ],
    "clue_tail": "你的笔记能发我看看吗？",
    "clues_required": 3
  }'::jsonb,

  -- 참조 사례 + 원리 (단일 규범 금지 — 적정 대역과 경계를 함께)
  '{
    "good": {"label": "사례 B · 더 간결해도 적절", "zh": "李伟，不好意思，笔记能发我一下吗？谢啦~"},
    "edge": {"label": "경계 · 문법은 맞는데 과해요", "zh": "尊敬的李伟同学，恳请您将笔记发送于我，不胜感激。"},
    "principle_lead": "어색한 사이의 중간 부담이라면 완충 한 마디와 선택권이면 충분한 경우가 많아요. 겹겹이 쌓으면(경계 사례) 오히려 거리를 둡니다 — 많을수록 좋은 게 아니라 상황에 맞는 만큼.",
    "principle_table": [
      {"k": "상대와의 지위", "v": "같은 학년 동급생 = 동등 → 존칭은 오히려 거리감", "hi": false},
      {"k": "가까움", "v": "아직 어색한 사이 → 반말 명령형은 위험", "hi": true},
      {"k": "부탁의 부담", "v": "노트 전체 공유 = 중간 부담 → 완충 한 겹 + 출구", "hi": true}
    ],
    "strategy_map_unlock": "요청 전략 지도가 열렸어요 — 방금 찾은 4개 단서가 지도의 전략들이에요."
  }'::jsonb,

  -- 감각 확인 MPJ (단일정답 객관식 금지 — 3분류)
  '{
    "prompt": "상황: 처음 보는 옆자리 학생에게 펜을 빌립니다. 각 발화를 분류해 보세요 — 정답 문장 하나를 고르는 게 아니에요.",
    "items": [
      {"zh": "笔借我。", "truth": "under", "fb": "처음 보는 사이엔 갑작스럽게 들려요 (과소완화)."},
      {"zh": "同学，不好意思，笔能借我用一下吗？", "truth": "ok", "fb": "완충 한 마디 + 의문형 — 이 상황의 적정 범위예요."},
      {"zh": "尊敬的同学，恳请您将笔借予我一用，不胜感激。", "truth": "over", "fb": "펜 하나에 이 격식 — 과잉이에요."}
    ]
  }'::jsonb,

  -- feature별 3분류 라벨 (과소/적정/과잉)
  '[{"key": "under", "label": "너무 직접"},
    {"key": "ok", "label": "알맞음"},
    {"key": "over", "label": "과잉 공손"}]'::jsonb,

  'human_seed', 'mock_v1',
  '{"source": "mock_migration", "checks": "LOCK 검수를 거친 기존 mock 이식 — 규칙검사 대상 아님"}'::jsonb,
  now()
)
ON CONFLICT (id) DO NOTHING;

-- ── ③ 수준 변형 (구조 공유, 배포는 수준별 독립) ──────────────
-- 중급(HSK5)만 published — 입문·고급은 텍스트 변형 생성 후 독립 배포.
--
-- ⚠️ policy_override는 채우지 않는다. 수준 정책의 정본은 코드 상수(policy_ver로 동결)이고
--    이 컬럼은 "이 패키지에만 적용할 예외"가 있을 때만 쓴다 — 평소 NULL (20260721140000 ③).
INSERT INTO public.package_level_variants (
  package_id, level, validation_status, variant_status
) VALUES
  ('a1b2c3d4-0002-4000-8000-000000000001', 'intermediate',           'pass', 'published'),
  ('a1b2c3d4-0002-4000-8000-000000000001', 'beginner_intermediate',  'fail', 'draft'),
  ('a1b2c3d4-0002-4000-8000-000000000001', 'advanced',               'fail', 'draft')
ON CONFLICT (package_id, level) DO NOTHING;

-- ── ④ 셀 참조 (슬롯 배치) ────────────────────────────────────
-- 전이 쌍 표현 규칙(package_items_transfer_pair_ck):
--   slot='transfer' 행만 pair_id·pair_role을 갖는다. 나머지 슬롯은 전부 NULL이어야 한다.
--   → 쌍은 transfer 슬롯 2행으로 표현한다: base(기준 상황) + switched(한 축 변경).
--   base는 연습 셀과 같은 시나리오를 가리킨다 — 비교 기준이 곧 그 상황이기 때문.
INSERT INTO public.package_items (
  package_id, scenario_id, slot, position, activity_type, task_type,
  pair_id, pair_role, changed_axis
) VALUES
  ('a1b2c3d4-0002-4000-8000-000000000001', 'a1b2c3d4-0001-4000-8000-000000000001',
   'practice', 1, '위챗', 'translation',
   NULL, NULL, NULL),

  ('a1b2c3d4-0002-4000-8000-000000000001', 'a1b2c3d4-0001-4000-8000-000000000001',
   'transfer', 1, '위챗', 'translation',
   'a1b2c3d4-0003-4000-8000-000000000001', 'base', NULL),

  ('a1b2c3d4-0002-4000-8000-000000000001', 'a1b2c3d4-0001-4000-8000-000000000002',
   'transfer', 2, '이메일', 'translation',
   'a1b2c3d4-0003-4000-8000-000000000001', 'switched', 'medium'),

  ('a1b2c3d4-0002-4000-8000-000000000001', 'a1b2c3d4-0001-4000-8000-000000000003',
   'voice', 1, '대면', 'interpreting',
   NULL, NULL, NULL)
ON CONFLICT (package_id, slot, position) DO NOTHING;

-- ── ⑤ 15주 배치 — 2주차 = 요청 ───────────────────────────────
INSERT INTO public.course_week_package_assignments (course_week, package_id, sequence)
VALUES (2, 'a1b2c3d4-0002-4000-8000-000000000001', 1)
ON CONFLICT (course_week, package_id) DO NOTHING;
