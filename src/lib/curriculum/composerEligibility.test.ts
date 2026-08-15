import { describe, expect, it } from "vitest";

import { isReviewedMission } from "@/lib/curriculum/composerEligibility";

describe("isReviewedMission", () => {
  it("기존 reviewed와 새 게이트의 released만 편성 대상으로 허용한다", () => {
    expect(isReviewedMission({ mission_status: "reviewed", release_gate_mode: "legacy_reviewed" })).toBe(true);
    expect(isReviewedMission({ mission_status: "reviewed", release_gate_mode: "expert_v1" })).toBe(false);
    expect(isReviewedMission({ mission_status: "released", release_gate_mode: "expert_v1" })).toBe(true);
    expect(isReviewedMission({ mission_status: "generated" })).toBe(false);
    expect(isReviewedMission({ mission_status: null })).toBe(false);
    expect(isReviewedMission(undefined)).toBe(false);
  });
});
