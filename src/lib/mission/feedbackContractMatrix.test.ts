import { describe, expect, it } from "vitest";

import { normalizeFeedbackResponse } from "./normalizeFeedback";
import { TARGET_FEATURES, type TargetFeature } from "@/lib/pragma/targetFeatures";

function rawFeedback(feature: TargetFeature, bandCode = feature.within_band_code) {
  return {
    verdicts: {
      semantic_fidelity: "preserved",
      grammatical_accuracy: "clean",
      pragmatic_appropriateness: {
        feature_code: feature.code,
        band_code: bandCode,
      },
    },
    blocks: {
      meaning_ko: "원문의 핵심 뜻이 유지되었습니다.",
      grammar: [],
      feature_ko: "이 상황에서 상대에게 알맞은 인상으로 들릴 수 있습니다.",
      alternatives: [],
    },
    uncertainty_flags: [],
    revision_scope: "meaning",
  };
}

describe("feedback-lite catalog contract matrix", () => {
  it("accepts every catalog band and derives scope instead of trusting the model", () => {
    for (const feature of Object.values(TARGET_FEATURES)) {
      for (const band of feature.band_schema) {
        const result = normalizeFeedbackResponse(rawFeedback(feature, band.code), "학습자 답안", feature);

        expect(result.ok, `${feature.code}/${band.code}`).toBe(true);
        if (!result.ok) continue;
        expect(result.feedback.revision_scope).toBe(
          band.code === feature.within_band_code ? "clear" : "feature",
        );
      }
    }
  });

  it("rejects issue verdicts whose primary learner guidance is blank", () => {
    const feature = TARGET_FEATURES.request_mitigation_optionality;

    const missingMeaning = rawFeedback(feature);
    missingMeaning.verdicts.semantic_fidelity = "minor_loss";
    missingMeaning.blocks.meaning_ko = "   ";
    expect(normalizeFeedbackResponse(missingMeaning, "답안", feature)).toMatchObject({
      ok: false,
      error: expect.stringContaining("의미 판정 설명이 비어 있음"),
    });

    const outsideBand = feature.band_schema.find((band) => band.code !== feature.within_band_code);
    expect(outsideBand).toBeDefined();
    if (!outsideBand) return;
    const missingFeature = rawFeedback(feature, outsideBand.code);
    missingFeature.blocks.feature_ko = "";
    expect(normalizeFeedbackResponse(missingFeature, "답안", feature)).toMatchObject({
      ok: false,
      error: expect.stringContaining("화용 판정 설명이 비어 있음"),
    });
  });

  it("rejects structurally excessive lite feedback", () => {
    const feature = TARGET_FEATURES.refusal_softening;
    const raw = rawFeedback(feature);
    raw.verdicts.grammatical_accuracy = "impeding_errors";
    raw.blocks.grammar = [
      { suggested_correction: "수정 1", explanation_ko: "설명 1" },
      { suggested_correction: "수정 2", explanation_ko: "설명 2" },
    ];

    expect(normalizeFeedbackResponse(raw, "답안", feature)).toMatchObject({
      ok: false,
      error: expect.stringContaining("피드백 형식 불일치"),
    });
  });

  it("rejects blank-looking corrections and alternatives", () => {
    const feature = TARGET_FEATURES.request_mitigation_optionality;

    const blankCorrection = rawFeedback(feature);
    blankCorrection.verdicts.grammatical_accuracy = "impeding_errors";
    blankCorrection.blocks.grammar = [
      { suggested_correction: "   ", explanation_ko: "이해를 방해합니다." },
    ];
    expect(normalizeFeedbackResponse(blankCorrection, "답안", feature)).toMatchObject({
      ok: false,
      error: expect.stringContaining("피드백 형식 불일치"),
    });

    const blankAlternative = rawFeedback(feature);
    blankAlternative.blocks.alternatives = [{ text: "   ", note_ko: "" }];
    expect(normalizeFeedbackResponse(blankAlternative, "답안", feature)).toMatchObject({
      ok: false,
      error: expect.stringContaining("피드백 형식 불일치"),
    });
  });
});
