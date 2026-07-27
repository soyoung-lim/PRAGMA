import type { ComposerCore } from "@/lib/curriculum/composer";

/** 계약 0-b·17: 학습자 편성에는 인간 검토가 끝난 미션만 들어갈 수 있다. */
export function isReviewedMission(
  core: Pick<ComposerCore, "mission_status"> | null | undefined,
): boolean {
  return core?.mission_status === "reviewed";
}
