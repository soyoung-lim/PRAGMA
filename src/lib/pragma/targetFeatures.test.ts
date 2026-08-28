import { describe, expect, it } from "vitest";

import {
  DEFAULT_FEATURE_BY_ACT,
  FEATURE_CODES_BY_ACT,
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
      for (const [summaryKey, summaryCopy] of Object.entries(feature.handoff_summary)) {
        expect(summaryCopy.trim(), `${key}.${summaryKey}`).not.toBe("");
        expect(summaryCopy, `${key}.${summaryKey}`).not.toMatch(/[\r\n]/);
        expect(summaryCopy.length, `${key}.${summaryKey}`).toBeLessThanOrEqual(70);
      }

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
    expect(Object.keys(DEFAULT_FEATURE_BY_ACT)).toHaveLength(9);
    for (const [act, featureCode] of Object.entries(DEFAULT_FEATURE_BY_ACT)) {
      const feature = TARGET_FEATURES[featureCode];
      expect(feature, `${act} → ${featureCode}`).toBeDefined();
      expect(feature.speech_act).toBe(act);
    }
  });

  it("keeps approved feature lists complete while compliment response stays non-default", () => {
    expect(Object.keys(FEATURE_CODES_BY_ACT)).toHaveLength(9);
    for (const [act, featureCodes] of Object.entries(FEATURE_CODES_BY_ACT)) {
      expect(featureCodes.length, act).toBeGreaterThan(0);
      expect(new Set(featureCodes).size, act).toBe(featureCodes.length);
      for (const featureCode of featureCodes) {
        expect(TARGET_FEATURES[featureCode]?.speech_act, `${act} → ${featureCode}`).toBe(act);
      }
    }

    expect(FEATURE_CODES_BY_ACT.compliment).toEqual([
      "compliment_grounding_sensitivity",
      "compliment_response_uptake",
    ]);
    expect(DEFAULT_FEATURE_BY_ACT.compliment).toBe("compliment_grounding_sensitivity");
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

  it("keeps invitation choice and commitment band boundaries explicit", () => {
    const feature = TARGET_FEATURES.invitation_choice_commitment;

    expect(feature.version).toBe("1.2");
    // v1.1이 없앤 오탐 가드는 그대로 살아 있어야 한다.
    expect(feature.operational_definition).toContain("희망·환영형은 그 자체로 압박이 아니다");
    expect(feature.operational_definition).toContain("선택권을 넓힌다는 이유만으로 모호하다고 판정하지 않는다");
    expect(feature.operational_definition_zh_ko).toContain("'참석해 주시면 좋겠습니다'");
    expect(feature.operational_definition_zh_ko).toContain("통상적 희망형은 그 자체로 압박이 아니다");
    expect(feature.operational_definition_zh_ko).toContain("'일정이 맞지 않으면 조정하겠습니다'");
  });

  it.each([
    ["request_mitigation_optionality", ["too_direct", "within_band", "too_indirect"]],
    ["refusal_softening", ["too_blunt", "within_band", "over_elaborate"]],
    ["gratitude_calibration", ["insufficient", "within_band", "excessive"]],
  ])("keeps %s contextual in both directions without changing band codes", (code, bands) => {
    const feature = TARGET_FEATURES[code as string];
    expect(feature.version).toBe("1.1");
    expect(feature.band_schema.map((band) => band.code)).toEqual(bands);
    expect(feature.within_band_code).toBe("within_band");
    for (const definition of [
      feature.operational_definition,
      feature.operational_definition_zh_ko ?? "",
    ]) {
      expect(definition).toContain("표현형·표지 수·PDR 라벨만으로 적절성을 결정하지 않는다");
      expect(definition).toContain("원문의 명제·의도·화행 목적을 보존");
      expect(definition).toContain("원문·상황·허용된 사실에 없는 사유·조건·약속을 만들지 않는다");
    }
    for (const counterRule of [feature.counter_rule_note, feature.counter_rule_note_zh_ko ?? ""]) {
      expect(counterRule).toContain("실제 상황");
      expect(counterRule).toContain("근거를 제시한다");
    }
  });

  it("does not make direct requests automatically correct or incorrect", () => {
    const feature = TARGET_FEATURES.request_mitigation_optionality;
    expect(feature.operational_definition).toContain("친밀·저부담도 직접형의 자동 정답 조건이 아니다");
    expect(feature.operational_definition_zh_ko).toContain("친밀·저부담도 직접형의 자동 정답 조건이 아니다");
    expect(feature.closing_principle_ko).not.toContain("친밀·저부담이면 직접형도 알맞고");
    expect(feature.handoff_summary.correction).not.toContain("가능한지 묻는 표현으로");
  });

  it("judges refusal resources by function, not by quantity", () => {
    const feature = TARGET_FEATURES.refusal_softening;
    for (const definition of [feature.operational_definition, feature.operational_definition_zh_ko ?? ""]) {
      expect(definition).toContain("완충의 유무나 양 대신 실제 표현");
      expect(definition).toContain("거절을 수락으로 바꾸는 것은 대역 차이가 아니라 목적 이탈");
    }
    expect(feature.closing_principle_ko).not.toContain("완충 장치의 양으로");
    expect(feature.handoff_summary.reason).not.toContain("완충이 없으면 무뚝뚝");
    expect(feature.band_schema[0].label_ko).not.toContain("완충 없음");
  });

  it("does not assign gratitude bands from favor size or a minimal expression alone", () => {
    const feature = TARGET_FEATURES.gratitude_calibration;
    expect(feature.operational_definition).toContain("谢谢만으로 부족하다고 판정하지 않는다");
    expect(feature.operational_definition_zh_ko).toContain("간단한 감사만으로 부족하다고 판정하지 않는다");
    for (const definition of [feature.operational_definition, feature.operational_definition_zh_ko ?? ""]) {
      expect(definition).toContain("호의 크기에 강도를 기계적으로 비례시키거나");
    }
    expect(feature.counter_rule_note).not.toContain("요구분석의 실제 사례");
    expect(feature.closing_principle_ko).not.toContain("호의의 크기에 강도를 맞출 때");
    expect(feature.handoff_summary.correction).not.toContain("호의의 크기에 맞게");
  });

  // v1.2 회귀 — too_ambiguous의 모호 대상이 '정보'가 아니라 '약속 성립'이어야 한다.
  // v1.1 문구("무엇에 참여하는지 또는 초대 의도를 알아볼 수 없을 때만")로 되돌아가면
  // 그 대역을 만족하는 문장이 gate1(명제·의도 불변)에 걸려 생성이 막힌다.
  it("scopes invitation over-band to commitment uptake, not to losing the event itself", () => {
    const feature = TARGET_FEATURES.invitation_choice_commitment;

    for (const definition of [
      feature.operational_definition,
      feature.operational_definition_zh_ko ?? "",
    ]) {
      expect(definition).toContain("참여 약속의 성립 요건이 결정 불가능하게 열려 있을 때");
      expect(definition).toContain("언제·어떤 방식으로 알리면 되는지");
      // 행사·의도 소실은 대역이 아니라 명제 위반이라는 분기가 명시돼야 한다.
      expect(definition).toContain("명제 위반이므로 재생성 대상");
      // 정보 소실을 과잉의 조건으로 되돌리는 문구는 없어야 한다.
      expect(definition).not.toContain("알아볼 수 없을 때만");
    }
  });

  it("still requires the over-band to be reachable while the event stays identifiable", () => {
    const feature = TARGET_FEATURES.invitation_choice_commitment;

    expect(feature.operational_definition).toContain("행사와 초대 의도가 식별되더라도");
    expect(feature.band_schema.map((b) => b.code)).toEqual([
      "too_pressuring",
      "within_band",
      "too_ambiguous",
    ]);
  });
});
