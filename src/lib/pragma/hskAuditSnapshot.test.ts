import { describe, expect, it } from "vitest";
import {
  auditSnapshotFromContent,
  selectRecentAudit,
} from "./hskAuditSnapshot";

const completeAudit = {
  status: "complete",
  direction: "ko_zh",
  reference_ceiling: 4,
  distinct_token_count: 10,
  matched_token_count: 8,
  out_of_reference_candidates: ["候选"],
};

describe("HSK audit snapshots", () => {
  it("uses the mission generation time instead of the older core row creation time", () => {
    const snapshot = auditSnapshotFromContent({
      provenance: { generated_at: "2026-08-10T08:30:00.000Z" },
      hsk_lexical_audit: completeAudit,
    }, "2026-05-01T00:00:00.000Z");

    expect(snapshot?.createdAt).toBe("2026-08-10T08:30:00.000Z");
  });

  it("uses core generation time and falls back to the database creation time", () => {
    expect(auditSnapshotFromContent({
      generation: { generated_at: "2026-08-09T09:00:00.000Z" },
      hsk_lexical_audit: completeAudit,
    }, "2026-05-01T00:00:00.000Z")?.createdAt).toBe("2026-08-09T09:00:00.000Z");

    expect(auditSnapshotFromContent({
      hsk_lexical_audit: completeAudit,
    }, "2026-05-01T00:00:00.000Z")?.createdAt).toBe("2026-05-01T00:00:00.000Z");
  });

  it("selects the newest complete audit regardless of query row order", () => {
    const older = auditSnapshotFromContent({
      provenance: { generated_at: "2026-08-09T09:00:00.000Z" },
      hsk_lexical_audit: completeAudit,
    }, null);
    const newer = auditSnapshotFromContent({
      provenance: { generated_at: "2026-08-10T09:00:00.000Z" },
      hsk_lexical_audit: { ...completeAudit, matched_token_count: 9 },
    }, null);

    expect(selectRecentAudit([older, newer].filter(Boolean)))
      .toMatchObject({ createdAt: "2026-08-10T09:00:00.000Z", matchedTokenCount: 9 });
  });

  it("keeps the stored content axes needed to explain the audited case", () => {
    const snapshot = auditSnapshotFromContent({
      hsk_lexical_audit: completeAudit,
    }, "2026-08-10T08:30:00.000Z", {
      contentKind: "mission",
      title: "처음 만난 조원에게 감사 인사 전하는 글",
      learnerLevel: "beginner_intermediate",
      mode: "translation",
      speechAct: "thanks",
      speechActText: "감사",
      languageDirection: "ko_zh",
    });

    expect(snapshot).toMatchObject({
      contentKind: "mission",
      title: "처음 만난 조원에게 감사 인사 전하는 글",
      learnerLevel: "beginner_intermediate",
      mode: "translation",
      speechAct: "thanks",
      speechActText: "감사",
      direction: "ko_zh",
    });
  });
});
