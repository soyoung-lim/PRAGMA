import { describe, expect, it } from "vitest";

import { isReviewedMission } from "@/lib/curriculum/composerEligibility";

describe("isReviewedMission", () => {
  it("DB의 현재 공개 상태와 동일한 편성 조건을 적용한다", () => {
    expect(isReviewedMission({ mission_status: "reviewed", release_gate_mode: "legacy_reviewed" })).toBe(true);
    expect(isReviewedMission({ mission_status: "reviewed", release_gate_mode: "expert_v1" })).toBe(true);
    expect(isReviewedMission({ mission_status: "released", release_gate_mode: "expert_v1" })).toBe(true);
    expect(isReviewedMission({ mission_status: "generated" })).toBe(false);
    expect(isReviewedMission({ mission_status: null })).toBe(false);
    expect(isReviewedMission(undefined)).toBe(false);
  });
});
