export type AuditStatus = "complete" | "not_applicable" | "unavailable";

export type AuditSnapshot = {
  status: AuditStatus;
  direction: "ko_zh" | "zh_ko" | null;
  createdAt: string | null;
  contentKind: "mission" | "core" | null;
  title: string | null;
  learnerLevel: string | null;
  mode: string | null;
  speechAct: string | null;
  speechActText: string | null;
  referenceCeiling: number | null;
  distinctTokenCount: number | null;
  matchedTokenCount: number | null;
  candidates: string[];
};

export type AuditSnapshotContext = {
  contentKind?: "mission" | "core" | null;
  title?: unknown;
  learnerLevel?: unknown;
  mode?: unknown;
  speechAct?: unknown;
  speechActText?: unknown;
  languageDirection?: unknown;
};

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function auditTimestamp(record: Record<string, unknown>, fallback: string | null) {
  const provenance = recordValue(record.provenance);
  const generation = recordValue(record.generation);
  return stringValue(provenance?.generated_at)
    ?? stringValue(generation?.generated_at)
    ?? fallback;
}

export function auditSnapshotFromContent(
  content: unknown,
  fallbackCreatedAt: string | null,
  context: AuditSnapshotContext = {},
): AuditSnapshot | null {
  const record = recordValue(content);
  const audit = recordValue(record?.hsk_lexical_audit);
  const status = audit?.status;
  if (status !== "complete" && status !== "not_applicable" && status !== "unavailable") {
    return null;
  }
  const direction = audit.direction === "ko_zh" || audit.direction === "zh_ko"
    ? audit.direction
    : context.languageDirection === "ko_zh" || context.languageDirection === "zh_ko"
      ? context.languageDirection
      : null;
  return {
    status,
    direction,
    createdAt: record ? auditTimestamp(record, fallbackCreatedAt) : fallbackCreatedAt,
    contentKind: context.contentKind === "mission" || context.contentKind === "core"
      ? context.contentKind
      : null,
    title: stringValue(context.title),
    learnerLevel: stringValue(context.learnerLevel),
    mode: stringValue(context.mode),
    speechAct: stringValue(context.speechAct),
    speechActText: stringValue(context.speechActText),
    referenceCeiling: typeof audit.reference_ceiling === "number" ? audit.reference_ceiling : null,
    distinctTokenCount: typeof audit.distinct_token_count === "number" ? audit.distinct_token_count : null,
    matchedTokenCount: typeof audit.matched_token_count === "number" ? audit.matched_token_count : null,
    candidates: Array.isArray(audit.out_of_reference_candidates)
      ? audit.out_of_reference_candidates.filter((item): item is string => typeof item === "string")
      : [],
  };
}

function timestampValue(value: string | null) {
  if (!value) return Number.NEGATIVE_INFINITY;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

export function selectRecentAudit(snapshots: AuditSnapshot[]) {
  const newestFirst = [...snapshots].sort(
    (left, right) => timestampValue(right.createdAt) - timestampValue(left.createdAt),
  );
  return newestFirst.find((item) => item.status === "complete") ?? newestFirst[0] ?? null;
}
