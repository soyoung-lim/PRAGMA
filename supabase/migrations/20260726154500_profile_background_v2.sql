-- 학습자 배경 문항 개편 (2026-07-26)
--
-- 배경: 기존 프로필은 중국어 배경을 HSK 급수 하나로만 받았다. 그런데 이 연구의
-- 출발점이 "HSK로는 화용 능력이 설명되지 않는다"(Dai & Roever)이고, 정본
-- (pragma-level-layer-lock)은 화용 난이도를 "습관 语域에서 얼마나 먼가"로 본다.
-- 그 语域을 잡을 입력이 없었다.
--
-- 신설 2개. 나머지 문항은 기존 컬럼 재사용:
--   주 사용 언어      → language_background (기존, 그동안 null로만 저장돼 있었다)
--   중국어 학습 수준  → chinese_level (기존)
--   통번역 경험       → ti_experience_level (기존, 미사용이었다)
--
-- 기존 데이터 무영향(둘 다 nullable). 테이블 단위 GRANT가 이미 있으므로
-- 신규 컬럼에도 그대로 적용된다 — 별도 GRANT 불요.

ALTER TABLE public.profiles
  -- 중국어를 접하거나 사용해 온 상황(복수 선택). 수용(드라마·읽을거리)과
  -- 산출·상호작용(대화·업무)을 함께 담아 语域 편향을 식별한다.
  ADD COLUMN IF NOT EXISTS chinese_exposure_contexts text[],
  -- 통번역 경험 한 줄 서술(선택). 정량 분류 대신 질적 사례를 남긴다.
  ADD COLUMN IF NOT EXISTS ti_experience_note text;

COMMENT ON COLUMN public.profiles.chinese_exposure_contexts IS
  '중국어 접촉·사용 상황 코드 배열(media·reading·class·messaging·work_docs·native_friends·residence·almost_none). 语域 편향 식별용.';
COMMENT ON COLUMN public.profiles.ti_experience_note IS
  '한중 통번역 경험 한 줄 서술(학습자 자유 입력, 선택).';
