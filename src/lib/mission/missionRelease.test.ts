import { describe, expect, it } from "vitest";

import { CURRENT_CONTENT_RELEASE_ID } from "../../../supabase/functions/_shared/contentRelease";
import { isCurrentMissionReleasedForLearner, isMissionReleasedForLearner } from "./missionRelease";

describe("mission learner release state", () => {
  it("allows authoritative released missions", () => {
    expect(isMissionReleasedForLearner({ mission_status: "released", release_gate_mode: "expert_v1" })).toBe(true);
  });

  it("uses professor-reviewed as the current release endpoint", () => {
    expect(isMissionReleasedForLearner({ mission_status: "reviewed", release_gate_mode: "expert_v1" })).toBe(true);
  });

  it("preserves reviewed behavior for legacy rows", () => {
    expect(isMissionReleasedForLearner({ mission_status: "reviewed", release_gate_mode: "legacy_reviewed" })).toBe(true);
    expect(isMissionReleasedForLearner({ mission_status: "reviewed" })).toBe(true);
  });

  it("excludes pre-lock content from current course composition and learner use", () => {
    expect(isCurrentMissionReleasedForLearner({
      mission_status: "reviewed",
      content_release_id: CURRENT_CONTENT_RELEASE_ID,
    })).toBe(true);
    expect(isCurrentMissionReleasedForLearner({
      mission_status: "released",
      content_release_id: "pre_lock_release",
    })).toBe(false);
    expect(isCurrentMissionReleasedForLearner({ mission_status: "reviewed" })).toBe(false);
  });
});
