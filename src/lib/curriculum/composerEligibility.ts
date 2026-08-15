import type { ComposerCore } from "@/lib/curriculum/composer";
import { isMissionReleasedForLearner } from "@/lib/mission/missionRelease";

/** covered는 released, legacy는 reviewed인 미션만 학습자 편성에 들어갈 수 있다. */
export function isReviewedMission(
  core: Pick<ComposerCore, "mission_status" | "release_gate_mode"> | null | undefined,
): boolean {
  return isMissionReleasedForLearner(core);
}
