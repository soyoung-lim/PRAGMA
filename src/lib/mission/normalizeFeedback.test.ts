import { describe, expect, it } from "vitest";

import { normalizeFeedbackResponse } from "./normalizeFeedback";
import type { TargetFeature } from "@/lib/pragma/targetFeatures";

const feature: Pick<TargetFeature, "code" | "band_schema" | "within_band_code"> = {
  code: "request_mitigation_optionality",
  band_schema: [
    { code: "too_direct", label_ko: "너무 직접적" },
    { code: "within_band", label_ko: "알맞음" },
    { code: "too_indirect", label_ko: "너무 우회적" },
  ],
  within_band_code: "within_band",
};

function rawFeedback() {
  return {
    verdicts: {
      semantic_fidelity: "preserved",
      grammatical_accuracy: "clean",
      pragmatic_appropriateness: {
        feature_code: feature.code,
        band_code: "within_band",
      },
    },
    blocks: {
      meaning_ko: "뜻이 유지됐습니다.",
      grammar: [],
      feature_ko: "이 상황에서는 자연스럽게 들릴 수 있습니다.",
      alternatives: [],
    },
    uncertainty_flags: [],
    rubric_version: "request_mitigation_optionality@1.0",
    provenance: {
      model: "test-model",
      prompt_version: "feedback_v1",
      generated_at: "2026-07-27T00:00:00.000Z",
    },
  };
}

describe("normalizeFeedbackResponse", () => {
  it("normalizes a valid response and derives clear in code", () => {
    const result = normalizeFeedbackResponse(rawFeedback(), "可以吗？", feature);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.feedback.revision_scope).toBe("clear");
    expect(result.feedback.provenance.model).toBe("test-model");
    expect(result.feedback.rubric_version).toBe("request_mitigation_optionality@1.0");
  });

  it("rejects malformed responses and out-of-catalog pragmatic codes", () => {
    expect(normalizeFeedbackResponse({}, "답", feature)).toMatchObject({ ok: false });

    const wrongFeature = rawFeedback();
    wrongFeature.verdicts.pragmatic_appropriateness.feature_code = "refusal_softening";
    expect(normalizeFeedbackResponse(wrongFeature, "답", feature)).toMatchObject({
      ok: false,
      error: expect.stringContaining("feature_code 불일치"),
    });

    const wrongBand = rawFeedback();
    wrongBand.verdicts.pragmatic_appropriateness.band_code = "invented_band";
    expect(normalizeFeedbackResponse(wrongBand, "답", feature)).toMatchObject({
      ok: false,
      error: expect.stringContaining("허용되지 않은 band_code"),
    });
  });

  it("repairs unsupported grammar verdicts and removes phantom anchors", () => {
    const raw = rawFeedback();
    raw.verdicts.grammatical_accuracy = "impeding_errors";
    raw.blocks.grammar = [{
      anchor_text: "답안에 없는 구절",
      suggested_correction: "수정안",
      explanation_ko: "설명",
    }];

    const result = normalizeFeedbackResponse(raw, "실제 학습자 답안", feature);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.feedback.revision_scope).toBe("grammar");
    expect(result.feedback.blocks.grammar[0].anchor_text).toBeUndefined();
    expect(result.issues).toContain('anchor_text "답안에 없는 구절"가 답안에 없어 제거함');
  });
});
