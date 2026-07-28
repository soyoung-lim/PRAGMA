import { describe, expect, it } from "vitest";

import type { LearnerCourseWeek } from "@/lib/curriculum/learnerCourse";
import { buildWeeklyLearnerNote } from "@/lib/curriculum/learnerNote";

function week(overrides: Partial<LearnerCourseWeek> = {}): LearnerCourseWeek {
  return {
    week_no: 2,
    title: "요청",
    type: "regular",
    can_do: ["초면인 담당자에게 일정 변경을 요청할 수 있다."],
    speech_act: "request",
    channel: "messenger",
    pdr_power: "higher",
    pdr_distance: "formal",
    pdr_imposition: "high",
    competency_focus: "관계와 부담에 맞는 요청",
    domain: "work",
    scenarios: [],
    ...overrides,
  };
}

describe("주차 학습 노트 조립", () => {
  it("교수자가 작성한 Can-do와 P/D/R의 자연어 맥락을 보존한다", () => {
    const note = buildWeeklyLearnerNote(week(), "ko_zh");

    expect(note.canDoSource).toBe("instructor");
    expect(note.canDos).toEqual(["초면인 담당자에게 일정 변경을 요청할 수 있다."]);
    expect(note.contextCues.map((cue) => cue.value)).toEqual(
      expect.arrayContaining([
        "상대가 결정권을 더 가진 관계",
        "처음 만나거나 아직 거리가 먼 사이",
        "상대의 시간·노력 부담이 큰 일",
      ]),
    );
    expect(note.features[0].code).toBe("request_mitigation_optionality");
  });

  it("Can-do가 비어 있으면 기존 결정론 가이드로 기본 목표를 제공한다", () => {
    const note = buildWeeklyLearnerNote(week({ can_do: [] }), "ko_zh");

    expect(note.canDoSource).toBe("default");
    expect(note.canDos).toHaveLength(2);
    expect(note.canDos[0]).toContain("‘요청’ 소통 행동");
  });

  it("중→한 방향에서는 한국어 산출 자원을 사용한다", () => {
    const note = buildWeeklyLearnerNote(week(), "zh_ko");

    expect(note.directionLabel).toBe("중→한");
    expect(note.features[0].resources.join(" ")).toContain("주실 수 있을까요");
  });

  it("칭찬 주차는 칭찬하기와 칭찬 대응 초점을 모두 유지한다", () => {
    const note = buildWeeklyLearnerNote(
      week({
        title: "칭찬",
        speech_act: "compliment",
        scenarios: [],
      }),
      "ko_zh",
    );

    expect(note.features.map((feature) => feature.code)).toEqual([
      "compliment_grounding_sensitivity",
      "compliment_response_uptake",
    ]);
  });
});
