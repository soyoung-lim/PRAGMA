import { describe, expect, it } from "vitest";

import {
  INSTRUCTOR_GUIDE_TIMING_PRESETS,
  instructorGuideSequencePath,
  instructorGuideTimingPlan,
  instructorGuideTimingTotal,
  isCompatibleInstructorGuideSecondary,
  parseInstructorGuideTimingPreset,
} from "@/lib/pragma/instructorGuideTiming";

describe("instructor guide timing presets", () => {
  it.each(INSTRUCTOR_GUIDE_TIMING_PRESETS)("keeps the %d-minute plan exact", (preset) => {
    expect(instructorGuideTimingTotal(instructorGuideTimingPlan(preset))).toBe(preset);
  });

  it("uses two complete mission sets for the 90-minute plan", () => {
    const plan = instructorGuideTimingPlan(90);
    expect(plan.labelKo).toContain("두 미션");
    expect(plan.activities.map((activity) => activity.id)).toContain("mission-a");
    expect(plan.activities.map((activity) => activity.id)).toContain("mission-b");
    expect(plan.activities.find((activity) => activity.id === "compare")?.labelKo).not.toContain("최소대조");
  });

  it("accepts only a distinct mission with the same course identity", () => {
    const first = { scenarioId: "a", speechAct: "request", learnerLevel: "intermediate", mode: "translation", direction: "ko_zh" };
    expect(isCompatibleInstructorGuideSecondary(first, { ...first, scenarioId: "b" })).toBe(true);
    expect(isCompatibleInstructorGuideSecondary(first, { ...first, scenarioId: "b", mode: "stt_interpreting" })).toBe(false);
    expect(isCompatibleInstructorGuideSecondary(first, first)).toBe(false);
  });

  it("builds and parses the 90-minute two-mission deep link", () => {
    expect(instructorGuideSequencePath("mission-a", "mission-b")).toBe(
      "/admin/package?mission=mission-a&mission2=mission-b&timing=90",
    );
    expect(parseInstructorGuideTimingPreset("90")).toBe(90);
    expect(parseInstructorGuideTimingPreset("unknown")).toBe(30);
  });
});
