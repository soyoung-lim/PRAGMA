export type LearnerNoteAccessReason =
  | "instructor_released"
  | "all_required_missions_completed"
  | "locked";

export interface LearnerNoteAccess {
  unlocked: boolean;
  reason: LearnerNoteAccessReason;
  completedCount: number;
  requiredCount: number;
}

interface ResolveLearnerNoteAccessInput {
  instructorReleased: boolean;
  requiredMissionIds: string[];
  completedMissionIds: string[];
}

/**
 * 복습면 해금 규칙의 단일 정본.
 *
 * 빈 주차는 "전체 완료"로 간주하지 않는다. 실제 수행할 필수 미션이 없을 때는
 * 교수자가 명시적으로 공개해야 복습면이 열린다.
 */
export function resolveLearnerNoteAccess({
  instructorReleased,
  requiredMissionIds,
  completedMissionIds,
}: ResolveLearnerNoteAccessInput): LearnerNoteAccess {
  const required = [...new Set(requiredMissionIds.filter(Boolean))];
  const completed = new Set(completedMissionIds.filter(Boolean));
  const completedCount = required.filter((missionId) => completed.has(missionId)).length;
  const allRequiredCompleted =
    required.length > 0 && completedCount === required.length;

  if (instructorReleased) {
    return {
      unlocked: true,
      reason: "instructor_released",
      completedCount,
      requiredCount: required.length,
    };
  }

  if (allRequiredCompleted) {
    return {
      unlocked: true,
      reason: "all_required_missions_completed",
      completedCount,
      requiredCount: required.length,
    };
  }

  return {
    unlocked: false,
    reason: "locked",
    completedCount,
    requiredCount: required.length,
  };
}
