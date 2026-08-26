import { describe, expect, it } from "vitest";

import {
  INSTRUCTOR_GUIDE_TIMING_PRESETS,
  instructorGuideTimingPlan,
  instructorGuideTimingTotal,
} from "@/lib/pragma/instructorGuideTiming";

describe("instructor guide timing presets", () => {
  it.each(INSTRUCTOR_GUIDE_TIMING_PRESETS)("keeps the %d-minute plan exact", (preset) => {
    expect(instructorGuideTimingTotal(instructorGuideTimingPlan(preset))).toBe(preset);
  });

  it("uses two complete mission sets for the 90-minute plan", () => {
    const plan = instructorGuideTimingPlan(90);
    expect(plan.labelKo).toContain("두 세트");
    expect(plan.activities.map((activity) => activity.id)).toContain("mission-a");
    expect(plan.activities.map((activity) => activity.id)).toContain("mission-b");
  });
});
