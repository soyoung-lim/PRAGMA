import { describe, expect, it } from "vitest";

import { ERROR_PATTERNS } from "./errorPatterns";
import {
  KO_ZH_CORE_REALIZATION_PACK,
  RealizationPackSchema,
  evidenceById,
  realizationResourceLabelsForFeature,
} from "./realizationPack";
import { TARGET_FEATURES } from "./targetFeatures";

const CORE_FEATURES = [
  "request_mitigation_optionality",
  "refusal_softening",
  "gratitude_calibration",
] as const;

describe("ko→zh realization pack v1", () => {
  it("passes the versioned machine-readable schema", () => {
    expect(RealizationPackSchema.safeParse(KO_ZH_CORE_REALIZATION_PACK).success).toBe(true);
  });

  it("keeps rule, risk, and evidence identifiers unique and resolvable", () => {
    const ruleIds = KO_ZH_CORE_REALIZATION_PACK.resources.map((item) => item.rule_id);
    const riskIds = KO_ZH_CORE_REALIZATION_PACK.risks.map((item) => item.risk_id);
    const evidenceIds = KO_ZH_CORE_REALIZATION_PACK.evidence.map((item) => item.evidence_id);

    expect(new Set(ruleIds).size).toBe(ruleIds.length);
    expect(new Set(riskIds).size).toBe(riskIds.length);
    expect(new Set(evidenceIds).size).toBe(evidenceIds.length);

    for (const resource of KO_ZH_CORE_REALIZATION_PACK.resources) {
      for (const evidenceId of resource.evidence_ids) {
        expect(evidenceById(evidenceId), `${resource.rule_id} → ${evidenceId}`).toBeDefined();
      }
    }
    for (const risk of KO_ZH_CORE_REALIZATION_PACK.risks) {
      for (const evidenceId of risk.evidence_ids) {
        expect(evidenceById(evidenceId), `${risk.risk_id} → ${evidenceId}`).toBeDefined();
      }
    }
  });

  it("makes the pack the prompt-resource source of truth for the three seed features", () => {
    for (const featureCode of CORE_FEATURES) {
      const labels = realizationResourceLabelsForFeature(featureCode);
      expect(labels.length, featureCode).toBeGreaterThanOrEqual(4);
      expect(TARGET_FEATURES[featureCode].relevant_resources).toEqual(labels);
      expect(
        KO_ZH_CORE_REALIZATION_PACK.risks.some((risk) =>
          risk.target_features.includes(featureCode),
        ),
        `${featureCode} risk coverage`,
      ).toBe(true);
    }
  });

  it("keeps content seed status separate from source-level literature verification", () => {
    expect(KO_ZH_CORE_REALIZATION_PACK.status).toBe("seed");
    for (const item of [
      ...KO_ZH_CORE_REALIZATION_PACK.resources,
      ...KO_ZH_CORE_REALIZATION_PACK.risks,
    ]) {
      expect(item.review.status).toBe("researcher_seed");
      expect(item.review.reviewer_ids).toEqual([]);
      expect(item.review.reviewed_at).toBeNull();
    }
    for (const evidence of KO_ZH_CORE_REALIZATION_PACK.evidence) {
      expect(evidence.lifecycle_status).toBe("active");
      expect(evidence.superseded_by_evidence_id).toBeNull();
      if (evidence.source_kind === "literature") {
        expect(evidence.verification_status).toBe("source_verified");
        expect(evidence.citation_key).toBeTruthy();
        expect(evidence.source_locator).toBeTruthy();
      }
    }
  });

  it("rejects a verified literature claim without a source locator", () => {
    const invalid = structuredClone(KO_ZH_CORE_REALIZATION_PACK);
    invalid.evidence[0].source_locator = null;
    expect(RealizationPackSchema.safeParse(invalid).success).toBe(false);
  });

  it("preserves replaced evidence through an explicit lifecycle link", () => {
    const invalid = structuredClone(KO_ZH_CORE_REALIZATION_PACK);
    invalid.evidence[0].lifecycle_status = "superseded";
    invalid.evidence[0].lifecycle_note_ko = "후속 연구로 교체";
    expect(RealizationPackSchema.safeParse(invalid).success).toBe(false);

    invalid.evidence[0].superseded_by_evidence_id = invalid.evidence[1].evidence_id;
    expect(RealizationPackSchema.safeParse(invalid).success).toBe(true);
  });

  it("derives the legacy prompt error seeds from the same risk catalog", () => {
    expect(ERROR_PATTERNS.map((pattern) => pattern.patternId)).toEqual(
      KO_ZH_CORE_REALIZATION_PACK.risks.map((risk) => risk.risk_id),
    );
    expect(ERROR_PATTERNS.find((pattern) => pattern.patternId === "learner_verbosity")?.applicableSpeechActs)
      .toContain("apology");
    expect(ERROR_PATTERNS.find((pattern) => pattern.patternId === "hanja_interference")?.applicableSpeechActs)
      .toBeUndefined();
  });
});
