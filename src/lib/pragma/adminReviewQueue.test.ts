import { describe, expect, it } from "vitest";
import {
  isRapidReviewCandidate,
  missionQualityVerdict,
  promptMatchOf,
  rapidReviewBlockers,
  rapidReviewCandidateIds,
  type ReviewQueueFacts,
} from "@/lib/pragma/adminReviewQueue";

const CURRENT_HASH = "current-hash";

function row(overrides: Partial<ReviewQueueFacts> = {}): ReviewQueueFacts {
  return {
    scenario_id: "scenario-1",
    mission_status: "generated",
    auto_check_result: "pass",
    mission_content: {
      schema_version: "mission_v1",
      quality_check: { verdict: "pass" },
    },
    generation_run_id: "run-1",
    prompt_snapshot_hash: CURRENT_HASH,
    target_feature: "request.mitigation",
    target_feature_version: "v1",
    ...overrides,
  };
}

describe("admin rapid review queue", () => {
  it("reads only supported AI quality verdicts", () => {
    expect(missionQualityVerdict(row().mission_content)).toBe("pass");
    expect(missionQualityVerdict({ quality_check: { verdict: "maybe" } })).toBe("missing");
    expect(missionQualityVerdict(null)).toBe("missing");
  });

  it("distinguishes current, different, and missing prompt hashes", () => {
    expect(promptMatchOf(CURRENT_HASH, CURRENT_HASH)).toBe("current");
    expect(promptMatchOf("old-hash", CURRENT_HASH)).toBe("different");
    expect(promptMatchOf(null, CURRENT_HASH)).toBe("missing");
  });

  it("accepts only a fully traceable generated mission as a rapid-review candidate", () => {
    expect(isRapidReviewCandidate(row(), CURRENT_HASH)).toBe(true);
    expect(rapidReviewBlockers(row(), CURRENT_HASH)).toEqual([]);
  });

  it("blocks warnings, prompt mismatches, and missing provenance", () => {
    const blocked = row({
      auto_check_result: "warning",
      mission_content: { quality_check: { verdict: "warning" } },
      generation_run_id: null,
      prompt_snapshot_hash: "old-hash",
      target_feature_version: null,
    });

    expect(isRapidReviewCandidate(blocked, CURRENT_HASH)).toBe(false);
    expect(rapidReviewBlockers(blocked, CURRENT_HASH)).toEqual([
      "core_rule_not_pass",
      "ai_quality_not_pass",
      "run_missing",
      "prompt_mismatch",
      "feature_missing",
    ]);
  });

  it("caps batch selection and preserves queue order", () => {
    const rows = Array.from({ length: 30 }, (_, index) =>
      row({ scenario_id: `scenario-${index + 1}` }),
    );

    expect(rapidReviewCandidateIds(rows, CURRENT_HASH)).toHaveLength(25);
    expect(rapidReviewCandidateIds(rows, CURRENT_HASH, 2)).toEqual([
      "scenario-1",
      "scenario-2",
    ]);
  });
});
