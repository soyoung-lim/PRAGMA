import { CURRENT_CONTENT_RELEASE_ID } from "../../../supabase/functions/_shared/contentRelease";

export type MissionReleaseGateMode = "legacy_reviewed" | "expert_v1";

export interface MissionReleaseState {
  mission_status: string | null;
  release_gate_mode?: string | null;
  content_release_id?: string | null;
}

/** Professor final review is the current learner-release endpoint. */
export function isMissionReleasedForLearner(
  state: MissionReleaseState | null | undefined,
): boolean {
  if (!state) return false;
  return state.mission_status === "reviewed" || state.mission_status === "released";
}

/**
 * Scope Lock 이후 교과목 편성·학습 실행에 쓰는 현재 공개 경계.
 * 과거 reviewed/released 행은 연구·개발 이력으로 계속 읽을 수 있지만, 현재 release와
 * 명시적으로 일치하지 않으면 새 콘텐츠 은행과 공개 교과목에는 들어오지 않는다.
 */
export function isCurrentMissionReleasedForLearner(
  state: MissionReleaseState | null | undefined,
): boolean {
  return isMissionReleasedForLearner(state) && state?.content_release_id === CURRENT_CONTENT_RELEASE_ID;
}

export function missionReleaseLabel(state: MissionReleaseState): string {
  if (state.mission_status === "released") return "최종 공개 완료";
  if (state.mission_status === "reviewed") return "교수자 최종 검수 완료";
  if (state.mission_status === "generated") return "학습 콘텐츠 생성 완료";
  return "검수 대기";
}
