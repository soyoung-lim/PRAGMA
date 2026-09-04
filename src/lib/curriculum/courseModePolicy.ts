import type { GenMode } from "@/lib/pragma/enums";

export const COURSE_MODES = ["translation", "interpreting", "mixed"] as const;
export type CourseMode = (typeof COURSE_MODES)[number];

/** 9개 목표 화행을 직접 학습하는 주차. */
export const TARGET_SPEECH_ACT_WEEK_NOS = [2, 3, 4, 5, 6, 9, 10, 11, 12] as const;
/** OT·중간·기말을 제외한 실제 학습 12주. 수행모드 비중의 유일한 분모다. */
export const ACTUAL_LEARNING_WEEK_NOS = [2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14] as const;
export const ACTUAL_LEARNING_WEEK_COUNT = ACTUAL_LEARNING_WEEK_NOS.length;
/** 현행 세 표준 강좌가 사용하는 혼합 모드 빠른 선택값(9/3, 6/6). */
export const MIXED_INTERPRETING_WEEK_PRESETS = [3, 6] as const;

export interface CourseModePolicy {
  courseMode: CourseMode;
  interpretingWeekCount: number;
}

export function isCourseModePolicyValid(policy: CourseModePolicy): boolean {
  if (!Number.isInteger(policy.interpretingWeekCount)) return false;
  if (policy.courseMode === "translation") return policy.interpretingWeekCount === 0;
  if (policy.courseMode === "interpreting") {
    return policy.interpretingWeekCount === ACTUAL_LEARNING_WEEK_COUNT;
  }
  return policy.interpretingWeekCount >= 1 && policy.interpretingWeekCount < ACTUAL_LEARNING_WEEK_COUNT;
}

/** legacy 비율은 역사값으로만 읽고 가장 가까운 12주 정수 정책으로 한 번 해석한다. */
export function courseModePolicyFromLegacyRatio(ratio: number | null | undefined): CourseModePolicy {
  const finiteRatio = typeof ratio === "number" && Number.isFinite(ratio) ? ratio : 0;
  const interpretingWeekCount = Math.max(
    0,
    Math.min(ACTUAL_LEARNING_WEEK_COUNT, Math.round(finiteRatio * ACTUAL_LEARNING_WEEK_COUNT)),
  );
  if (interpretingWeekCount === 0) return { courseMode: "translation", interpretingWeekCount };
  if (interpretingWeekCount === ACTUAL_LEARNING_WEEK_COUNT) {
    return { courseMode: "interpreting", interpretingWeekCount };
  }
  return { courseMode: "mixed", interpretingWeekCount };
}

/** 혼합 강좌는 난도가 번역→통역으로 상승하도록 뒤쪽 n개 실제 학습 주차를 통역으로 둔다. */
export function interpretingTargetWeekNumbers(
  policy: CourseModePolicy,
  targetWeekNumbers: readonly number[] = ACTUAL_LEARNING_WEEK_NOS,
): number[] {
  if (policy.courseMode === "translation") return [];
  if (policy.courseMode === "interpreting") return [...targetWeekNumbers];
  if (!isCourseModePolicyValid(policy) || targetWeekNumbers.length === 0) return [];

  const count = Math.min(policy.interpretingWeekCount, targetWeekNumbers.length);
  return targetWeekNumbers.slice(targetWeekNumbers.length - count);
}

export function expectedCoreModeForWeek(
  policy: CourseModePolicy,
  weekNo: number,
  targetWeekNumbers: readonly number[] = ACTUAL_LEARNING_WEEK_NOS,
): GenMode | null {
  if (!targetWeekNumbers.includes(weekNo)) return null;
  return interpretingTargetWeekNumbers(policy, targetWeekNumbers).includes(weekNo)
    ? "stt_interpreting"
    : "translation";
}

export const COURSE_MODE_LABEL: Record<CourseMode, string> = {
  translation: "번역 강좌",
  interpreting: "통역 강좌",
  mixed: "혼합 강좌",
};

export function courseModeWeekSummary(policy: CourseModePolicy): string {
  if (!isCourseModePolicyValid(policy)) return COURSE_MODE_LABEL[policy.courseMode];
  const translationWeekCount = ACTUAL_LEARNING_WEEK_COUNT - policy.interpretingWeekCount;
  if (policy.courseMode === "translation") return `번역 ${translationWeekCount}주`;
  if (policy.courseMode === "interpreting") return `통역 ${policy.interpretingWeekCount}주`;
  return `번역 ${translationWeekCount}주 · 통역 ${policy.interpretingWeekCount}주`;
}
