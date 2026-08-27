import { describe, expect, it } from "vitest";

import {
  ENGINEERING_SEED_GATE,
  RESEARCHER_RELEASE_GATE,
  observationsFromExpectedLabels,
  runGoldRegression,
} from "./goldRegression";
import { SEED_GOLD_CASES } from "./seedGoldSet";

describe("Gold regression harness", () => {
  it("passes band-only engineering calibration without pretending seed semantics are approved", () => {
    const observations = observationsFromExpectedLabels(SEED_GOLD_CASES, ["researcher_seed"]);
    const report = runGoldRegression(SEED_GOLD_CASES, observations, ENGINEERING_SEED_GATE);

    expect(report.mode).toBe("engineering_seed");
    expect(report.gate_status).toBe("pass");
    expect(report.eligible_case_count).toBe(30);
    expect(report.expected_observation_count).toBe(90);
    expect(report.band_accuracy).toBe(1);
    expect(report.expected_semantic_observation_count).toBe(0);
    expect(report.semantic_accuracy).toBeNull();
    expect(report.mismatches).toEqual([]);
  });

  it("does not silently treat unapproved seeds as a researcher-confirmed release benchmark", () => {
    const observations = observationsFromExpectedLabels(SEED_GOLD_CASES, ["researcher_seed"]);
    const report = runGoldRegression(SEED_GOLD_CASES, observations, RESEARCHER_RELEASE_GATE);

    expect(report.mode).toBe("researcher_gate");
    expect(report.gate_status).toBe("not_runnable");
    expect(report.eligible_case_count).toBe(0);
    expect(report.band_accuracy).toBeNull();
  });

  it("fails on label drift, missing coverage, duplicates, and unknown observations", () => {
    const observations = observationsFromExpectedLabels(SEED_GOLD_CASES, ["researcher_seed"]);
    const first = observations[0];
    const mutated = [
      { ...first, predicted_band_code: "wrong_band" },
      ...observations.slice(2),
      { ...observations[2] },
      {
        case_id: "UNKNOWN",
        candidate_id: "A",
        predicted_band_code: "within_band",
        predicted_semantic_fidelity: "pass" as const,
      },
    ];
    const report = runGoldRegression(SEED_GOLD_CASES, mutated, ENGINEERING_SEED_GATE);

    expect(report.gate_status).toBe("fail");
    expect(report.missing_observation_keys).toContain(
      `${observations[1].case_id}::${observations[1].candidate_id}`,
    );
    expect(report.duplicate_observation_keys).toHaveLength(1);
    expect(report.unknown_observation_keys).toEqual(["UNKNOWN::A"]);
    expect(report.mismatches).toContainEqual(
      expect.objectContaining({ field: "band", actual: "wrong_band" }),
    );
  });
});
