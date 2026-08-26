import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InstructorMissionGuide } from "@/components/admin/InstructorMissionGuide";
import { SAMPLE_MISSION_V5_NATIVE } from "@/lib/mission/missionV4Sample";
import { buildInstructorMissionGuide } from "@/lib/pragma/instructorGuide";
import { instructorGuideTimingPlan } from "@/lib/pragma/instructorGuideTiming";

const guide = buildInstructorMissionGuide(SAMPLE_MISSION_V5_NATIVE, "요청");

describe("InstructorMissionGuide output modes", () => {
  it("keeps reference material in the instructor document", () => {
    render(<InstructorMissionGuide guide={guide} timingPlan={instructorGuideTimingPlan(50)} />);

    expect(screen.getByText("PRAGMA 교수자 수업자료")).toBeInTheDocument();
    expect(screen.getByText("50분 · 미션 1세트 확장 운영")).toBeInTheDocument();
    expect(screen.getByText("총 50분")).toBeInTheDocument();
    expect(screen.getByText(guide.dct.alternatives[0].text)).toBeInTheDocument();
  });

  it("turns the same guide into an answer-free student worksheet", () => {
    render(<InstructorMissionGuide guide={guide} audience="student" />);

    expect(screen.getByText("PRAGMA 학생 활동지")).toBeInTheDocument();
    expect(screen.queryByLabelText("수업 시간 운영표")).not.toBeInTheDocument();
    expect(screen.getByText(/최초안을 작성하고, 최소 피드백을 받은 뒤 수정안/)).toBeInTheDocument();
    expect(screen.queryByText(guide.dct.alternatives[0].text)).not.toBeInTheDocument();
    expect(document.querySelector('[data-answer-state="revealed"]')).not.toBeInTheDocument();
  });

  it("withholds projector answers until the instructor reveals them", () => {
    const { rerender } = render(
      <InstructorMissionGuide guide={guide} displayMode="projector" activeStep={5} answersRevealed={false} />,
    );

    expect(screen.getByText("MPJ·DCT 수행자료 토론")).toBeInTheDocument();
    expect(screen.getByText(/먼저 학습자의 판단과 근거/)).toBeInTheDocument();
    expect(screen.queryByText(guide.dct.alternatives[0].text)).not.toBeInTheDocument();

    rerender(
      <InstructorMissionGuide guide={guide} displayMode="projector" activeStep={5} answersRevealed />,
    );
    expect(screen.getByText(guide.dct.alternatives[0].text)).toBeInTheDocument();
  });
});
