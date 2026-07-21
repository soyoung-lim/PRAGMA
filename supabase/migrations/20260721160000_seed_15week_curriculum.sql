-- 15주 커리큘럼 매크로 골격 seed (2026-07-21).
-- 출처: 15주 배치 LOCK — 학습자 쪽 mockLearnerCourse.ts(COURSE_WEEKS)와 동일한 정본.
-- 배치 원리: ①대응쌍→FTA ②인접쌍 묶음(요청·초대→거절) ③단일 화행→연쇄 복잡도 상승.
--            부담도가 단조 상승하지 않는다. 8주 중간·15주 기말은 학사 일정상 고정.
--
-- 이 테이블은 "몇 주차에 어떤 화행인가"(매크로 골격)만 담는다.
-- 그 주차에 어떤 콘텐츠 패키지를 붙일지는 course_week_package_assignments가 담당한다.
--
-- 재실행 안전: 같은 제목의 outline이 있으면 아무것도 하지 않는다.

DO $$
DECLARE
  v_outline uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.curriculum_outlines WHERE title = '화행 기반 15주 커리큘럼') THEN
    RAISE NOTICE 'seed skipped: outline already exists';
    RETURN;
  END IF;

  INSERT INTO public.curriculum_outlines (
    title, week_count, level, language_direction, domain,
    target_speech_acts, midterm_week, final_week, scenarios_per_week,
    semester_goal, status
  ) VALUES (
    '화행 기반 15주 커리큘럼', 15, 'intermediate', 'ko_zh', 'school',
    ARRAY['request','thanks','compliment','agreement','refusal','apology',
          'complaint','proposal','opposition'],
    8, 15, 3,
    '주요 화행을 순환 배치해 단계적으로 학습하고, 조건을 바꿔 적용하며, 지정 주차에 수행을 점검한다.',
    'published'
  )
  RETURNING id INTO v_outline;

  INSERT INTO public.curriculum_weeks
    (outline_id, week_no, type, title, speech_act, curriculum_load_band, competency_focus, domain)
  VALUES
    (v_outline,  1, 'orientation', '오리엔테이션 · 진단',                 NULL,         NULL, '진단 · 학습 안내',              'school'),
    (v_outline,  2, 'regular',     '요청',                                'request',       1, '1순환 · 저부담',                'school'),
    (v_outline,  3, 'regular',     '감사·칭찬과 대응',                    'thanks',        1, '1순환 · 저부담',                'school'),
    (v_outline,  4, 'regular',     '초대·공동행동 권유',                  'agreement',     1, '1순환 · 저부담',                'school'),
    (v_outline,  5, 'regular',     '저부담 화행 도메인 전환',             NULL,            1, '1순환 통합 · 도메인 전환',      'work'),
    (v_outline,  6, 'regular',     '거절',                                'refusal',       2, '2순환 · 고부담',                'school'),
    (v_outline,  7, 'regular',     '사과',                                'apology',       2, '2순환 · 고부담',                'school'),
    (v_outline,  8, 'midterm',     '중간 점검 — 화행 6종 수행평가',       NULL,         NULL, '중간 평가',                     'school'),
    (v_outline,  9, 'regular',     '불만 제기',                           'complaint',     2, '2순환 · 고부담',                'work'),
    (v_outline, 10, 'regular',     '제안·조언',                           'proposal',      2, '2순환 · 고부담',                'work'),
    (v_outline, 11, 'regular',     '반대·이견 제시',                      'opposition',    3, '3순환 · 최고난도',              'work'),
    (v_outline, 12, 'regular',     '화행 연쇄 — 협상',                    NULL,            3, '종합 · 화행 연쇄',              'work'),
    (v_outline, 13, 'regular',     '산업 맥락화',                         NULL,            3, '맥락화 · 산업 분야 적용',       'work'),
    (v_outline, 14, 'regular',     '종합 프로젝트 · 화용 지문 리포트',    NULL,            3, '프로젝트 · 수행 종합',          'work'),
    (v_outline, 15, 'final',       '기말 — 통합 시뮬레이션 평가',         NULL,         NULL, '기말 평가',                     'work');
END $$;
