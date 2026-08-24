// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { SAMPLE_MISSION_V4 } from "@/lib/mission/missionV4Sample";
import { MpjStage } from "@/pages/learner/LegacyMissionRun";

function operationalReasonItem() {
  const item = SAMPLE_MISSION_V4.mpj_items.find((candidate) => candidate.type === "reason");
  if (!item || item.type !== "reason") throw new Error("Operational reason item is missing");
  return item;
}

describe("LegacyMissionRun operational reason flow", () => {
  it("locks the initial band before reasons and emits independent structured traces", () => {
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
    const item = operationalReasonItem();
    const onDone = vi.fn();

    render(
      <MpjStage
        item={item}
        mode="translation"
        sequentialFix
        isLastItem={false}
        stickyContentTop={80}
        onDone={onDone}
      />,
    );

    expect(screen.queryByRole("radiogroup", { name: /가장 큰 이유 하나/ })).not.toBeInTheDocument();

    const judgment = screen.getByRole("button", { name: /너무 직접적/ });
    fireEvent.click(judgment);
    fireEvent.click(screen.getByRole("button", { name: "이 판단으로 정하기" }));

    expect(judgment).toBeDisabled();
    expect(screen.getByRole("radiogroup", { name: /가장 큰 이유 하나/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "이유 확인하기" })).toBeDisabled();

    const acceptedReason = item.reasons.find((reason) => reason.id === item.accepted_reason_id);
    if (!acceptedReason) throw new Error("Accepted operational reason is missing");
    fireEvent.click(screen.getByRole("radio", { name: acceptedReason.text_ko }));
    fireEvent.click(screen.getByRole("button", { name: "이유 확인하기" }));
    fireEvent.click(screen.getByRole("button", { name: "다음 예시로 →" }));

    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({
      item_id: item.id,
      item_type: "reason",
      band_code: item.problem_band_code,
      reason_id: item.accepted_reason_id,
      reason_kind: "primary",
    }));
    expect(onDone.mock.calls[0][0]).not.toHaveProperty("confidence");
  });
});
