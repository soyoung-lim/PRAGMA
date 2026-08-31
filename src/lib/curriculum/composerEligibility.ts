import type { ComposerCore } from "@/lib/curriculum/composer";
import { isCurrentMissionReleasedForLearner } from "@/lib/mission/missionRelease";

/** 현재 LOCK release의 교수자 검수 완료 미션만 새 교과목에 편성할 수 있다. */
export function isReviewedMission(
  core: Pick<ComposerCore, "mission_status" | "release_gate_mode" | "content_release_id"> | null | undefined,
): boolean {
  return isCurrentMissionReleasedForLearner(core);
}
