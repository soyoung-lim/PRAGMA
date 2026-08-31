-- 학습자 프로필: 수업 운영용 기록 공유 확인을 연구 활용 동의와 분리한다.
-- 기존 학습자를 자동 동의로 간주하지 않기 위해 nullable로 추가한다.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS consent_class_record_sharing boolean;

COMMENT ON COLUMN public.profiles.consent_class_record_sharing IS
  '담당 교수자가 수업 운영·피드백을 위해 학습 기록을 확인하는 것에 대한 학습자 동의. NULL은 개편 전 미수집.';

COMMENT ON COLUMN public.profiles.chinese_level IS
  '목표 언어 공인시험 응답 코드. 한국어 주 사용자는 HSK, 중국어 주 사용자는 TOPIK 코드를 저장하며 not_taken을 허용.';

COMMENT ON COLUMN public.profiles.chinese_proficiency_self_report IS
  '2026-08-31 이후 신규 프로필에서는 수집하지 않는 구 자가 수준 응답.';
