// @vitest-environment jsdom

import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CANONICAL_MISSION_PREVIEW, type DctFeedbackQuest } from "@/lib/mission/canonicalMissionPreview";
import { CompletionActions, CompletionRecord, DctFeedbackView, MissionDissentPanel } from "@/pages/learner/CanonicalMissionRun";

afterEach(() => vi.useRealTimers());

describe("CanonicalMissionRun completion connections", () => {
  it("collects optional dissent without changing the judgment", () => {
    const onSubmit = vi.fn();
    render(<MissionDissentPanel onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("button", { name: /피드백과 다르게 본 부분이 있다면/ }));
    expect(screen.getByRole("heading", { name: "피드백과 다르게 본 부분" })).toBeInTheDocument();

    const submit = screen.getByRole("button", { name: "의견 남기기" });
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "관계·친밀도에 대한 다른 판단" }));
    fireEvent.change(screen.getByPlaceholderText("한 줄 이유 (선택)"), {
      target: { value: "초면보다 이미 아는 사이에 가깝다고 보았습니다." },
    });
    fireEvent.click(submit);

    expect(onSubmit).toHaveBeenCalledWith({
      conditions: ["relationship"],
      reason: "초면보다 이미 아는 사이에 가깝다고 보았습니다.",
    });
    expect(screen.getByText(/판정은 그대로 유지되며/)).toBeInTheDocument();
  });

  it("links the preview completion to learner records without claiming persistence", () => {
    const onRestart = vi.fn();
    render(
      <MemoryRouter>
        <CompletionActions onRestart={onRestart} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "나의 학습 기록 보기" })).toHaveAttribute(
      "href",
      "/learner/records#correction-notes",
    );
    expect(screen.getByText(/답안과 의견은 DB에 저장되지 않습니다/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "처음부터 다시 보기" }));
    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  it("withholds reference answers until the learner has finalized the revision", () => {
    vi.useFakeTimers();
    const quest = CANONICAL_MISSION_PREVIEW.quests.find(
      (candidate): candidate is DctFeedbackQuest => candidate.kind === "dct_feedback",
    );
    if (!quest) throw new Error("DCT feedback fixture is missing");
    const first = "您好，下周二的面试我不能参加，可以调整时间吗？";
    const response = { first, revised: first, reflected: false };

    const { unmount } = render(<DctFeedbackView quest={quest} response={response} onDone={vi.fn()} />);
    act(() => vi.advanceTimersByTime(1300));
    for (const alternative of quest.feedback.alternatives) {
      expect(screen.queryByText(alternative.text)).not.toBeInTheDocument();
    }
    unmount();

    render(<CompletionRecord label="번역 실습" response={response} alternatives={quest.feedback.alternatives} />);
    for (const alternative of quest.feedback.alternatives) {
      expect(screen.getByText(alternative.text)).toBeInTheDocument();
    }
  });
});
