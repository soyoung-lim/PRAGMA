export type MissionReleaseGateMode = "legacy_reviewed" | "expert_v1";

export interface MissionReleaseState {
  mission_status: string | null;
  release_gate_mode?: string | null;
}

/**
 * Covered v1.5 missions are runnable only after authoritative release.
 * Rows created before lineage coverage keep the legacy reviewed behavior.
 */
export function isMissionReleasedForLearner(
  state: MissionReleaseState | null | undefined,
): boolean {
  if (!state) return false;
  const gate = state.release_gate_mode ?? "legacy_reviewed";
  return state.mission_status === "released"
    || (gate === "legacy_reviewed" && state.mission_status === "reviewed");
}

export function missionReleaseLabel(state: MissionReleaseState): string {
  if (state.mission_status === "released") return "전문가·회귀 통과(released)";
  if (state.mission_status === "reviewed" && state.release_gate_mode === "expert_v1") {
    return "내부 검수 완료 · 전문가 공개 대기";
  }
  if (state.mission_status === "reviewed") return "레거시 검토 완료";
  if (state.mission_status === "generated") return "미션 생성됨";
  return "코어(검수 대기)";
}
