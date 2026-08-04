import {
  CURRENT_CONTENT_RELEASE_ID,
  CURRENT_MISSION_PROMPT_VERSIONS,
} from "../../../supabase/functions/_shared/contentRelease";

export type ReviewVerdict = "pass" | "warning" | "fail" | "missing";
export type PromptMatch = "current" | "different" | "missing";
export type ContentReleaseMatch = "current" | "previous" | "mixed" | "missing";

export interface ReviewQueueFacts {
  scenario_id: string;
  mission_status: string | null;
  auto_check_result: string | null;
  core_content: unknown;
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
  | "mission_prompt_missing"
  | "mission_prompt_mismatch"
  | "content_release_missing"
  | "content_release_mismatch"
  | "feature_missing"
  | "mission_missing";

/**
 * 현재 배포 엣지가 내보내는 미션 프롬프트 버전.
 *
 * `prompt_snapshot_hash`는 **코어** 표면만 해시하므로, 미션 프롬프트를 고쳐도 값이
 * 그대로다. 그래서 코어 지문만 보는 안전 후보 판정은 구버전 프롬프트로 만든 미션을
 * 걸러내지 못했다 — 2026-07-31 baseline 14건 중 AI점검을 통과한 감사 2건(v2 생성)이
 * 자동 선택에 섞일 수 있었다(`DEC-20260731-02`에서 reviewed 금지로 정한 대상).
 *
 * 엣지 소스와 어긋나면 `promptSnapshot.test.ts`가 잡는다.
 */
export { CURRENT_CONTENT_RELEASE_ID, CURRENT_MISSION_PROMPT_VERSIONS };

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

export function missionPromptVersionOf(missionContent: unknown): string | null {
  if (!isRecord(missionContent)) return null;
  const provenance = missionContent.provenance;
  if (!isRecord(provenance)) return null;
  const version = provenance.prompt_version;
  return typeof version === "string" && version.length > 0 ? version : null;
}

function contentReleaseIdOf(value: unknown, path: "core" | "mission"): string | null {
  if (!isRecord(value)) return null;
  const parent = path === "core" ? value.generation : value.provenance;
  if (!isRecord(parent)) return null;
  const releaseId = parent.content_release_id;
  return typeof releaseId === "string" && releaseId.length > 0 ? releaseId : null;
}

export function coreContentReleaseIdOf(coreContent: unknown): string | null {
  return contentReleaseIdOf(coreContent, "core");
}

export function missionContentReleaseIdOf(missionContent: unknown): string | null {
  return contentReleaseIdOf(missionContent, "mission");
}

export function contentReleaseMatchOf(
  coreContent: unknown,
  missionContent: unknown,
): ContentReleaseMatch {
  const coreReleaseId = coreContentReleaseIdOf(coreContent);
  const missionReleaseId = missionContentReleaseIdOf(missionContent);

  if (!coreReleaseId || !missionReleaseId) return "missing";
  if (coreReleaseId !== missionReleaseId) return "mixed";
  return coreReleaseId === CURRENT_CONTENT_RELEASE_ID ? "current" : "previous";
}

export function rapidReviewBlockers(
  row: ReviewQueueFacts,
  currentPromptHash: string,
  allowedMissionPromptVersions: readonly string[] = CURRENT_MISSION_PROMPT_VERSIONS,
): RapidReviewBlocker[] {
  const blockers: RapidReviewBlocker[] = [];

  if (row.mission_status !== "generated") blockers.push("not_generated");
  if (row.auto_check_result !== "pass") blockers.push("core_rule_not_pass");
  if (missionQualityVerdict(row.mission_content) !== "pass") {
    blockers.push("ai_quality_not_pass");
  }
  if (!row.generation_run_id) blockers.push("run_missing");

  const coreReleaseId = coreContentReleaseIdOf(row.core_content);
  const missionReleaseId = missionContentReleaseIdOf(row.mission_content);
  if (!coreReleaseId || !missionReleaseId) {
    blockers.push("content_release_missing");
  } else if (
    coreReleaseId !== CURRENT_CONTENT_RELEASE_ID ||
    missionReleaseId !== CURRENT_CONTENT_RELEASE_ID ||
    coreReleaseId !== missionReleaseId
  ) {
    blockers.push("content_release_mismatch");
  }

  const promptMatch = promptMatchOf(row.prompt_snapshot_hash, currentPromptHash);
  if (promptMatch === "missing") blockers.push("prompt_missing");
  if (promptMatch === "different") blockers.push("prompt_mismatch");

  // 코어 지문은 미션 프롬프트 개정을 반영하지 않으므로 별도로 확인한다.
  const missionPromptVersion = missionPromptVersionOf(row.mission_content);
  if (!missionPromptVersion) {
    blockers.push("mission_prompt_missing");
  } else if (!allowedMissionPromptVersions.includes(missionPromptVersion)) {
    blockers.push("mission_prompt_mismatch");
  }

  if (!row.target_feature || !row.target_feature_version) {
    blockers.push("feature_missing");
  }
  if (!isRecord(row.mission_content)) blockers.push("mission_missing");

  return blockers;
}

export function isRapidReviewCandidate(
  row: ReviewQueueFacts,
  currentPromptHash: string,
  allowedMissionPromptVersions: readonly string[] = CURRENT_MISSION_PROMPT_VERSIONS,
): boolean {
  return rapidReviewBlockers(row, currentPromptHash, allowedMissionPromptVersions).length === 0;
}

export function rapidReviewCandidateIds(
  rows: ReviewQueueFacts[],
  currentPromptHash: string,
  limit = 25,
  allowedMissionPromptVersions: readonly string[] = CURRENT_MISSION_PROMPT_VERSIONS,
): string[] {
  const safeLimit = Math.max(0, Math.floor(limit));
  return rows
    .filter((row) => isRapidReviewCandidate(row, currentPromptHash, allowedMissionPromptVersions))
    .slice(0, safeLimit)
    .map((row) => row.scenario_id);
}
