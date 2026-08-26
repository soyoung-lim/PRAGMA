import { describe, expect, it } from "vitest";

import { KO_ZH_CORE_REALIZATION_PACK } from "./realizationPack";
import { SEED_GOLD_CASES, SeedGoldCaseSchema } from "./seedGoldSet";
import { TARGET_FEATURES } from "./targetFeatures";

describe("ko→zh seed Gold set", () => {
  it("contains 30 schema-valid researcher seeds balanced across the three acts", () => {
    expect(SEED_GOLD_CASES).toHaveLength(30);
    for (const item of SEED_GOLD_CASES) {
      expect(SeedGoldCaseSchema.safeParse(item).success, item.case_id).toBe(true);
      expect(item.review.status).toBe("researcher_seed");
      expect(item.review.researcher_reviewer_id).toBeNull();
      expect(item.candidates.every((candidate) => candidate.semantic_fidelity === "pending_researcher_review"))
        .toBe(true);
    }

    const counts = SEED_GOLD_CASES.reduce<Record<string, number>>((acc, item) => {
      acc[item.speech_act] = (acc[item.speech_act] ?? 0) + 1;
      return acc;
    }, {});
    expect(counts.request).toBe(10);
    expect(counts.refusal).toBe(10);
    expect(counts.thanks).toBe(10);
  });

  it("keeps case, candidate, and referenced rule identifiers consistent", () => {
    const caseIds = SEED_GOLD_CASES.map((item) => item.case_id);
    expect(new Set(caseIds).size).toBe(caseIds.length);

    const resourceIds = new Set(
      KO_ZH_CORE_REALIZATION_PACK.resources.map((resource) => resource.rule_id),
    );
    const riskIds = new Set(KO_ZH_CORE_REALIZATION_PACK.risks.map((risk) => risk.risk_id));

    for (const item of SEED_GOLD_CASES) {
      const candidateIds = item.candidates.map((candidate) => candidate.candidate_id);
      expect(new Set(candidateIds).size, item.case_id).toBe(candidateIds.length);
      for (const candidate of item.candidates) {
        for (const ref of candidate.references) {
          expect(
            ref.kind === "realization_rule" ? resourceIds.has(ref.id) : riskIds.has(ref.id),
            `${item.case_id}/${candidate.candidate_id} → ${ref.id}`,
          ).toBe(true);
        }
      }
    }
  });

  it("covers each seed feature's three ordered bands in every case", () => {
    for (const item of SEED_GOLD_CASES) {
      const feature = TARGET_FEATURES[item.target_feature];
      expect(feature, item.case_id).toBeDefined();
      expect(feature.speech_act).toBe(item.speech_act);
      const expectedBands = feature.band_schema.map((band) => band.code).sort();
      const actualBands = item.candidates.map((candidate) => candidate.expected_band_code).sort();
      expect(actualBands, item.case_id).toEqual(expectedBands);
    }
  });

  it("covers levels, domains, P/D/R values, and both task modes", () => {
    const values = {
      levels: new Set(SEED_GOLD_CASES.map((item) => item.level)),
      domains: new Set(SEED_GOLD_CASES.map((item) => item.domain)),
      powers: new Set(SEED_GOLD_CASES.map((item) => item.pdr.power)),
      distances: new Set(SEED_GOLD_CASES.map((item) => item.pdr.distance)),
      burdens: new Set(SEED_GOLD_CASES.map((item) => item.pdr.burden)),
      modes: new Set(SEED_GOLD_CASES.map((item) => item.mode)),
    };
    expect(values.levels).toEqual(new Set(["beginner_intermediate", "intermediate", "advanced"]));
    expect(values.domains).toEqual(new Set(["daily", "school", "work"]));
    expect(values.powers).toEqual(new Set(["higher", "equal", "lower"]));
    expect(values.distances).toEqual(new Set(["close", "acquaintance", "formal"]));
    expect(values.burdens).toEqual(new Set(["low", "mid", "high"]));
    expect(values.modes).toEqual(new Set(["translation", "stt_interpreting"]));
  });

  it("rejects cross-act rule references and an invalid three-band composition", () => {
    const wrongRule = structuredClone(SEED_GOLD_CASES[0]);
    wrongRule.candidates[0].references = [{
      kind: "realization_rule",
      id: "RR-KOZH-REF-ALTERNATIVE",
      relation: "uses",
    }];
    expect(SeedGoldCaseSchema.safeParse(wrongRule).success).toBe(false);

    const duplicateBand = structuredClone(SEED_GOLD_CASES[0]);
    duplicateBand.candidates[0].expected_band_code = "too_direct";
    expect(SeedGoldCaseSchema.safeParse(duplicateBand).success).toBe(false);
  });
});
