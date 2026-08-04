import { describe, expect, it } from "vitest";

import { buildContentCanaryPlan } from "@/lib/pragma/contentCanaryPlan";

describe("content refresh canary plan", () => {
  it("keeps the release sample small and covers both directions and modes", () => {
    const cells = buildContentCanaryPlan();

    expect(cells).toHaveLength(6);
    expect(new Set(cells.map((cell) => cell.direction))).toEqual(new Set(["ko_zh", "zh_ko"]));
    expect(new Set(cells.map((cell) => cell.mode))).toEqual(
      new Set(["translation", "stt_interpreting"]),
    );
    expect(cells.some((cell) => cell.speech_act_ui === "refusal")).toBe(true);
    expect(cells.some((cell) => cell.pdr_burden === "high")).toBe(true);
    expect(cells.some((cell) => cell.pdr_distance === "formal")).toBe(true);
    expect(cells.some((cell) => cell.pdr_power !== "equal")).toBe(true);
    expect(cells.every((cell) => cell.count === 1)).toBe(true);
  });

  it("is deterministic", () => {
    expect(buildContentCanaryPlan()).toEqual(buildContentCanaryPlan());
  });
});
