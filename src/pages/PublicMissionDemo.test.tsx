// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({ load: vi.fn(), feedback: vi.fn(), save: vi.fn(), event: vi.fn() }));
vi.mock("@/lib/mission/missionDb", () => ({ fetchMissionByScenario: calls.load }));
vi.mock("@/lib/mission/missionFeedback", () => ({ requestFeedback: calls.feedback }));
vi.mock("@/lib/mission/missionLog", () => ({ saveMissionAttempt: calls.save }));
vi.mock("@/lib/mission/missionEvents", async (original) => ({
  ...await original<typeof import("@/lib/mission/missionEvents")>(), appendMissionEvent: calls.event,
}));

import PublicMissionDemo from "./PublicMissionDemo";

describe("public mission example", () => {
  it("opens the actual learner UI with a bundled example without loading private content or recording an attempt", () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    render(<MemoryRouter><PublicMissionDemo /></MemoryRouter>);
    expect(screen.getByText("공개 예시 · 예시 피드백 · 서버에 답안 저장 안 됨")).toBeVisible();
    expect(screen.queryByText("DEV PREVIEW")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /장면 속 단서 보기/ }));
    fireEvent.click(screen.getByRole("button", { name: /내가 할 일 확인/ }));
    fireEvent.click(screen.getByRole("button", { name: /5개 장면으로 감 잡기/ }));
    expect(screen.getByRole("heading", { name: "상황에 맞는 표현 판단하기" })).toBeVisible();
    for (const call of Object.values(calls)) expect(call).not.toHaveBeenCalled();
  });
});
