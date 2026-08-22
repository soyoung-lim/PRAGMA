import { describe, expect, it } from "vitest";

import {
  canRevealFixReview,
  canSubmitFixChoice,
  canSubmitMultiJudge,
  canSubmitRevision,
  deriveRevisionRecheck,
  isSubstantiveRevision,
} from "@/lib/mission/missionFlow";
import type { RuntimeFeedback } from "@/lib/pragma/feedbackSchema";

const feedback = (overrides: Partial<RuntimeFeedback["verdicts"]> = {}): RuntimeFeedback => ({
  schema_version: "feedback_v1",
  rubric_version: "request@1",
  verdicts: {
    semantic_fidelity: "preserved",
    grammatical_accuracy: "clean",
    pragmatic_appropriateness: { feature_code: "request", band_code: "within_band" },
    ...overrides,
  },
  revision_scope: "clear",
  blocks: { meaning_ko: "뜻 유지", grammar: [], feature_ko: "적정", alternatives: [] },
  uncertainty_flags: [],
  provenance: { model: "test", prompt_version: "feedback_v1", generated_at: "2026-08-17T00:00:00Z" },
});

describe("mission_v6 learner gates", () => {
  it("requires exactly two FixChoice corrections", () => {
    expect(canSubmitFixChoice(new Set([0]))).toBe(false);
    expect(canSubmitFixChoice(new Set([0, 2]))).toBe(true);
    expect(canSubmitFixChoice(new Set([0, 1, 2]))).toBe(false);
  });

  it("keeps FixReview feedback hidden until both responses exist", () => {
    expect(canRevealFixReview("c3", null)).toBe(false);
    expect(canRevealFixReview(null, "r2")).toBe(false);
    expect(canRevealFixReview("c3", "r2")).toBe(true);
  });

  it("requires all four MultiJudge classifications", () => {
    expect(canSubmitMultiJudge(4, { 0: "under", 1: "within", 2: "within" })).toBe(false);
    expect(canSubmitMultiJudge(4, { 0: "under", 1: "within", 2: "within", 3: "over" })).toBe(true);
  });

  it("rejects whitespace and punctuation-only revision", () => {
    expect(isSubstantiveRevision("可以发给我吗？", " 可以发给我吗! ")).toBe(false);
    expect(isSubstantiveRevision("可以发给我吗？", "方便的话，可以发给我吗？")).toBe(true);
    expect(canSubmitRevision({
      scope: "feature",
      decision: "keep",
      first: "原句",
      revised: "原句",
      retentionReason: "",
      hasDissent: false,
    })).toBe(false);
  });

  it("stores a one-scan lightweight recheck result", () => {
    const result = deriveRevisionRecheck("feature", feedback(), "within_band", "2026-08-17T00:00:00Z");
    expect(result).toMatchObject({ status: "reflected", target_reflected: true, scan_count: 1 });
    const newProblem = deriveRevisionRecheck("feature", feedback({
      semantic_fidelity: "minor_loss",
    }), "within_band");
    expect(newProblem.status).toBe("new_problem");
    expect(newProblem.meaning_status).toBe("new_problem");
    expect(newProblem.new_problem_dimensions).toEqual(["meaning"]);
    const meaningStillNeedsWork = deriveRevisionRecheck("meaning", feedback({
      semantic_fidelity: "minor_loss",
    }), "within_band");
    expect(meaningStillNeedsWork).toMatchObject({
      status: "partial",
      meaning_status: "target_not_yet_reflected",
    });
  });
});
