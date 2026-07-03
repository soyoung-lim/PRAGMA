
CREATE TABLE public.course_weeks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_no int NOT NULL UNIQUE,
  course_phase text NOT NULL,
  lecture_topic text,
  detail_topic text NOT NULL,
  is_exam_week boolean NOT NULL DEFAULT false,
  is_onboarding_week boolean NOT NULL DEFAULT false,
  display_order int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.course_weeks TO authenticated;
GRANT ALL ON public.course_weeks TO service_role;

ALTER TABLE public.course_weeks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "course_weeks_select_authenticated"
  ON public.course_weeks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "course_weeks_admin_all"
  ON public.course_weeks FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TRIGGER course_weeks_set_updated_at
  BEFORE UPDATE ON public.course_weeks
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.course_weeks (week_no, course_phase, lecture_topic, detail_topic, is_onboarding_week, is_exam_week, display_order) VALUES
(0,  '시작 준비',   '시작 준비',   '학습자 프로필 설정',              true,  false, 0),
(1,  '정형 화행',   '정형 화행',   '감사 표현',                      false, false, 1),
(2,  '정형 화행',   '정형 화행',   '칭찬 · 칭찬 응답',                false, false, 2),
(3,  '대인 화행',   '대인 화행',   '요청할 때 직접성 조절하기',        false, false, 3),
(4,  '대인 화행',   '대인 화행',   '제안할 때 직접성 조절하기',        false, false, 4),
(5,  '대인 화행',   '대인 화행',   '동의 · 반대 표현',                false, false, 5),
(6,  '음성 통역',   '음성 통역',   '정형 · 대인 화행 통역 맛보기',     false, false, 6),
(7,  '중간점검',   '중간점검',   '번역 판단 · 수정 + 짧은 통역',     false, true,  7),
(8,  '고부담 화행', '고부담 화행', '사과 표현',                      false, false, 8),
(9,  '고부담 화행', '고부담 화행', '거절 표현',                      false, false, 9),
(10, '고부담 화행', '고부담 화행', '불만 · 불만 대응',               false, false, 10),
(11, '복합 과제',   '복합 과제',   '설득 · 조율',                    false, false, 11),
(12, '복합 과제',   '복합 과제',   '협상',                          false, false, 12),
(13, '음성 통역',   '음성 통역',   '고부담 화행 통역',               false, false, 13),
(14, '음성 통역',   '음성 통역',   '복합 과제 통역',                 false, false, 14),
(15, '기말 종합',   '기말 종합',   '최종 통번역 수행 · 성장 리포트',   false, true,  15);
