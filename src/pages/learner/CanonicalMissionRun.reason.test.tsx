// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CANONICAL_MISSION_PREVIEW, type ReasonQuest } from "@/lib/mission/canonicalMissionPreview";
import { ReasonView } from "@/pages/learner/CanonicalMissionRun";

function reasonQuest(): ReasonQuest {
  const quest = CANONICAL_MISSION_PREVIEW.quests.find(
    (candidate): candidate is ReasonQuest => candidate.kind === "reason",
  );
  if (!quest) throw new Error("Reason preview quest is missing");
  return quest;
}

describe("CanonicalMissionRun reason flow", () => {
  it("keeps the canonical three-choice diagnostic contract", () => {
    const quest = reasonQuest();

    expect(quest.reasons).toHaveLength(3);
    expect(quest.reasons.map((reason) => reason.kind).sort()).toEqual([
      "meaning_grammar_context",
      "pragmatic_misconception",
      "primary",
    ]);
    expect(quest.reasons.find((reason) => reason.id === quest.acceptedReasonId)?.kind).toBe("primary");
  });

  it("locks the first judgment, reveals no reason explanation, then sends everyone to the reason choice", () => {
    const quest = reasonQuest();
    const onDone = vi.fn();
    render(<ReasonView quest={quest} onDone={onDone} />);

    expect(screen.getByText("이 표현은 이 상황에 적절한가요?")).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: /가장 큰 이유 하나/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "적절하다" }));
    fireEvent.click(screen.getByRole("button", { name: "판단 확인하기" }));

    expect(screen.getByRole("status")).toHaveTextContent("이 문항에서는 적절하지 않은 표현으로 판정합니다.");
    expect(screen.queryByText(quest.feedback)).not.toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: /가장 큰 이유 하나/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /이유 찾기/ }));
    expect(screen.getByText("그렇다면, 이 표현이 상황에 맞지 않는 가장 큰 이유는 무엇일까요?")).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: /가장 큰 이유 하나/ })).toBeInTheDocument();

    const acceptedReason = quest.reasons.find((reason) => reason.id === quest.acceptedReasonId);
    if (!acceptedReason) throw new Error("Accepted reason is missing");
    fireEvent.click(screen.getByRole("radio", { name: acceptedReason.text }));
    fireEvent.click(screen.getByRole("button", { name: "이유 확인하기" }));

    expect(screen.getByText("핵심 이유는 찾았어요")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /다음: 적정안·조정안 고르기/ }));

    expect(onDone).toHaveBeenCalledWith({
      initialJudgment: "appropriate",
      reasonId: quest.acceptedReasonId,
    });
    expect(onDone.mock.calls[0][0]).not.toHaveProperty("reasonNote");
    expect(onDone.mock.calls[0][0]).not.toHaveProperty("confidence");
  });

  it("shows only the short correct verdict before the reason stage", () => {
    const quest = reasonQuest();
    render(<ReasonView quest={quest} onDone={vi.fn()} />);

    fireEvent.click(screen.getByRole("radio", { name: "적절하지 않다" }));
    fireEvent.click(screen.getByRole("button", { name: "판단 확인하기" }));

    expect(screen.getByRole("status")).toHaveTextContent("맞아요. 이 상황에서는 조정이 필요한 표현입니다.");
    expect(screen.queryByText(quest.feedback)).not.toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: /가장 큰 이유 하나/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /이유 찾기/ }));
    expect(screen.getByRole("radiogroup", { name: /가장 큰 이유 하나/ })).toBeInTheDocument();
  });

  it.each([
    ["적절하지 않다", true, "판단과 이유가 모두 맞아요"],
    ["적절하지 않다", false, "판단 방향은 맞았어요"],
    ["적절하다", true, "핵심 이유는 찾았어요"],
    ["적절하다", false, "판단과 이유를 함께 다시 확인해요"],
  ])("shows the judgment × reason feedback for %s / accepted=%s", (judgmentLabel, accepted, verdict) => {
    const quest = reasonQuest();
    render(<ReasonView quest={quest} onDone={vi.fn()} />);

    fireEvent.click(screen.getByRole("radio", { name: judgmentLabel }));
    fireEvent.click(screen.getByRole("button", { name: "판단 확인하기" }));
    fireEvent.click(screen.getByRole("button", { name: /이유 찾기/ }));

    const reason = accepted
      ? quest.reasons.find((candidate) => candidate.id === quest.acceptedReasonId)
      : quest.reasons.find((candidate) => candidate.id !== quest.acceptedReasonId);
    if (!reason) throw new Error("Reason fixture is missing");
    fireEvent.click(screen.getByRole("radio", { name: reason.text }));
    fireEvent.click(screen.getByRole("button", { name: "이유 확인하기" }));

    expect(screen.getByText(verdict)).toBeInTheDocument();
  });
});
