import { describe, expect, it } from "vitest";

import { checkCore, type CheckContext } from "@/lib/pragma/missionRules";

const baseContext: CheckContext = {
  speech_act: "request",
  level: "intermediate",
  domain: "work",
  theme_code: "career_workplace",
  topic_code: "schedule_change",
  mode: "translation",
  source_modality: "written",
};

const baseCore = {
  schema_version: "scenario_core_v1",
  situation_ko: "거래처 담당자에게 일정 변경 요청을 글로 작성해 보낸다.",
  relation_ko: "거래처 담당자와 실무자 관계",
  source_modality: "written",
  source_text_ko: "회의를 하루 앞당길 수 있을까요?",
  preceding_turn_zh: null,
  pdr: { p: "speaker_lower", d: "acquaintance", r: "mid" },
  channel: "messenger",
};

const r16Fails = (core: unknown, context: CheckContext) =>
  checkCore(core, context).violations.filter(
    (violation) => violation.id === "R16" && violation.level === "fail",
  );

describe("R16 명시적 수행 모드 모순", () => {
  it("번역 셀에서 글을 부정하고 직접 말한다고 하면 저장 전 차단한다", () => {
    const core = {
      ...baseCore,
      situation_ko:
        "발표를 마친 뒤 상대를 칭찬한다. 글로 남기지 않고 직접 말하는 상황이다.",
    };

    expect(r16Fails(core, baseContext).map((item) => item.message)).toContainEqual(
      expect.stringContaining("구두 수행을 명시"),
    );
  });

  it("통역 셀에서 이메일로 작성해 보낸다고 하면 저장 전 차단한다", () => {
    const core = {
      ...baseCore,
      situation_ko: "담당자에게 일정 변경 요청을 이메일로 작성해 보내는 상황이다.",
      source_modality: "spoken",
      channel: "facetoface",
    };
    const context: CheckContext = {
      ...baseContext,
      mode: "stt_interpreting",
      source_modality: "spoken",
    };

    expect(r16Fails(core, context).map((item) => item.message)).toContainEqual(
      expect.stringContaining("서면 수행을 명시"),
    );
  });

  it("번역 셀의 즉시 반응 기대와 통역 셀의 직접 대화는 각각 허용한다", () => {
    const written = {
      ...baseCore,
      situation_ko: "메신저로 글을 보내며 상대의 즉시 반응을 기대하는 상황이다.",
    };
    const writtenNotice = {
      ...baseCore,
      situation_ko:
        "어려움을 정중하지만 분명한 어조로 글로 작성해 알리는 상황이다. 메시지는 기록으로 남는다.",
    };
    const writtenBecauseSpeakingIsAwkward = {
      ...baseCore,
      situation_ko:
        "이웃 간에 소음 문제로 서로 불편함을 느껴 글로 정중하게 부탁하는 상황이다. 직접 만나서 말하기는 어색하여 편지나 메모 형태로 요청을 전한다.",
    };
    const writtenWithoutImmediateResponse = {
      ...baseCore,
      situation_ko:
        "몇 차례 얼굴을 마주친 적 있는 이웃에게 소음 문제에 대해 글로 정중히 부탁하는 상황이다. 상대방이 내용을 충분히 검토할 수 있도록 글로 남기며 즉각적인 반응은 기대하지 않는다. 요청 사항은 이웃이 직접 소음을 줄이는 행동을 할 수 있는 범위 내에 있다.",
    };
    const spoken = {
      ...baseCore,
      situation_ko: "담당자를 직접 만나 일정 변경을 요청하는 상황이다.",
      source_modality: "spoken",
      channel: "facetoface",
    };
    const spokenContext: CheckContext = {
      ...baseContext,
      mode: "stt_interpreting",
      source_modality: "spoken",
    };

    expect(r16Fails(written, baseContext)).toEqual([]);
    expect(r16Fails(writtenNotice, baseContext)).toEqual([]);
    expect(r16Fails(writtenBecauseSpeakingIsAwkward, baseContext)).toEqual([]);
    expect(r16Fails(writtenWithoutImmediateResponse, baseContext)).toEqual([]);
    expect(r16Fails(spoken, spokenContext)).toEqual([]);
  });
});
