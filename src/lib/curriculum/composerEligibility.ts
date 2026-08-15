import type { ComposerCore } from "@/lib/curriculum/composer";
import { isMissionReleasedForLearner } from "@/lib/mission/missionRelease";

/** 기존 자료는 reviewed, 새 품질 게이트 자료는 released일 때만 편성할 수 있다. */
export function isReviewedMission(
  core: Pick<ComposerCore, "mission_status" | "release_gate_mode"> | null | undefined,
): boolean {
  return isMissionReleasedForLearner(core);
}
