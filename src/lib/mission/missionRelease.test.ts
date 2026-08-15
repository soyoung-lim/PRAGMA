import { describe, expect, it } from "vitest";

import { isMissionReleasedForLearner } from "./missionRelease";

describe("mission learner release state", () => {
  it("allows authoritative released missions", () => {
    expect(isMissionReleasedForLearner({ mission_status: "released", release_gate_mode: "expert_v1" })).toBe(true);
  });

  it("blocks covered missions that have only internal review", () => {
    expect(isMissionReleasedForLearner({ mission_status: "reviewed", release_gate_mode: "expert_v1" })).toBe(false);
  });

  it("preserves reviewed behavior for legacy rows", () => {
    expect(isMissionReleasedForLearner({ mission_status: "reviewed", release_gate_mode: "legacy_reviewed" })).toBe(true);
    expect(isMissionReleasedForLearner({ mission_status: "reviewed" })).toBe(true);
  });
});
