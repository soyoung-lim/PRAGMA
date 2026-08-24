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

  it("locks the judgment before exposing reasons and submits a reason id", () => {
    const quest = reasonQuest();
    const onDone = vi.fn();
    render(<ReasonView quest={quest} onDone={onDone} />);

    expect(screen.queryByRole("radiogroup", { name: /가장 큰 이유 하나/ })).not.toBeInTheDocument();

    const judgment = screen.getByRole("button", { name: "너무 직접적" });
    fireEvent.click(judgment);
    fireEvent.click(screen.getByRole("button", { name: "이 판단으로 정하기" }));

    expect(judgment).toBeDisabled();
    expect(screen.getByRole("radiogroup", { name: /가장 큰 이유 하나/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "이유 확인하기" })).toBeDisabled();

    const acceptedReason = quest.reasons.find((reason) => reason.id === quest.acceptedReasonId);
    if (!acceptedReason) throw new Error("Accepted reason is missing");
    fireEvent.click(screen.getByRole("radio", { name: acceptedReason.text }));
    fireEvent.click(screen.getByRole("button", { name: "이유 확인하기" }));

    expect(screen.getByText(/맞아요 · 참고 판정은 너무 직접적/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /다음: BEST·WORST 고르기/ }));

    expect(onDone).toHaveBeenCalledWith({
      judgment: quest.referenceJudgment,
      reasonId: quest.acceptedReasonId,
    });
    expect(onDone.mock.calls[0][0]).not.toHaveProperty("reasonNote");
    expect(onDone.mock.calls[0][0]).not.toHaveProperty("confidence");
  });
});
