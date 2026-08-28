import { describe, expect, it } from "vitest";
import type { LearnerCourseWeek } from "./learnerCourse";
import type { CurriculumOutlineRow } from "./types";
import { REFUSAL_TEACHING_CASE as teachingCase } from "./refusalTeachingCase";
import { weeklyInstructorContent } from "./weeklyInstructorContent";
import { buildWeeklyCourseMaterial } from "./weeklyMaterials";
import { buildWeeklyMaterialsHtml } from "@/lib/pragma/instructorGuideHtml";

const week = (): LearnerCourseWeek => ({
  week_no: 6, title: "거절", type: "regular", speech_act: "refusal", can_do: [],
  channel: "messenger", pdr_power: "equal", pdr_distance: "formal", pdr_imposition: "low",
  review_released: false, competency_focus: null, domain: "daily",
  scenarios: [{ scenario_id: teachingCase.scenarioId, speech_act: "refusal", mode: "translation",
    situation_ko: teachingCase.situationKo, source_text: teachingCase.sourceText,
    mission_status: "reviewed", target_feature: "refusal_softening", runnable: true }],
});

describe("편성 거절 미션 한 건의 교수자 연결 설명", () => {
  it("현재 상황·원문이 일치하는 미션에만 기존 검수 원본으로 포함한다", () => {
    const assigned = week();
    const before = structuredClone(assigned);
    expect(weeklyInstructorContent(assigned, "ko_zh").missionCases).toEqual([teachingCase]);
    expect(assigned).toEqual(before);
  });

  it.each([
    { scenario_id: "another-refusal" }, { situation_ko: "새 상황" }, { source_text: "새 원문" },
    { speech_act: "request" as const }, { mode: "stt_interpreting" as const },
  ])("대상 미션의 조건이 달라지면 이전 사례를 재사용하지 않는다: %j", (change) => {
    const assigned = week();
    Object.assign(assigned.scenarios[0], change);
    expect(weeklyInstructorContent(assigned, "ko_zh")).not.toHaveProperty("missionCases");
  });

  it("중→한·다른 화행 주차·미편성에는 빈 속성도 추가하지 않는다", () => {
    expect(weeklyInstructorContent(week(), "zh_ko")).not.toHaveProperty("missionCases");
    expect(weeklyInstructorContent({ ...week(), speech_act: "request" }, "ko_zh")).not.toHaveProperty("missionCases");
    expect(weeklyInstructorContent({ ...week(), scenarios: [] }, "ko_zh")).not.toHaveProperty("missionCases");
  });

  it("실제 저장 상황 전체를 본문·HTML에 보존하되 연결 설명·참고 답안은 제외한다", () => {
    const outline = { id: "course", title: "수업", level: "intermediate", language_direction: "ko_zh", course_mode: "translation", target_interpreting_week_count: 0 } as CurriculumOutlineRow;
    const material = buildWeeklyCourseMaterial(outline, week());
    const html = buildWeeklyMaterialsHtml(material);
    expect(material.sections.find((section) => section.id === `mission-${teachingCase.scenarioId}`)?.paragraphs).toEqual([teachingCase.situationKo]);
    expect(html).toContain(teachingCase.situationKo);
    expect(html).toContain(teachingCase.sourceText);
    for (const output of [JSON.stringify(material), html]) {
      expect(output).not.toContain(teachingCase.title);
      expect(output).not.toContain(teachingCase.referenceText);
      expect(output).not.toContain(teachingCase.boundaries[0].text);
      expect(output).not.toContain(teachingCase.literature.examples[1]);
    }
    expect(material.preparationLabel).toContain("1/2개");
  });
});
