import { describe, expect, it } from "vitest";

import {
  buildContentCanaryPlan,
  buildInterpreterRoleCanaryPlan,
} from "@/lib/pragma/contentCanaryPlan";

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

  it("builds an interpreter-only 9-act sample in both directions", () => {
    const cells = buildInterpreterRoleCanaryPlan();
    const acts = [
      "request",
      "refusal",
      "apology",
      "thanks",
      "proposal",
      "agreement",
      "opposition",
      "compliment",
      "complaint",
    ];

    expect(cells).toHaveLength(18);
    expect(cells.every((cell) => cell.mode === "stt_interpreting")).toBe(true);
    expect(cells.every((cell) => cell.count === 1)).toBe(true);
    for (const direction of ["ko_zh", "zh_ko"] as const) {
      const directionCells = cells.filter((cell) => cell.direction === direction);
      expect(directionCells).toHaveLength(9);
      expect(new Set(directionCells.map((cell) => cell.speech_act_ui))).toEqual(new Set(acts));
    }
    expect(new Set(cells.map((cell) => cell.level)).size).toBeGreaterThan(1);
    expect(new Set(cells.map((cell) => cell.pdr_power)).size).toBeGreaterThan(1);
    expect(new Set(cells.map((cell) => cell.pdr_distance)).size).toBeGreaterThan(1);
    expect(new Set(cells.map((cell) => cell.pdr_burden)).size).toBeGreaterThan(1);
  });

  it("builds the interpreter role sample deterministically", () => {
    expect(buildInterpreterRoleCanaryPlan()).toEqual(buildInterpreterRoleCanaryPlan());
  });
});
