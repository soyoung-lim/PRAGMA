export type HskAuditStatus = "complete" | "not_applicable" | "unavailable";
export type HskReviewFilter = "all" | "candidates" | "clear" | "unavailable" | "missing";

export type HskReviewSummary = {
  status: HskAuditStatus;
  referenceCeiling: number | null;
  distinctTokenCount: number | null;
  matchedTokenCount: number | null;
  coverageRatio: number | null;
  candidates: string[];
};

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function hskReviewSummary(content: unknown): HskReviewSummary | null {
  const record = recordValue(content);
  const audit = recordValue(record?.hsk_lexical_audit);
  const status = audit?.status;
  if (status !== "complete" && status !== "not_applicable" && status !== "unavailable") {
    return null;
  }

  return {
    status,
    referenceCeiling: typeof audit.reference_ceiling === "number" ? audit.reference_ceiling : null,
    distinctTokenCount: typeof audit.distinct_token_count === "number" ? audit.distinct_token_count : null,
    matchedTokenCount: typeof audit.matched_token_count === "number" ? audit.matched_token_count : null,
    coverageRatio: typeof audit.coverage_ratio === "number" ? audit.coverage_ratio : null,
    candidates: Array.isArray(audit.out_of_reference_candidates)
      ? audit.out_of_reference_candidates.filter((item): item is string => typeof item === "string")
      : [],
  };
}

export function parseHskReviewFilter(value: string | null): HskReviewFilter {
  return value === "candidates" || value === "clear" || value === "unavailable" || value === "missing"
    ? value
    : "all";
}

export function matchesHskReviewFilter(content: unknown, filter: HskReviewFilter): boolean {
  if (filter === "all") return true;
  const audit = hskReviewSummary(content);
  if (filter === "missing") return audit == null;
  if (filter === "unavailable") return audit?.status === "unavailable";
  if (filter === "candidates") return audit?.status === "complete" && audit.candidates.length > 0;
  return audit?.status === "complete" && audit.candidates.length === 0;
}

export function hskReferenceHref(referenceCeiling: number | null): string {
  if (referenceCeiling === 4) return "/admin/corpus#pragma-beginner";
  if (referenceCeiling === 5) return "/admin/corpus#pragma-intermediate";
  if (referenceCeiling === 6) return "/admin/corpus#pragma-advanced";
  return "/admin/corpus";
}
