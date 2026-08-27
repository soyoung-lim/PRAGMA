import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SAMPLE_MISSION_V5_NATIVE } from "@/lib/mission/missionV4Sample";
import { buildInstructorMissionGuide } from "@/lib/pragma/instructorGuide";
import AdminTeachingMaterials from "./AdminTeachingMaterials";

const mocks = vi.hoisted(() => ({ outlines: vi.fn(), curriculum: vi.fn(), cores: vi.fn(), assignments: vi.fn(), from: vi.fn(), missionRows: vi.fn() }));
vi.mock("@/lib/curriculum/api", () => ({ listCurriculumOutlines: mocks.outlines, getCurriculumOutline: mocks.curriculum }));
vi.mock("@/lib/curriculum/composer", () => ({ listCoreScenarios: mocks.cores, listWeekAssignments: mocks.assignments }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
vi.mock("@/components/AdminShell", () => ({ AdminShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));

const outline = { id: "course-a", title: "주차 자료 테스트", level: "intermediate", language_direction: "ko_zh", course_mode: "translation", target_interpreting_week_count: 0, status: "published" };
const courseWeeks = [2, 3].map((week_no) => ({ id: `week-${week_no}`, outline_id: outline.id, week_no, title: `${week_no}주차 요청`, type: "regular", can_do: [`${week_no}주차 목표`], speech_act: "request", review_released: false }));
const guide = buildInstructorMissionGuide(SAMPLE_MISSION_V5_NATIVE, "요청");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.outlines.mockResolvedValue([outline]);
  mocks.curriculum.mockResolvedValue({ outline, weeks: courseWeeks });
  mocks.assignments.mockResolvedValue([{ week_no: 2, scenario_id: "mission-1", position: 0 }]);
  mocks.cores.mockResolvedValue([{ scenario_id: "mission-1", mission_status: "reviewed", mode: "translation", situation_ko: "테스트 실습 상황입니다.", target_feature: "request_mitigation_optionality" }]);
  mocks.from.mockReturnValue({ select: () => ({ in: mocks.missionRows }) });
  mocks.missionRows.mockResolvedValue({ data: [{ scenario_id: "mission-1", speech_act: "request", mission_status: "reviewed", mission_content: SAMPLE_MISSION_V5_NATIVE }], error: null });
});
afterEach(cleanup);

function mount(weekNo = 2) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[`/admin/package?courseId=course-a&weekNo=${weekNo}`]}><AdminTeachingMaterials /></MemoryRouter></QueryClientProvider>);
}

describe("교과목·주차 수업자료 연결", () => {
  it("공통 자료에는 해설을 조회하지 않고 교수자 메모에서만 조회한다", async () => {
    mount();
    await screen.findByText("2주차 목표");
    expect(mocks.from).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "교수자 전용 메모" }));
    const notes = await screen.findByRole("region", { name: "교수자 전용 메모" });
    await waitFor(() => expect(notes.textContent).toContain(guide.dct.alternatives[0].text));
    expect(mocks.missionRows).toHaveBeenCalledWith("scenario_id", ["mission-1"]);

    fireEvent.click(screen.getByRole("button", { name: "프로젝터 화면" }));
    const projector = screen.getByRole("dialog", { name: "주차 프로젝터" });
    expect(screen.queryByRole("region", { name: "교수자 전용 메모" })).not.toBeInTheDocument();
    expect(projector.textContent).not.toContain(guide.dct.alternatives[0].text);
    expect(within(projector).getByText("이번 주 학습목표")).toBeVisible();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(within(projector).getByText("이번 주 학습목표")).not.toBeVisible();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "교수자 전용 메모" })).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
  });

  it("미편성 주차는 계획 미리보기로 열리고 이전 주차 메모를 가져오지 않는다", async () => {
    mount();
    await screen.findByText("2주차 목표");
    fireEvent.click(screen.getByRole("button", { name: "교수자 전용 메모" }));
    await waitFor(() => expect(mocks.missionRows).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByRole("combobox", { name: "수업자료 주차" }), { target: { value: "3" } });
    await screen.findByText("3주차 목표");
    expect(screen.queryByRole("region", { name: "교수자 전용 메모" })).not.toBeInTheDocument();
    expect(screen.getByText("계획 미리보기 · 미션 0/2개 편성")).toBeInTheDocument();
    expect(mocks.missionRows).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "프로젝터 화면" })).toBeEnabled();
  });
});
