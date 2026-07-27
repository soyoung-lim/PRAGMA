import { describe, expect, it } from "vitest";

import { checkCore, type CheckContext } from "@/lib/pragma/missionRules";

const baseContext: CheckContext = {
  speech_act: "request",
  level: "intermediate",
  domain: "work",
  theme_code: "career_workplace",
  topic_code: "schedule_change",
  industry: "education_research",
  mode: "translation",
  source_modality: "written",
};

const baseCore = {
  schema_version: "scenario_core_v1",
  situation_ko: "팀원이 담당자에게 일정 변경 요청을 글로 작성해 보낸다.",
  relation_ko: "같은 조직의 팀원과 담당자 관계",
  source_modality: "written",
  source_text_ko: "검토 일정을 하루 늦출 수 있을까요?",
  preceding_turn_zh: null,
  pdr: { p: "speaker_lower", d: "acquaintance", r: "mid" },
  channel: "messenger",
};

const r26Fails = (core: unknown, context: CheckContext) =>
  checkCore(core, context).violations.filter(
    (violation) => violation.id === "R26" && violation.level === "fail",
  );

describe("R26 업무 분야의 구체적 실현", () => {
  it("범용 회사·프로젝트 표현만 있는 교육·연구 셀은 저장 전 차단한다", () => {
    const core = {
      ...baseCore,
      situation_ko:
        "회사 프로젝트 일정이 늦어져 팀원이 담당자에게 변경 요청을 글로 보낸다.",
    };

    expect(r26Fails(core, baseContext)).toHaveLength(1);
  });

  it("연구 대상과 논문 심사 일정이 드러나는 교육·연구 셀은 허용한다", () => {
    const core = {
      ...baseCore,
      situation_ko:
        "대학 연구실에서 연구원이 지도교수에게 논문 심사 일정 변경 요청을 글로 보낸다.",
      relation_ko: "대학 연구실의 연구원과 지도교수 관계",
    };

    expect(r26Fails(core, baseContext)).toEqual([]);
  });

  it("범용 사내 행사만 있는 관광·MICE 셀은 저장 전 차단한다", () => {
    const context: CheckContext = {
      ...baseContext,
      industry: "tourism_hospitality",
    };
    const core = {
      ...baseCore,
      situation_ko:
        "사내 행사 준비 중 팀원이 담당자에게 점심 일정 변경을 글로 요청한다.",
    };

    expect(r26Fails(core, context)).toHaveLength(1);
  });

  it("컨벤션 방문객과 전시회 일정이 드러나는 관광·MICE 셀은 허용한다", () => {
    const context: CheckContext = {
      ...baseContext,
      industry: "tourism_hospitality",
    };
    const core = {
      ...baseCore,
      situation_ko:
        "컨벤션 운영팀이 전시회 방문객 안내 일정을 조정하려고 담당자에게 글을 보낸다.",
    };

    expect(r26Fails(core, context)).toEqual([]);
  });
});
