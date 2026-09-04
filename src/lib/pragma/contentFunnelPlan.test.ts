import { describe, expect, it } from "vitest";
import {
  COURSE_SLOT_CANDIDATES_PER_SLOT,
  COURSE_SLOT_MANIFEST,
  DIRECTION_MINIMUMS,
  LOCK_COURSE_PRIORITY_CORE_PLAN,
  LOCK_EXPANSION_CORE_PLAN,
  LOCK_FULL_CORE_PLAN,
  LOCK_PILOT_CORE_PLAN,
  VALID_LOCK_CANDIDATE_QUOTAS,
} from "@/lib/pragma/contentFunnelPlan";
import { COURSE_PRESETS } from "@/lib/pragma/scenarioTopics";

describe("Scope Lock 500–60–12–4 manifest", () => {
  it("fixes 20 slots per course and 300 course-priority core candidates", () => {
    expect(COURSE_SLOT_MANIFEST).toHaveLength(60);
    for (const preset of COURSE_PRESETS) {
      expect(COURSE_SLOT_MANIFEST.filter((slot) => slot.outline_id === preset.outline_id)).toHaveLength(20);
    }
    expect(COURSE_SLOT_MANIFEST.length * COURSE_SLOT_CANDIDATES_PER_SLOT).toBe(300);
    expect(LOCK_COURSE_PRIORITY_CORE_PLAN).toHaveLength(300);
    expect(LOCK_EXPANSION_CORE_PLAN).toHaveLength(200);
    expect(LOCK_FULL_CORE_PLAN).toHaveLength(500);
  });

  it("selects a 30-item pilot from stable indexes of the full plan", () => {
    expect(LOCK_PILOT_CORE_PLAN).toHaveLength(30);
    expect(new Set(LOCK_PILOT_CORE_PLAN.map((item) => item.itemIndex)).size).toBe(30);
    expect(LOCK_PILOT_CORE_PLAN.every((item) => LOCK_FULL_CORE_PLAN[item.itemIndex] === item)).toBe(true);
  });

  it("derives the direction and mode floors from the 60-slot manifest", () => {
    expect(DIRECTION_MINIMUMS).toEqual({ ko_zh: 333, zh_ko: 167 });
    expect(VALID_LOCK_CANDIDATE_QUOTAS).toEqual([
      { direction: "ko_zh", mode: "stt_interpreting", minimum: 166 },
      { direction: "ko_zh", mode: "translation", minimum: 167 },
      { direction: "zh_ko", mode: "stt_interpreting", minimum: 33 },
      { direction: "zh_ko", mode: "translation", minimum: 134 },
    ]);
  });

  it("keeps the 13th week as two distinct high-burden missions", () => {
    for (const preset of COURSE_PRESETS) {
      const week13 = COURSE_SLOT_MANIFEST.filter(
        (slot) => slot.outline_id === preset.outline_id && slot.week_no === 13,
      );
      expect(week13.map((slot) => slot.speech_act)).toEqual(["request", "refusal"]);
      expect(new Set(week13.map((slot) => slot.pdr_burden))).toEqual(new Set(["high"]));
      expect(week13.every((slot) => slot.changed_context_axes.length === 0)).toBe(true);
    }
  });

  it("keeps public-course direction and mode constraints in every slot", () => {
    for (const preset of COURSE_PRESETS) {
      const slots = COURSE_SLOT_MANIFEST.filter((slot) => slot.outline_id === preset.outline_id);
      expect(new Set(slots.map((slot) => slot.direction))).toEqual(new Set([preset.language_direction]));
      expect(new Set(slots.map((slot) => slot.mode))).toEqual(
        preset.course_mode === "mixed"
          ? new Set(["translation", "stt_interpreting"])
          : new Set([preset.course_mode === "interpreting" ? "stt_interpreting" : "translation"]),
      );
    }
  });
});
