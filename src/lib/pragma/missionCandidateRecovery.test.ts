import { describe, expect, it } from "vitest";

import {
  candidateRegenerationMax,
  candidateRegenerationTotal,
  canonicalCandidatePath,
  normalizeCandidateRegenerationCounts,
  planCandidateFallback,
  recordCandidateRegeneration,
} from "../../../supabase/functions/_shared/missionCandidateRecovery";

describe("candidate recovery budget", () => {
  it("selects only missing candidates and preserves realized peers", () => {
    const plan = planCandidateFallback(
      [
        "mpj_items[2].corrections[1]",
        "mpj_items[2].corrections[2]",
        "mpj_items[4].candidates[1]",
        "mpj_items[4].candidates[3]",
      ],
      [
        "mpj_items[2].corrections[1]",
        "mpj_items[4].candidates[1]",
        "mpj_items[4].candidates[3]",
      ],
      {},
    );

    expect(plan).toEqual({
      missingPaths: ["mpj_items[2].corrections[2]"],
      eligiblePaths: ["mpj_items[2].corrections[2]"],
      exhaustedPaths: [],
    });
  });

  it("shares one candidate-level budget across fallback and later recovery", () => {
    const counts = recordCandidateRegeneration({}, ["mpj_items[4].candidates[3].text"]);
    const plan = planCandidateFallback(
      ["mpj_items[4].candidates[3]"],
      [],
      counts,
    );

    expect(plan.eligiblePaths).toEqual([]);
    expect(plan.exhaustedPaths).toEqual(["mpj_items[4].candidates[3]"]);
    expect(candidateRegenerationTotal(counts)).toBe(1);
    expect(candidateRegenerationMax(counts)).toBe(1);
  });

  it("normalizes only supported candidate paths and clamps counts", () => {
    expect(canonicalCandidatePath("mpj_items[2].corrections[1].text")).toBe(
      "mpj_items[2].corrections[1]",
    );
    expect(normalizeCandidateRegenerationCounts({
      "mpj_items[2].corrections[1].text": 3,
      "mpj_items[1].target": 1,
      "mpj_items[4].candidates[3]": -2,
    })).toEqual({
      "mpj_items[2].corrections[1]": 3,
      "mpj_items[4].candidates[3]": 0,
    });
  });
});
