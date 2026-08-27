export type MissionReleaseGateMode = "legacy_reviewed" | "expert_v1";

export interface MissionReleaseState {
  mission_status: string | null;
  release_gate_mode?: string | null;
}

/** Professor final review is the current learner-release endpoint. */
export function isMissionReleasedForLearner(
  state: MissionReleaseState | null | undefined,
): boolean {
  if (!state) return false;
  return state.mission_status === "reviewed" || state.mission_status === "released";
}

export function missionReleaseLabel(state: MissionReleaseState): string {
  if (state.mission_status === "released") return "최종 공개 완료";
  if (state.mission_status === "reviewed") return "교수자 최종 검수 완료";
  if (state.mission_status === "generated") return "학습 콘텐츠 생성 완료";
  return "검수 대기";
}
