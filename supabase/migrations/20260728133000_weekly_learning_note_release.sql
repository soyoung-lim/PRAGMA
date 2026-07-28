-- 주차 학습 노트의 복습면을 교수자가 공개할 수 있게 한다.
--
-- 기본값은 false다. 학습자는 이 값이 true이거나 해당 주차의 필수 미션을
-- 모두 완료했을 때만 복습면을 본다. 기존 curriculum_weeks SELECT RLS를
-- 그대로 사용하며, learner 쓰기 권한은 추가하지 않는다.

ALTER TABLE public.curriculum_weeks
  ADD COLUMN IF NOT EXISTS review_released boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.curriculum_weeks.review_released IS
  '교수자가 주차 학습 노트의 복습면을 전체 학습자에게 공개했는지 여부';
