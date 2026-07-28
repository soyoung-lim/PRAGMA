export type ReviewVerdict = "pass" | "warning" | "fail" | "missing";
export type PromptMatch = "current" | "different" | "missing";

export interface ReviewQueueFacts {
  scenario_id: string;
  mission_status: string | null;
  auto_check_result: string | null;
  mission_content: unknown;
  generation_run_id: string | null;
  prompt_snapshot_hash: string | null;
  target_feature: string | null;
  target_feature_version: string | null;
}

export type RapidReviewBlocker =
  | "not_generated"
  | "core_rule_not_pass"
  | "ai_quality_not_pass"
  | "run_missing"
  | "prompt_missing"
  | "prompt_mismatch"
  | "feature_missing"
  | "mission_missing";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function missionQualityVerdict(missionContent: unknown): ReviewVerdict {
  if (!isRecord(missionContent)) return "missing";
  const quality = missionContent.quality_check;
  if (!isRecord(quality)) return "missing";
  const verdict = quality.verdict;
  return verdict === "pass" || verdict === "warning" || verdict === "fail"
    ? verdict
    : "missing";
}

export function promptMatchOf(
  promptHash: string | null,
  currentPromptHash: string,
): PromptMatch {
  if (!promptHash) return "missing";
  return promptHash === currentPromptHash ? "current" : "different";
}

export function rapidReviewBlockers(
  row: ReviewQueueFacts,
  currentPromptHash: string,
): RapidReviewBlocker[] {
  const blockers: RapidReviewBlocker[] = [];

  if (row.mission_status !== "generated") blockers.push("not_generated");
  if (row.auto_check_result !== "pass") blockers.push("core_rule_not_pass");
  if (missionQualityVerdict(row.mission_content) !== "pass") {
    blockers.push("ai_quality_not_pass");
  }
  if (!row.generation_run_id) blockers.push("run_missing");

  const promptMatch = promptMatchOf(row.prompt_snapshot_hash, currentPromptHash);
  if (promptMatch === "missing") blockers.push("prompt_missing");
  if (promptMatch === "different") blockers.push("prompt_mismatch");

  if (!row.target_feature || !row.target_feature_version) {
    blockers.push("feature_missing");
  }
  if (!isRecord(row.mission_content)) blockers.push("mission_missing");

  return blockers;
}

export function isRapidReviewCandidate(
  row: ReviewQueueFacts,
  currentPromptHash: string,
): boolean {
  return rapidReviewBlockers(row, currentPromptHash).length === 0;
}

export function rapidReviewCandidateIds(
  rows: ReviewQueueFacts[],
  currentPromptHash: string,
  limit = 25,
): string[] {
  const safeLimit = Math.max(0, Math.floor(limit));
  return rows
    .filter((row) => isRapidReviewCandidate(row, currentPromptHash))
    .slice(0, safeLimit)
    .map((row) => row.scenario_id);
}
