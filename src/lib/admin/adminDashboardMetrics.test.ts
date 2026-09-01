import { describe, expect, it } from "vitest";

import {
  DASHBOARD_REVIEW_CRITERIA_VERSION,
  dominantDashboardReviewStage,
  isDashboardReviewTarget,
  nextDashboardReviewStage,
  summarizeDashboardAssignments,
  summarizeDashboardContent,
  summarizeDashboardReviewStages,
  type DashboardReviewRunRow,
  type DashboardScenarioRow,
} from "@/lib/admin/adminDashboardMetrics";

const mission = (
  id: string,
  patch: Partial<DashboardScenarioRow> = {},
): DashboardScenarioRow => ({
  scenario_id: id,
  content_format: "scenario_core_v1",
  review_status: "needs_review",
  mission_status: "generated",
  mission_schema_version: "mission_v5",
  authoring_stage: null,
  updated_at: "2026-09-01T09:00:00.000Z",
  ...patch,
});

const run = (
  targetId: string,
  patch: Partial<DashboardReviewRunRow> = {},
): DashboardReviewRunRow => ({
  target_id: targetId,
  kind: "mission",
  criteria_version: DASHBOARD_REVIEW_CRITERIA_VERSION,
  rules: { verdict: "pass" },
  openai_review: null,
  claude_review: null,
  adjudication: null,
  approved_at: null,
  created_at: "2026-09-01T10:00:00.000Z",
  ...patch,
});

describe("admin dashboard metrics", () => {
  it("separates cores, generated missions, review targets, and five-stage finalization", () => {
    const rows = [
      mission("core-only", { mission_status: null, mission_schema_version: null }),
      mission("pending"),
      mission("revision", { review_status: "revise_required" }),
      mission("finalized", {
        mission_status: "reviewed",
        authoring_stage: "professor_finalized",
      }),
      mission("legacy-reviewed", {
        mission_status: "reviewed",
        authoring_stage: "legacy",
      }),
      mission("legacy-format", { content_format: "legacy_v1" }),
    ];

    expect(summarizeDashboardContent(rows)).toEqual({
      coreCount: 5,
      generatedMissionCount: 4,
      reviewTargetCount: 1,
      professorFinalizedCount: 1,
    });
    expect(isDashboardReviewTarget(rows[1])).toBe(true);
    expect(isDashboardReviewTarget(rows[2])).toBe(false);
  });

  it("places each review target in exactly one next-action stage", () => {
    const rows = ["rules", "rule-fail", "openai", "claude", "adjudication", "professor"]
      .map((id) => mission(id));
    const runs = [
      run("rule-fail", { rules: { verdict: "fail" } }),
      run("openai"),
      run("claude", { openai_review: { result: {} } }),
      run("adjudication", { openai_review: { result: {} }, claude_review: { result: {} } }),
      run("professor", {
        openai_review: { result: {} },
        claude_review: { result: {} },
        adjudication: { result: {} },
      }),
    ];

    const counts = summarizeDashboardReviewStages(rows, runs);
    expect(counts).toEqual({ rules: 2, openai: 1, claude: 1, adjudication: 1, professor: 1 });
    expect(Object.values(counts).reduce((sum, value) => sum + value, 0)).toBe(rows.length);
    expect(dominantDashboardReviewStage(counts)).toBe("rules");
    expect(dominantDashboardReviewStage({ rules: 0, openai: 0, claude: 0, adjudication: 0, professor: 0 })).toBeNull();
  });

  it("returns edited content to R inspection instead of reusing a stale run", () => {
    const row = mission("edited", {
      updated_at: "2026-09-01T11:00:00.000Z",
    });
    const stale = run("edited", {
      created_at: "2026-09-01T10:00:00.000Z",
      openai_review: { result: {} },
      claude_review: { result: {} },
      adjudication: { result: {} },
    });
    expect(nextDashboardReviewStage(row, [stale])).toBe("rules");
  });

  it("counts assignment rows, distinct missions, and distinct course weeks separately", () => {
    expect(summarizeDashboardAssignments([
      { outline_id: "a", week_no: 1, scenario_id: "m1" },
      { outline_id: "a", week_no: 1, scenario_id: "m2" },
      { outline_id: "a", week_no: 2, scenario_id: "m1" },
      { outline_id: "b", week_no: 1, scenario_id: "m3" },
    ])).toEqual({ assignmentCount: 4, missionCount: 3, weekCount: 3 });
  });
});
