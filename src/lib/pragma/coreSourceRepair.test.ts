import { describe, expect, it } from "vitest";

import {
  buildCoreOutputRepairPrompt,
  buildCoreSourceRepairPrompt,
  coreBilingualSceneIssue,
  corePrecedingTurnIssue,
  coreSourceIssue,
  coreSourceSentenceIssue,
  countCoreSourceSentences,
  mergeValidatedCoreRepair,
} from "../../../supabase/functions/_shared/coreSourceRepair";
import {
  CORE_LENGTH_POLICY_VERSION,
  coreLengthRange,
  countCoreEffectiveChars,
} from "../../../supabase/functions/_shared/coreLengthPolicy";

describe("core source discourse boundary", () => {
  it("중국어 쉼표만 이어진 장문은 한 문장으로 판정한다", () => {
    const source =
      "我觉得学校的延期政策很不合理，明明很多人都需要，但他们只是简单地拒绝了我们的请求，这让我们很难适应新的学期安排。";

    expect(countCoreSourceSentences(source)).toBe(1);
    expect(coreSourceSentenceIssue(source)?.count).toBe(1);
  });

  it("중국어 종결부호로 나뉜 2~4문장은 통과한다", () => {
    const source =
      "我觉得学校的延期政策很不合理。很多人都需要延期，但学校只是简单地拒绝了我们的请求。这让我们很难适应新的学期安排。";

    expect(countCoreSourceSentences(source)).toBe(3);
    expect(coreSourceSentenceIssue(source)).toBeNull();
  });

  it("공백·문장부호를 제외한 유효 글자 수를 센다", () => {
    expect(countCoreEffectiveChars("你好，世界！ 2026")).toBe(8);
  });

  it("통역 입문 범위를 벗어난 장문은 글자 수 교정 대상으로 잡는다", () => {
    const issue = coreSourceIssue(
      "我想先说明一下现在的情况。因为原来的安排已经改变，我们需要重新确认所有细节，也要尽快通知相关同学和老师。",
      coreLengthRange("beginner_intermediate", "stt_interpreting"),
    );
    expect(issue?.lengthOutOfRange).toBe(true);
    expect(CORE_LENGTH_POLICY_VERSION).toBe("effective_chars_v1");
  });

  it("교정 요청은 기존 사실 보존과 중국어 문장 경계를 함께 고정한다", () => {
    const prompt = buildCoreSourceRepairPrompt({
      originalUserPrompt: "PROBE_REQUEST",
      previousOutput: { source_text: "조건을 바꾸지 않는다。" },
      sourceLanguage: "zh",
      lengthHintKo: "2~3문장의 짧은 구두 담화",
      measuredSentenceCount: 1,
      measuredEffectiveCharCount: 12,
      effectiveCharRange: { min: 30, max: 45 },
    });

    expect(prompt).toContain("PROBE_REQUEST");
    expect(prompt).toContain("중국어 종결부호(。！？)");
    expect(prompt).toContain("유효 글자 수를 반드시 30~45자");
    expect(prompt).toContain("유효 글자 37자를 목표");
    expect(prompt).toContain("현재보다 약 25자 늘리세요");
    expect(prompt).toContain("정확히 3문장");
    expect(prompt).toContain("약 10~15자");
    expect(prompt).toContain("각 문장의 유효 글자 수를 따로 확인");
    expect(prompt).toContain("반환 직전에 source_text의 유효 글자 수를 다시 세어");
    expect(prompt).toContain("인물·관계·상황·사실·화행 목적은 그대로 보존");
    expect(prompt).toContain("focal_segments");
  });

  it("중→한 응답 화행의 중국어 선행 발화를 한국어 오류로 잡는다", () => {
    expect(corePrecedingTurnIssue("我建议增加预算。", "ko", true)).toMatchObject({
      code: "wrong_language",
      expectedLanguage: "ko",
    });
    expect(corePrecedingTurnIssue("예산을 늘리는 게 좋겠습니다.", "ko", true)).toBeNull();
  });

  it("한→중 응답 화행의 한국어 선행 발화를 중국어 오류로 잡는다", () => {
    expect(corePrecedingTurnIssue("예산을 늘리는 게 좋겠습니다.", "zh", true)).toMatchObject({
      code: "wrong_language",
      expectedLanguage: "zh",
    });
    expect(corePrecedingTurnIssue("我建议增加预算。", "zh", true)).toBeNull();
  });

  it("응답 화행의 빈 선행 발화만 필수 오류로 잡는다", () => {
    expect(corePrecedingTurnIssue(null, "ko", true)?.code).toBe("missing");
    expect(corePrecedingTurnIssue(null, "ko", false)).toBeNull();
  });

  it("선행 발화 전용 교정은 source_text를 고정하고 target 언어를 명시한다", () => {
    const prompt = buildCoreOutputRepairPrompt({
      originalUserPrompt: "PROBE_REQUEST",
      previousOutput: {
        source_text: "我不同意这个安排。我们需要再讨论。",
        preceding_turn: "我建议下周开始。",
        focal_segments: [{ text: "我不同意这个安排", role: "head" }],
      },
      sourceLanguage: "zh",
      lengthHintKo: "유효 글자 40~60자",
      effectiveCharRange: { min: 40, max: 60 },
      sourceIssue: null,
      precedingTurnIssue: {
        code: "wrong_language",
        expectedLanguage: "ko",
        message: "preceding_turn은 한국어여야 합니다.",
      },
    });

    expect(prompt).toContain("source_text와 focal_segments는 직전 출력에서 바꾸지 마세요");
    expect(prompt).toContain("자연스러운 한국어 발화");
    expect(prompt).toContain("중국어로 쓰지 마세요");
    expect(prompt).toContain("명제·화행·사람·소유·행위 대상을 그대로 보존");
    expect(prompt).toContain("두 턴의 언어를 서로 뒤집지 마세요");
  });

  it("통역 이유가 드러나지 않는 단일언어 장면을 교정 대상으로 잡는다", () => {
    expect(
      coreBilingualSceneIssue(
        "두 연구책임자가 처음 만나 예산을 논의한다.",
        "zh",
        "ko",
        true,
      )?.missing,
    ).toEqual(["source_speaker", "target_speaker", "interpreting"]);
    expect(
      coreBilingualSceneIssue(
        "중국 연구원과 한국 담당자가 순차통역을 사이에 두고 예산을 논의한다.",
        "zh",
        "ko",
        true,
      ),
    ).toBeNull();
  });

  it("번역 장면에는 이중언어 통역 참여자 검사를 적용하지 않는다", () => {
    expect(
      coreBilingualSceneIssue("거래처 담당자에게 이메일을 보낸다.", "ko", "zh", false),
    ).toBeNull();
  });

  it("여러 교정 중 통과한 source_text만 원본에 합성한다", () => {
    const original = {
      situation_ko: "두 담당자가 통역 없이 협의한다.",
      source_text: "너무 짧다.",
      focal_segments: [{ text: "너무 짧다", role: "head" }],
      relation_ko: "기존 관계",
    };
    const result = mergeValidatedCoreRepair({
      originalOutput: original,
      repairedOutput: {
        situation_ko: "여전히 두 담당자가 협의한다.",
        source_text: "일정 변경이 필요합니다. 가능한 시간을 알려 주세요.",
        focal_segments: [
          { text: "일정 변경이 필요합니다", role: "head" },
          { text: "가능한 시간을 알려 주세요", role: "support" },
        ],
        relation_ko: "모델이 바꾼 관계",
      },
      effectiveCharRange: { min: 20, max: 35 },
      sourceIssue: coreSourceIssue("너무 짧다.", { min: 20, max: 35 }),
      precedingTurnIssue: null,
      bilingualSceneIssue: {
        sourceLanguage: "ko",
        targetLanguage: "zh",
        missing: ["source_speaker", "target_speaker", "interpreting"],
        message: "이중언어 장면 누락",
      },
    });

    expect(result.sourceRepairApplied).toBe(true);
    expect(result.sourceRepairCandidate).toEqual({
      sentenceCount: 2,
      effectiveCharCount: countCoreEffectiveChars(
        "일정 변경이 필요합니다. 가능한 시간을 알려 주세요.",
      ),
      sourceStructureValid: true,
      focalSegmentsValid: true,
    });
    expect(result.bilingualSceneRepairApplied).toBe(false);
    expect(result.output.source_text).toBe("일정 변경이 필요합니다. 가능한 시간을 알려 주세요.");
    expect(result.output.situation_ko).toBe(original.situation_ko);
    expect(result.output.relation_ko).toBe("기존 관계");
  });

  it("길이가 아직 실패해도 통과한 이중언어 장면은 독립적으로 합성한다", () => {
    const result = mergeValidatedCoreRepair({
      originalOutput: {
        situation_ko: "두 담당자가 협의한다.",
        source_text: "너무 짧다.",
        focal_segments: [{ text: "너무 짧다", role: "head" }],
      },
      repairedOutput: {
        situation_ko: "한국어 화자와 중국어 화자 사이에서 학습자가 순차통역한다.",
        source_text: "여전히 짧다.",
        focal_segments: [{ text: "여전히 짧다", role: "head" }],
      },
      effectiveCharRange: { min: 20, max: 35 },
      sourceIssue: coreSourceIssue("너무 짧다.", { min: 20, max: 35 }),
      precedingTurnIssue: null,
      bilingualSceneIssue: {
        sourceLanguage: "ko",
        targetLanguage: "zh",
        missing: ["source_speaker", "target_speaker", "interpreting"],
        message: "이중언어 장면 누락",
      },
    });

    expect(result.sourceRepairApplied).toBe(false);
    expect(result.sourceRepairCandidate).toMatchObject({
      sourceStructureValid: false,
      focalSegmentsValid: true,
    });
    expect(result.bilingualSceneRepairApplied).toBe(true);
    expect(result.output.source_text).toBe("너무 짧다.");
    expect(result.output.situation_ko).toContain("한국어 화자와 중국어 화자");
  });

  it("원문 교정은 head가 없는 focal_segments를 채택하지 않는다", () => {
    const result = mergeValidatedCoreRepair({
      originalOutput: { source_text: "너무 짧다." },
      repairedOutput: {
        source_text: "일정 변경이 필요합니다. 가능한 시간을 알려 주세요.",
        focal_segments: [{ text: "가능한 시간을 알려 주세요", role: "support" }],
      },
      effectiveCharRange: { min: 20, max: 35 },
      sourceIssue: coreSourceIssue("너무 짧다.", { min: 20, max: 35 }),
      precedingTurnIssue: null,
      bilingualSceneIssue: null,
    });

    expect(result.sourceRepairApplied).toBe(false);
    expect(result.output.source_text).toBe("너무 짧다.");
  });
});
