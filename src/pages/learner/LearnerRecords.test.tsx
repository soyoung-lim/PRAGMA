import type { ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LearnerRecords from "./LearnerRecords";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getPublishedCourse: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
  getSessions: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: mocks.getSession }, from: mocks.from },
}));
vi.mock("@/lib/curriculum/learnerCourse", () => ({ getPublishedCourse: mocks.getPublishedCourse }));
vi.mock("@/lib/learningSessions", () => ({ getSessions: mocks.getSessions }));
vi.mock("@/components/learner/LearnerJourneyShell", () => ({
  LearnerJourneyShell: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/components/learner/LearnerBottomNav", () => ({ LearnerBottomNav: () => <nav /> }));

const ownLog = {
  id: "own-log", speech_act: "request", task_type: "translation",
  first_response: "请确认时间。", revised_response: "如果方便，请确认时间。",
  revision_target_selected: "feature", completed_at: "2026-09-05T10:00:00Z",
  created_at: "2026-09-05T10:00:00Z",
};

function renderReport() {
  return render(<MemoryRouter><LearnerRecords /></MemoryRouter>);
}

function completionValue() {
  return within(screen.getByRole("region", { name: "수업 이수 범위" }))
    .getByText("완료 학습 기록").previousElementSibling?.textContent;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("location", new URL("https://pragma.up.railway.app/learner/records"));
  localStorage.clear();
  localStorage.setItem("dev-learner-id", "local");
  localStorage.setItem("learner-progress:local:v1", JSON.stringify({ practiceCount: 7 }));
  mocks.getSession.mockResolvedValue({ data: { session: { user: { id: "current-user" } } }, error: null });
  mocks.getPublishedCourse.mockResolvedValue(null);
  mocks.from.mockReturnValue(mocks);
  mocks.select.mockReturnValue(mocks);
  mocks.eq.mockReturnValue(mocks);
  mocks.order.mockResolvedValue({ data: [], error: null });
  mocks.getSessions.mockReturnValue([{
    session_id: "local-preview", speech_act: "request", mode: "translation",
    selected_translation: "A", ai_translations: { A: "请确认。", B: "", C: "" },
    final_translation: "请确认时间。", timestamp: "2026-09-01T00:00:00Z",
  }]);
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("learner report record sources", () => {
  it("shows zero actual completions despite an old browser practice counter", async () => {
    renderReport();
    await screen.findByRole("region", { name: "수업 이수 범위" });
    expect(completionValue()).toBe("0");
    expect(mocks.getSessions).not.toHaveBeenCalled();
    expect(screen.queryByText("localhost 시연 데이터")).not.toBeInTheDocument();
  });

  it("waits for the remote result before showing any localhost preview or counts", async () => {
    vi.stubGlobal("location", new URL("http://localhost/learner/records"));
    let complete!: (value: { data: never[]; error: null }) => void;
    mocks.order.mockReturnValue(new Promise((resolve) => { complete = resolve; }));
    renderReport();
    expect(screen.getByRole("status")).toHaveTextContent("학습 기록을 불러오는 중");
    expect(screen.queryByRole("region", { name: "수업 이수 범위" })).not.toBeInTheDocument();
    expect(screen.queryByText("localhost 시연 데이터")).not.toBeInTheDocument();
    await act(async () => { await Promise.resolve(); });
    await act(async () => { complete({ data: [], error: null }); });
    expect(screen.getByText("localhost 시연 데이터")).toBeInTheDocument();
    expect(completionValue()).toBe("1");
  });

  it("counts only the signed-in user's completed rows, even on localhost", async () => {
    vi.stubGlobal("location", new URL("http://127.0.0.1/learner/records"));
    mocks.order.mockResolvedValue({ data: [ownLog], error: null });
    renderReport();
    await screen.findByRole("region", { name: "수업 이수 범위" });
    expect(mocks.from).toHaveBeenCalledWith("learner_mission_logs");
    expect(mocks.eq).toHaveBeenCalledWith("auth_user_id", "current-user");
    expect(mocks.eq).toHaveBeenCalledWith("mission_completed", true);
    expect(completionValue()).toBe("1");
    expect(screen.queryByText("localhost 시연 데이터")).not.toBeInTheDocument();
    expect(screen.getByText(ownLog.revised_response)).toBeInTheDocument();
  });

  it("keeps a failed query distinct from no records and allows retry", async () => {
    vi.stubGlobal("location", new URL("http://localhost/learner/records"));
    mocks.order.mockResolvedValueOnce({ data: null, error: { message: "network error" } });
    renderReport();
    expect(await screen.findByRole("alert")).toHaveTextContent("학습 기록을 불러오지 못했습니다");
    expect(screen.queryByRole("region", { name: "수업 이수 범위" })).not.toBeInTheDocument();
    expect(screen.queryByText("localhost 시연 데이터")).not.toBeInTheDocument();
    mocks.order.mockResolvedValue({ data: [ownLog], error: null });
    fireEvent.click(screen.getByRole("button", { name: "다시 불러오기" }));
    await screen.findByRole("region", { name: "수업 이수 범위" });
    expect(completionValue()).toBe("1");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each(["response", "rejection"])("shows an auth %s failure without inventing an empty report", async (kind) => {
    if (kind === "response") mocks.getSession.mockResolvedValue({ data: { session: null }, error: { message: "auth error" } });
    else mocks.getSession.mockRejectedValue(new Error("auth unavailable"));
    renderReport();
    await screen.findByRole("alert");
    expect(mocks.from).not.toHaveBeenCalled();
    expect(screen.queryByRole("region", { name: "수업 이수 범위" })).not.toBeInTheDocument();
  });
});
