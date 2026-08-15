import { describe, expect, it } from "vitest";

import type { ComposerCore, WeekAssignment } from "@/lib/curriculum/composer";
import {
  assembleLearnerCourse,
  type LearnerCourseSource,
} from "@/lib/curriculum/learnerCourse";
import type {
  CurriculumOutlineRow,
  CurriculumWeekRow,
} from "@/lib/curriculum/types";

const outline = {
  id: "outline-1",
  title: "검토 완료 미션 강좌",
  status: "published",
} as CurriculumOutlineRow;

const weeks = [
  {
    id: "week-2",
    outline_id: outline.id,
    week_no: 2,
    type: "regular",
    title: "요청",
    can_do: ["상황에 맞게 요청할 수 있다."],
    speech_act: "request",
    channel: "messenger",
    pdr_power: "equal",
    pdr_distance: "acquaintance",
    pdr_imposition: "low",
    review_released: true,
    competency_focus: "완화와 선택권",
    domain: "school",
  },
  {
    id: "week-3",
    outline_id: outline.id,
    week_no: 3,
    type: "regular",
    title: null,
    speech_act: "thanks",
  },
] as CurriculumWeekRow[];

function core(
  scenarioId: string,
  missionStatus: string | null,
  situation = `${scenarioId} 상황`,
  releaseGateMode: "legacy_reviewed" | "expert_v1" = "legacy_reviewed",
): ComposerCore {
  return {
    scenario_id: scenarioId,
    speech_act: "request",
    learner_level: "intermediate",
    domain: "school",
    mode: "translation",
    theme_code: "campus_study",
    topic_code: "test_topic",
    mission_status: missionStatus,
    release_gate_mode: releaseGateMode,
    target_feature:
      missionStatus === null ? null : "request_mitigation_optionality",
    situation_ko: situation,
    source_text_ko: "테스트 원문",
    direction: "ko_zh",
  };
}

function assignment(
  weekNo: number,
  scenarioId: string,
  position: number,
): WeekAssignment {
  return {
    week_no: weekNo,
    scenario_id: scenarioId,
    position,
    slot_role: "primary",
  };
}

function source(
  assignments: WeekAssignment[],
  cores: ComposerCore[],
): LearnerCourseSource {
  return { outline, weeks, assignments, cores };
}

describe("학습자 편성 강좌 조립", () => {
  it("reviewed 미션만 원래 주차·순서대로 노출한다", () => {
    const course = assembleLearnerCourse(
      source(
        [
          assignment(2, "reviewed-1", 0),
          assignment(2, "generated", 1),
          assignment(2, "reviewed-2", 2),
          assignment(3, "core-only", 0),
        ],
        [
          core("reviewed-1", "reviewed"),
          core("generated", "generated"),
          core("reviewed-2", "reviewed"),
          core("core-only", null),
        ],
      ),
    );

    expect(
      course.weeks[0].scenarios.map((scenario) => scenario.scenario_id),
    ).toEqual(["reviewed-1", "reviewed-2"]);
    expect(course.weeks[0].scenarios.every((scenario) => scenario.runnable)).toBe(
      true,
    );
    expect(course.weeks[1].scenarios).toEqual([]);
  });

  it("새 품질 게이트 자료는 내부 reviewed가 아니라 released 뒤에만 노출한다", () => {
    const course = assembleLearnerCourse(
      source(
        [assignment(2, "waiting", 0), assignment(2, "released", 1)],
        [
          core("waiting", "reviewed", "대기 상황", "expert_v1"),
          core("released", "released", "승인 상황", "expert_v1"),
        ],
      ),
    );

    expect(course.weeks[0].scenarios.map((scenario) => scenario.scenario_id)).toEqual(["released"]);
  });

  it("편성에는 있으나 조회되지 않은 코어를 학습자에게 누락 문구로 노출하지 않는다", () => {
    const course = assembleLearnerCourse(
      source([assignment(2, "missing", 0)], []),
    );

    expect(course.weeks[0].scenarios).toEqual([]);
    expect(JSON.stringify(course)).not.toContain("불러올 수 없는 시나리오");
  });

  it("제목이 없는 주차는 주차 번호 라벨을 사용한다", () => {
    const course = assembleLearnerCourse(source([], []));

    expect(course.weeks[1].title).toBe("3주차");
  });

  it("학습 노트에 필요한 Can-do와 주차 맥락을 학습자 강좌에 전달한다", () => {
    const course = assembleLearnerCourse(source([], []));

    expect(course.weeks[0]).toMatchObject({
      can_do: ["상황에 맞게 요청할 수 있다."],
      channel: "messenger",
      pdr_power: "equal",
      pdr_distance: "acquaintance",
      pdr_imposition: "low",
      review_released: true,
      competency_focus: "완화와 선택권",
      domain: "school",
    });
  });
});
