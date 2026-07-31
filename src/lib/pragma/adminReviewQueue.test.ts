import { describe, expect, it } from "vitest";
import {
  CURRENT_MISSION_PROMPT_VERSIONS,
  isRapidReviewCandidate,
  missionPromptVersionOf,
  missionQualityVerdict,
  promptMatchOf,
  rapidReviewBlockers,
  rapidReviewCandidateIds,
  type ReviewQueueFacts,
} from "@/lib/pragma/adminReviewQueue";

const CURRENT_HASH = "current-hash";
const CURRENT_MISSION_PROMPT = CURRENT_MISSION_PROMPT_VERSIONS[0];

function row(overrides: Partial<ReviewQueueFacts> = {}): ReviewQueueFacts {
  return {
    scenario_id: "scenario-1",
    mission_status: "generated",
    auto_check_result: "pass",
    mission_content: {
      schema_version: "mission_v1",
      quality_check: { verdict: "pass" },
      provenance: { prompt_version: CURRENT_MISSION_PROMPT },
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
      "mission_prompt_missing",
      "feature_missing",
    ]);
  });

  it("reads the mission prompt version from provenance", () => {
    expect(missionPromptVersionOf(row().mission_content)).toBe(CURRENT_MISSION_PROMPT);
    expect(missionPromptVersionOf({ provenance: {} })).toBeNull();
    expect(missionPromptVersionOf({ provenance: { prompt_version: "" } })).toBeNull();
    expect(missionPromptVersionOf(null)).toBeNull();
  });

  // 코어 지문은 미션 프롬프트 개정을 반영하지 않는다. 구버전 프롬프트로 만든 미션은
  // 코어 지문이 같더라도 자동 선택에서 빠져야 한다(DEC-20260731-02: baseline reviewed 금지).
  it("blocks missions built by a superseded mission prompt", () => {
    const stale = row({
      mission_content: {
        quality_check: { verdict: "pass" },
        provenance: { prompt_version: "mission_v5_mpj4_minidiscourse_v2" },
      },
    });

    expect(rapidReviewBlockers(stale, CURRENT_HASH)).toEqual(["mission_prompt_mismatch"]);
    expect(isRapidReviewCandidate(stale, CURRENT_HASH)).toBe(false);
    expect(
      rapidReviewCandidateIds([stale, row({ scenario_id: "scenario-2" })], CURRENT_HASH),
    ).toEqual(["scenario-2"]);
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
