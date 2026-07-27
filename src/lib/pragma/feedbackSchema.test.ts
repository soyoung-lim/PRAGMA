import { describe, expect, it } from "vitest";

import {
  deriveRevisionScope,
  repairPragmaticLeakIntoMeaning,
  reconcileFeedback,
  stripPhantomAnchors,
  stripVacuousAlternatives,
  validatePragmaticCodes,
  type FeedbackVerdicts,
} from "./feedbackSchema";

const verdicts = (
  overrides: Partial<FeedbackVerdicts> = {},
): FeedbackVerdicts => ({
  semantic_fidelity: "preserved",
  grammatical_accuracy: "clean",
  pragmatic_appropriateness: {
    feature_code: "request_mitigation_optionality",
    band_code: "within_band",
  },
  ...overrides,
});

describe("feedback scope", () => {
  it("uses the fixed meaning → grammar → feature → clear priority", () => {
    expect(deriveRevisionScope(verdicts({
      semantic_fidelity: "minor_loss",
      grammatical_accuracy: "impeding_errors",
    }), "within_band")).toBe("meaning");

    expect(deriveRevisionScope(verdicts({
      grammatical_accuracy: "impeding_errors",
    }), "within_band")).toBe("grammar");

    expect(deriveRevisionScope(verdicts({
      pragmatic_appropriateness: {
        feature_code: "request_mitigation_optionality",
        band_code: "too_direct",
      },
    }), "within_band")).toBe("feature");

    expect(deriveRevisionScope(verdicts(), "within_band")).toBe("clear");
  });
});

describe("feedback consistency", () => {
  it("rejects a different feature or an unknown band", () => {
    const allowed = ["too_direct", "within_band", "too_indirect"];

    expect(validatePragmaticCodes(
      verdicts(),
      "request_mitigation_optionality",
      allowed,
    )).toBeNull();

    expect(validatePragmaticCodes(
      verdicts({
        pragmatic_appropriateness: {
          feature_code: "refusal_softening",
          band_code: "within_band",
        },
      }),
      "request_mitigation_optionality",
      allowed,
    )).toContain("feature_code 불일치");

    expect(validatePragmaticCodes(
      verdicts({
        pragmatic_appropriateness: {
          feature_code: "request_mitigation_optionality",
          band_code: "invented_band",
        },
      }),
      "request_mitigation_optionality",
      allowed,
    )).toContain("허용되지 않은 band_code");
  });

  it("removes unsupported grammar verdicts and phantom anchors", () => {
    const reconciled = reconcileFeedback({
      verdicts: verdicts({ grammatical_accuracy: "impeding_errors" }),
      blocks: {
        meaning_ko: "뜻은 전달됩니다.",
        grammar: [],
        feature_ko: "이 상황에서는 자연스럽게 들릴 수 있습니다.",
        alternatives: [],
      },
      uncertainty_flags: [],
    });

    expect(reconciled.verdicts.grammatical_accuracy).toBe("clean");
    expect(reconciled.issues).toHaveLength(1);

    const blocks = {
      grammar: [{
        anchor_text: "없는 표현",
        suggested_correction: "수정",
        explanation_ko: "설명",
      }],
    };
    expect(stripPhantomAnchors(blocks, "학습자가 실제로 쓴 답")).toHaveLength(1);
    expect(blocks.grammar[0].anchor_text).toBeUndefined();
  });

  it("removes alternatives that repeat the answer or each other", () => {
    const blocks = {
      alternatives: [
        { text: "原来的答案", note_ko: "같은 문장" },
        { text: "另一个说法", note_ko: "다른 선택" },
        { text: "另一个说法", note_ko: "중복" },
      ],
    };

    const issues = stripVacuousAlternatives(blocks, "原来的答案");

    expect(blocks.alternatives).toEqual([
      { text: "另一个说法", note_ko: "다른 선택" },
    ]);
    expect(issues).toHaveLength(2);
  });

  it("keeps directness and optionality out of the meaning verdict", () => {
    const v = verdicts({ semantic_fidelity: "minor_loss" });
    const blocks = {
      meaning_ko:
        "장소 변경 요청 사실은 전달하나, 부탁의 완화와 선택권을 포함하지 않아 의미가 달라졌습니다.",
      grammar: [],
      feature_ko: "이 상황에서는 너무 직접적으로 들릴 수 있습니다.",
      alternatives: [],
    };

    expect(repairPragmaticLeakIntoMeaning(v, blocks)).toHaveLength(1);
    expect(v.semantic_fidelity).toBe("preserved");
    expect(blocks.meaning_ko).toContain("화용 층");
  });

  it("retains a meaning verdict backed by a concrete omission", () => {
    const v = verdicts({ semantic_fidelity: "minor_loss" });
    const blocks = {
      meaning_ko:
        "원문의 '다음 주'라는 시간 조건이 빠졌고, 표현도 직접적으로 바뀌었습니다.",
      grammar: [],
      feature_ko: "이 상황에서는 너무 직접적으로 들릴 수 있습니다.",
      alternatives: [],
    };

    expect(repairPragmaticLeakIntoMeaning(v, blocks)).toHaveLength(0);
    expect(v.semantic_fidelity).toBe("minor_loss");
  });
});
