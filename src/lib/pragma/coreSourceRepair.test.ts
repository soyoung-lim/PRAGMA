import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildCoreOutputRepairPrompt,
  buildCoreSourceRepairPrompt,
  canonicalInterpreterSituationLead,
  canonicalizeInterpreterPartyLabels,
  canonicalizeInterpreterSituation,
  coreBilingualSceneIssue,
  coreBilingualSceneWarning,
  coreLearnerSceneIssue,
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
    expect(CORE_LENGTH_POLICY_VERSION).toBe("effective_chars_v2_min_warning");
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
    expect(prompt).toContain("반환 직전에 source_text의 유효 글자 수를 다시 세어");
    expect(prompt).toContain("한자·라틴문자·숫자는 각각 유효 글자 1자");
    expect(prompt).toContain("유효 글자 37자 부근까지 확장");
    expect(prompt).toContain("인물·관계·상황·사실·화행 목적은 그대로 보존");
    expect(prompt).toContain("focal_segments");
  });

  it("길이 교정문이 기존 focal segment를 보존하면 기존 표지를 안전하게 재사용한다", () => {
    const originalFocal = [{ text: "这次我不能参加", role: "head" as const }];
    const result = mergeValidatedCoreRepair({
      originalOutput: {
        source_text: "这次我不能参加。",
        focal_segments: originalFocal,
      },
      repairedOutput: {
        source_text:
          "谢谢你的邀请，不过这次我不能参加，因为已有安排。希望以后还有机会一起交流，也请你理解我的情况。",
        focal_segments: [{ text: "不存在的片段", role: "head" }],
      },
      effectiveCharRange: { min: 40, max: 60 },
      sourceIssue: {
        sentenceCount: 1,
        effectiveCharCount: 7,
        sentenceOutOfRange: true,
        lengthOutOfRange: true,
        message: "too short",
      },
      precedingTurnIssue: null,
    });

    expect(result.sourceRepairApplied).toBe(true);
    expect(result.output.focal_segments).toEqual(originalFocal);
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
    ).toEqual([
      "source_speaker",
      "target_speaker",
      "interpreting",
      "learner_interpreter",
    ]);
    expect(
      coreBilingualSceneIssue(
        "중국어 원발화자와 한국어 청자가 예산을 논의하며, 학습자는 두 사람 사이에서 순차통역한다.",
        "zh",
        "ko",
        true,
      ),
    ).toBeNull();
  });

  it("학습자가 원발화자와 통역사를 겸하는 실제 실패 문형을 차단한다", () => {
    const invitation = coreBilingualSceneIssue(
      "학습자는 중국 연구원을 직접 구두로 초대하고자 하며, 학습자가 한국 담당자에게 통역하는 상황이다.",
      "zh",
      "ko",
      true,
    );
    const complaint = coreBilingualSceneIssue(
      "학습자는 중국어 화자로서 상사에게 직접 말로 불만을 전달하는 한국어 통역 상황이다.",
      "zh",
      "ko",
      true,
    );

    expect(invitation?.missing).toContain("role_overlap");
    expect(complaint?.missing).toContain("role_overlap");
  });

  it("세 역할이 명시되면 '두 사람 사이' 같은 고정 문구 없이도 통과한다", () => {
    expect(
      coreBilingualSceneIssue(
        "중국어 원발화자인 담당자가 한국인 학생에게 감사하고, 학습자는 이 대화를 통역하는 통역사 역할을 맡는다.",
        "zh",
        "ko",
        true,
      ),
    ).toBeNull();
  });

  it("학습자 C를 가리키는 2인칭 '당신' 통역 문장을 계약상 유효하게 본다", () => {
    expect(
      coreBilingualSceneIssue(
        "당신은 한국어 원발화자 A와 중국어 청자 B 사이에서 통역을 맡았다.",
        "ko",
        "zh",
        true,
      ),
    ).toBeNull();
  });

  it("통역 첫 문장을 방향별 A/B/C 역할·언어 계약으로 결정론적으로 고정한다", () => {
    const koZh = canonicalizeInterpreterSituation(
      "한국 담당자가 중국 거래처에 일정을 제안한다. 두 사람은 처음 만났다.",
      "ko",
      "zh",
      true,
    );
    const zhKo = canonicalizeInterpreterSituation(
      "중국 담당자가 한국 거래처에 일정을 제안한다. 두 사람은 처음 만났다.",
      "zh",
      "ko",
      true,
    );

    expect(koZh.value.startsWith(canonicalInterpreterSituationLead("ko", "zh"))).toBe(true);
    expect(zhKo.value.startsWith(canonicalInterpreterSituationLead("zh", "ko"))).toBe(true);
    expect(coreBilingualSceneIssue(koZh.value, "ko", "zh", true)).toBeNull();
    expect(coreBilingualSceneIssue(zhKo.value, "zh", "ko", true)).toBeNull();
    expect(canonicalizeInterpreterSituation(koZh.value, "ko", "zh", true)).toEqual({
      value: koZh.value,
      applied: false,
    });
  });

  it("v55의 C=멘토 합체 역할 문장을 서버 역할 문장으로 교체한다", () => {
    const result = canonicalizeInterpreterSituation(
      "당신은 선배 멘토로서 후배 학생과 구두로 대화하며 통역을 맡았다. 후배가 최근 발표와 과제에서 보여준 뛰어난 분석력과 창의성에 대해 칭찬하는 상황이다. 후배는 선배의 긍정적 평가를 부담스러워할 수 있다.",
      "ko",
      "zh",
      true,
    );

    expect(result.applied).toBe(true);
    expect(result.value).not.toContain("당신은 선배 멘토");
    expect(result.value).toContain("후배가 최근 발표와 과제");
    expect(coreBilingualSceneIssue(result.value, "ko", "zh", true)).toBeNull();
  });

  it("v55의 학습자 A 결속을 situation·relation 모두 원발화자 A로 정규화한다", () => {
    const situation = canonicalizeInterpreterSituation(
      "당신은 조별 과제에서 학습자 A와 조장인 B 사이에서 통역을 맡았다. A는 조원으로서 조장에게 과제 진행 방식을 제안하려 한다.",
      "zh",
      "ko",
      true,
    );
    const relation = canonicalizeInterpreterPartyLabels(
      "학습자 A는 조별 과제 조원이고, 상대 B는 조장이다.",
      true,
    );

    expect(situation.value).not.toContain("학습자 A");
    expect(relation.value).toContain("원발화자 A");
    expect(coreBilingualSceneIssue(situation.value, "zh", "ko", true, relation.value)).toBeNull();
  });

  it("v55 무저장 재카나리 18건을 새 역할 정규화에 재생하면 R16 역할 오류가 남지 않는다", () => {
    type CanaryRow = {
      act: string;
      cell: { topic_code: string; direction: "ko_zh" | "zh_ko" };
      core: { situation_ko: string; relation_ko: string };
    };
    const rows = JSON.parse(
      readFileSync(
        resolve(
          process.cwd(),
          "docs/research-trail/evidence/2026-08-06-interpreter-role-canary-v55/v55-interpreter-role-18-core-only.json",
        ),
        "utf8",
      ),
    ) as CanaryRow[];
    const failures = rows.flatMap((row) => {
      const sourceLanguage = row.cell.direction === "ko_zh" ? "ko" : "zh";
      const targetLanguage = row.cell.direction === "ko_zh" ? "zh" : "ko";
      const situation = canonicalizeInterpreterSituation(
        row.core.situation_ko,
        sourceLanguage,
        targetLanguage,
        true,
      ).value;
      const relation = canonicalizeInterpreterPartyLabels(row.core.relation_ko, true).value;
      const issue = coreBilingualSceneIssue(
        situation,
        sourceLanguage,
        targetLanguage,
        true,
        relation,
      );
      return issue
        ? [{ act: row.act, topic: row.cell.topic_code, missing: issue.missing, situation, relation }]
        : [];
    });

    expect(rows).toHaveLength(18);
    expect(failures).toEqual([]);
  });

  it("학습자 A/B 결속은 relation_ko에만 남아도 역할 중첩으로 차단한다", () => {
    expect(
      coreBilingualSceneIssue(
        canonicalInterpreterSituationLead("zh", "ko"),
        "zh",
        "ko",
        true,
        "학습자 A는 조원이고 B는 조장이다.",
      )?.missing,
    ).toContain("role_overlap");
  });

  it("A/B인 학생 뒤에 통역 단어가 있다는 이유만으로 C가 있다고 오인하지 않는다", () => {
    expect(
      coreBilingualSceneIssue(
        "한국어를 사용하는 학생 A와 중국어 담당자 B 사이에서 통역이 진행된다.",
        "ko",
        "zh",
        true,
      )?.missing,
    ).toContain("learner_interpreter");
  });

  it("부분 블라인드 패킷의 역할 중첩·A 1인칭 사례를 새 계약으로 구분한다", () => {
    const firstPerson = coreBilingualSceneIssue(
      "저는 한국 제조업체의 해외 무역 담당자입니다. 중국어 청자와 협의하며, 학습자는 한국어 원발화자와 청자 사이에서 통역합니다.",
      "ko",
      "zh",
      true,
    );
    const learnerAsCustomer = coreBilingualSceneIssue(
      "학습자는 호텔 고객으로, 중국어 청자인 직원에게 문제 해결을 요청한다. 학습자는 한국어 원발화자의 말을 통역한다.",
      "ko",
      "zh",
      true,
    );
    const learnerAsRecipient = coreBilingualSceneIssue(
      "중국어 원발화자인 담당자인 나는 한국어 청자인 학생에게 감사한다. 학습자는 통역사이면서 감사 인사를 듣는다.",
      "zh",
      "ko",
      true,
    );

    expect(firstPerson?.missing).toContain("source_first_person");
    expect(learnerAsCustomer?.missing).toContain("role_overlap");
    expect(learnerAsRecipient?.missing).toEqual(
      expect.arrayContaining(["role_overlap", "source_first_person"]),
    );
  });

  it("통역사가 원발화를 듣는 정상 논항은 차단하지 않는다", () => {
    expect(
      coreBilingualSceneIssue(
        "당신은 중국어 원발화자와 한국어 청자 사이에서 통역을 맡았다. 학습자는 원발화자의 말을 듣고 청자에게 옮긴다.",
        "zh",
        "ko",
        true,
      ),
    ).toBeNull();
  });

  it("'직접'은 역할에 따라 hard fail·warning·허용으로 나눈다", () => {
    expect(
      coreBilingualSceneIssue(
        "한국어 원발화자와 중국어 청자 사이에서 학습자가 현장에서 직접 통역한다.",
        "ko",
        "zh",
        true,
      ),
    ).toBeNull();
    expect(
      coreBilingualSceneWarning(
        "한국어 원발화자와 중국어 청자가 직접 협의하며 학습자는 통역한다.",
        true,
      )?.code,
    ).toBe("ambiguous_direct_party_interaction");
    expect(
      coreBilingualSceneIssue(
        "한국어 원발화자와 중국어 청자가 통역 없이 직접 대화하고 학습자는 통역사로 참여한다.",
        "ko",
        "zh",
        true,
      )?.missing,
    ).toContain("role_overlap");
  });

  it("학생용 상황문의 정답 방향 노출을 별도 오류로 잡는다", () => {
    expect(
      coreLearnerSceneIssue(
        "중국 연구원이 한국 동료를 발표회에 부담을 주지 않으면서도 정중하게 초대한다.",
      ),
    ).toMatchObject({ code: "evaluation_criteria" });
    expect(
      coreLearnerSceneIssue(
        "중국 연구원이 처음 만난 한국 동료를 발표회와 점심 모임에 초대한다.",
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
        situation_ko: "한국어 원발화자와 중국어 청자 사이에서 학습자가 순차통역한다.",
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
    expect(result.bilingualSceneRepairApplied).toBe(true);
    expect(result.output.source_text).toBe("너무 짧다.");
    expect(result.output.situation_ko).toContain("한국어 원발화자와 중국어 청자");
  });

  it("평가 기준 제거 repair만 통과해도 situation_ko를 독립 합성한다", () => {
    const result = mergeValidatedCoreRepair({
      originalOutput: {
        situation_ko: "상대를 부담 없이 정중하게 초대한다.",
        source_text: "我想邀请您参加周五的活动。期待您的回复。",
      },
      repairedOutput: {
        situation_ko: "처음 만난 협력 기관 담당자를 금요일 발표회에 초대한다.",
        source_text: "MODEL_CHANGED_SOURCE",
      },
      effectiveCharRange: { min: 20, max: 35 },
      sourceIssue: null,
      precedingTurnIssue: null,
      bilingualSceneIssue: null,
      learnerSceneIssue: {
        code: "evaluation_criteria",
        message: "학생용 평가 기준 노출",
      },
    });

    expect(result.learnerSceneRepairApplied).toBe(true);
    expect(result.output.situation_ko).toBe(
      "처음 만난 협력 기관 담당자를 금요일 발표회에 초대한다.",
    );
    expect(result.output.source_text).toBe("我想邀请您参加周五的活动。期待您的回复。");
  });

  it("평가 기준 repair가 통역 역할을 다시 합치면 정규화 후에도 남는 오류를 채택하지 않는다", () => {
    const originalSituation = `${canonicalInterpreterSituationLead("ko", "zh")} 한국 담당자 A가 중국 담당자 B에게 행사 참석을 요청한다.`;
    const result = mergeValidatedCoreRepair({
      originalOutput: {
        situation_ko: originalSituation,
        relation_ko: "한국 담당자 A와 중국 담당자 B는 처음 만난 관계다.",
        source_text: "행사에 참석해 주세요. 의견을 나누고 싶습니다.",
      },
      repairedOutput: {
        situation_ko: "학습자는 담당자로서 중국 고객에게 직접 참석을 요청한다. 통역을 맡는다.",
      },
      effectiveCharRange: { min: 20, max: 35 },
      sourceIssue: null,
      precedingTurnIssue: null,
      bilingualSceneIssue: null,
      learnerSceneIssue: {
        code: "evaluation_criteria",
        message: "학생용 평가 기준 노출",
      },
      interpreterScene: {
        sourceLanguage: "ko",
        targetLanguage: "zh",
        required: true,
        relationKo: "한국 담당자 A와 중국 담당자 B는 처음 만난 관계다.",
      },
    });

    expect(result.learnerSceneRepairApplied).toBe(false);
    expect(result.output.situation_ko).toBe(originalSituation);
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
