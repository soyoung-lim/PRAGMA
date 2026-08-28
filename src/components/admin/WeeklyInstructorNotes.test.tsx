import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { WeeklyInstructorNotes } from "./WeeklyInstructorNotes";
import type { LearnerCourseWeek } from "@/lib/curriculum/learnerCourse";
import { REFUSAL_TEACHING_CASE as teachingCase } from "@/lib/curriculum/refusalTeachingCase";
import { buildInstructorMissionGuide } from "@/lib/pragma/instructorGuide";
import { SAMPLE_MISSION_V5_NATIVE } from "@/lib/mission/missionV4Sample";

afterEach(cleanup);

// 렌더링용 fixture. 실제 미션의 MJT 문항 구성·교수자 승인을 재현하는 데이터가 아니다.
const guide = () => ({ ...buildInstructorMissionGuide(SAMPLE_MISSION_V5_NATIVE, "거절"),
  situationKo: teachingCase.situationKo,
  dct: { situationKo: teachingCase.situationKo, sourceText: teachingCase.sourceText,
    alternatives: [{ text: teachingCase.referenceText, noteKo: "기존 참고 산출" }] },
});
const week = { week_no: 6, speech_act: "refusal", scenarios: [{
  scenario_id: teachingCase.scenarioId, speech_act: "refusal", mode: "translation",
  situation_ko: teachingCase.situationKo, source_text: teachingCase.sourceText,
}] } as LearnerCourseWeek;

describe("교수자 전용 거절 사례 연결", () => {
  it("해당 미션 안에서만 펼쳐 보고 기존 DCT 해설은 유지한다", () => {
    render(<WeeklyInstructorNotes week={week} direction="ko_zh" missions={[{ scenarioId: teachingCase.scenarioId, label: "미션 1", guide: guide() }]} />);
    expect(screen.getByText(teachingCase.status)).not.toBeVisible();
    fireEvent.click(screen.getByText("미션 1 · 거절"));
    fireEvent.click(screen.getByText(teachingCase.title));
    expect(screen.getByText(teachingCase.status)).toBeVisible();
    expect(screen.getByText(teachingCase.boundaries[0].text)).toBeVisible();
    expect(screen.getByText(teachingCase.evidenceLimit)).toBeVisible();
    fireEvent.click(screen.getByText("DCT · 참고 산출과 해설"));
    expect(screen.getByText(teachingCase.referenceText)).toBeVisible();
    expect(screen.queryByRole("button", { name: /승인|제출/ })).not.toBeInTheDocument();
  });

  it.each(["situation", "source", "reference"])("DCT %s가 바뀌면 연결 해설을 숨기고 확인을 요청한다", (changed) => {
    const revised = guide();
    if (changed === "situation") revised.situationKo = "바뀐 상황";
    if (changed === "source") revised.dct.sourceText = "바뀐 원문";
    if (changed === "reference") revised.dct.alternatives[0].text = "바뀐 참고 산출";
    render(<WeeklyInstructorNotes week={week} direction="ko_zh" missions={[{ scenarioId: teachingCase.scenarioId, label: "미션 1", guide: revised }]} />);
    expect(screen.queryByText(teachingCase.title)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("미션 1 · 거절"));
    expect(screen.getByText(/교수자 재확인 전 사례 설명을 표시하지 않습니다/)).toBeVisible();
  });
});
