import type { RuntimeFeedback } from "@/lib/pragma/feedbackSchema";
import type { RevisionScope } from "@/lib/pragma/feedbackSchema";

export type RevisionDecision = "revise" | "keep";
export type RevisionRecheckStatus = "reflected" | "partial" | "new_problem";

export interface RevisionRecheckResult {
  schema_version: "revision_recheck_v1";
  status: RevisionRecheckStatus;
  priority_target: RevisionScope;
  target_reflected: boolean;
  meaning_preserved: boolean;
  /** 의미 문제가 원래 수정 목표의 잔여인지, 수정 중 새로 생긴 문제인지 구분한다. */
  meaning_status: "preserved" | "target_not_yet_reflected" | "new_problem";
  new_problem_dimensions: Array<"meaning" | "grammar" | "pragmatic">;
  scan_count: 1;
  checked_at: string;
  feedback_snapshot: RuntimeFeedback;
}

export const canSubmitFixChoice = (selectedIndexes: ReadonlySet<number>) =>
  selectedIndexes.size === 2;

export const canRevealFixReview = (
  rejectedCorrectionId: string | null,
  failureReasonId: string | null,
) => Boolean(rejectedCorrectionId && failureReasonId);

export const canSubmitMultiJudge = (
  candidateCount: number,
  classifications: Readonly<Record<number, string>>,
) =>
  candidateCount > 0 &&
  Array.from({ length: candidateCount }, (_, index) => classifications[index])
    .every((value) => typeof value === "string" && value.length > 0);

/** 공백·문장부호·기호·대소문자만 바꾼 답은 실질 수정으로 보지 않는다. */
export function normalizeSubstantiveText(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\p{P}\p{S}\p{Z}\s]+/gu, "");
}

export function isSubstantiveRevision(first: string, revised: string): boolean {
  const before = normalizeSubstantiveText(first);
  const after = normalizeSubstantiveText(revised);
  return after.length > 0 && before !== after;
}

export function canSubmitRevision(input: {
  scope: RevisionScope | null;
  decision: RevisionDecision | null;
  first: string;
  revised: string;
  retentionReason: string;
  hasDissent: boolean;
}): boolean {
  const { scope, decision, first, revised, retentionReason, hasDissent } = input;
  if (!decision) return false;
  if (decision === "revise") return isSubstantiveRevision(first, revised);
  if (scope === "clear") return true;
  return retentionReason.trim().length > 0 || hasDissent;
}

/**
 * 수정본에 전체 재평가 루프를 붙이지 않고, feedback_v1 1회 결과를 지정 목표·의미
 * 보존·새 문제 세 항목으로 축약한다. 이 결과 뒤 추가 수정은 한 번 허용하되 재스캔하지 않는다.
 */
export function deriveRevisionRecheck(
  priorityTarget: RevisionScope,
  feedback: RuntimeFeedback,
  withinBandCode: string,
  checkedAt = new Date().toISOString(),
): RevisionRecheckResult {
  const verdicts = feedback.verdicts;
  const meaningPreserved = verdicts.semantic_fidelity === "preserved";
  const grammarClean = verdicts.grammatical_accuracy === "clean";
  const pragmaticWithin = verdicts.pragmatic_appropriateness.band_code === withinBandCode;
  const targetReflected = priorityTarget === "meaning"
    ? meaningPreserved
    : priorityTarget === "grammar"
      ? grammarClean
      : priorityTarget === "feature"
        ? pragmaticWithin
        : meaningPreserved && grammarClean && pragmaticWithin;
  const newProblems: RevisionRecheckResult["new_problem_dimensions"] = [];
  if (priorityTarget !== "meaning" && !meaningPreserved) newProblems.push("meaning");
  if (priorityTarget !== "grammar" && !grammarClean) newProblems.push("grammar");
  if (priorityTarget !== "feature" && !pragmaticWithin) newProblems.push("pragmatic");
  const status: RevisionRecheckStatus = newProblems.length > 0
    ? "new_problem"
    : targetReflected
      ? "reflected"
      : "partial";
  const meaningStatus: RevisionRecheckResult["meaning_status"] = meaningPreserved
    ? "preserved"
    : priorityTarget === "meaning"
      ? "target_not_yet_reflected"
      : "new_problem";
  return {
    schema_version: "revision_recheck_v1",
    status,
    priority_target: priorityTarget,
    target_reflected: targetReflected,
    meaning_preserved: meaningPreserved,
    meaning_status: meaningStatus,
    new_problem_dimensions: newProblems,
    scan_count: 1,
    checked_at: checkedAt,
    feedback_snapshot: feedback,
  };
}
