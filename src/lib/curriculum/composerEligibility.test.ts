import { describe, expect, it } from "vitest";

import { isReviewedMission } from "@/lib/curriculum/composerEligibility";

describe("isReviewedMission", () => {
  it("검토 완료 미션만 편성 대상으로 허용한다", () => {
    expect(isReviewedMission({ mission_status: "reviewed" })).toBe(true);
    expect(isReviewedMission({ mission_status: "generated" })).toBe(false);
    expect(isReviewedMission({ mission_status: null })).toBe(false);
    expect(isReviewedMission(undefined)).toBe(false);
  });
});
