import { describe, expect, it } from "vitest";

import {
  DEFAULT_FEATURE_BY_ACT,
  SCALE4_CODES,
  SCALE4_LABELS,
  TARGET_FEATURES,
} from "./targetFeatures";

describe("target feature catalog integrity", () => {
  it("keeps record keys, feature codes, bands, and within-band references consistent", () => {
    const entries = Object.entries(TARGET_FEATURES);
    expect(entries.length).toBeGreaterThan(0);

    for (const [key, feature] of entries) {
      expect(feature.code).toBe(key);
      expect(feature.version.trim()).not.toBe("");
      expect(feature.learner_label.trim()).not.toBe("");
      expect(feature.operational_definition.trim()).not.toBe("");
      expect(feature.closing_principle_ko.trim()).not.toBe("");
      expect(feature.counter_rule_note.trim()).not.toBe("");
      expect(feature.relevant_resources.length).toBeGreaterThan(0);
      expect(feature.excluded_confounds.length).toBeGreaterThan(0);

      const bandCodes = feature.band_schema.map((band) => band.code);
      expect(new Set(bandCodes).size).toBe(bandCodes.length);
      expect(bandCodes).toContain(feature.within_band_code);
      expect(feature.band_schema.filter((band) => band.code === feature.within_band_code))
        .toHaveLength(1);
      for (const band of feature.band_schema) {
        expect(band.code.trim()).not.toBe("");
        expect(band.label_ko.trim()).not.toBe("");
      }
    }
  });

  it("keeps every default promotion mapping on the same speech act", () => {
    for (const [act, featureCode] of Object.entries(DEFAULT_FEATURE_BY_ACT)) {
      const feature = TARGET_FEATURES[featureCode];
      expect(feature, `${act} → ${featureCode}`).toBeDefined();
      expect(feature.speech_act).toBe(act);
    }
  });

  it("keeps every bidirectional promotion feature complete", () => {
    for (const featureCode of Object.values(DEFAULT_FEATURE_BY_ACT)) {
      const feature = TARGET_FEATURES[featureCode];
      expect(feature.operational_definition_zh_ko?.trim(), featureCode).toBeTruthy();
      expect(feature.relevant_resources_zh_ko?.length, featureCode).toBeGreaterThan(0);
      expect(feature.excluded_confounds_zh_ko?.length, featureCode).toBeGreaterThan(0);
      expect(feature.counter_rule_note_zh_ko?.trim(), featureCode).toBeTruthy();
    }
  });

  it("keeps the shared four-point scale labels complete", () => {
    expect(new Set(SCALE4_CODES).size).toBe(SCALE4_CODES.length);
    for (const code of SCALE4_CODES) {
      expect(SCALE4_LABELS[code].trim()).not.toBe("");
    }
  });
});
