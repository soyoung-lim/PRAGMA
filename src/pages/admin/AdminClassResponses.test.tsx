import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { SAMPLE_MISSION_V5_NATIVE } from "@/lib/mission/missionV4Sample";
import AdminClassResponses from "./AdminClassResponses";

const mocks = vi.hoisted(() => ({
  outlines: vi.fn(),
  curriculum: vi.fn(),
  assignments: vi.fn(),
  cores: vi.fn(),
  from: vi.fn(),
  logRows: vi.fn(),
  missionRow: vi.fn(),
}));

vi.mock("@/lib/curriculum/api", () => ({
  listCurriculumOutlines: mocks.outlines,
  getCurriculumOutline: mocks.curriculum,
}));
vi.mock("@/lib/curriculum/composer", () => ({
  listCoreScenarios: mocks.cores,
  listWeekAssignments: mocks.assignments,
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
vi.mock("@/components/AdminShell", () => ({
  AdminShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));

const outline = {
  id: "course-a",
  title: "응답 보드 테스트",
  level: "intermediate",
  language_direction: "ko_zh",
  course_mode: "translation",
  target_interpreting_week_count: 0,
  status: "published",
};
const weeks = [{
  id: "week-2",
  outline_id: outline.id,
  week_no: 2,
  title: "요청",
  type: "regular",
  can_do: ["요청 표현을 판단한다"],
  speech_act: "request",
  review_released: false,
}];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.outlines.mockResolvedValue([outline]);
  mocks.curriculum.mockResolvedValue({ outline, weeks });
  mocks.assignments.mockResolvedValue([{ week_no: 2, scenario_id: "mission-1", position: 0 }]);
  mocks.cores.mockResolvedValue([{
    scenario_id: "mission-1",
    mission_status: "reviewed",
    mode: "translation",
    situation_ko: "거래처에 자료를 다시 요청하는 상황",
    target_feature: "request_mitigation_optionality",
  }]);
  mocks.logRows.mockResolvedValue({
    data: [
      {
        mission_id: "mission-1",
        profile_id: "private-learner-a",
        completed_at: "2026-08-30T10:00:00Z",
        context_judgment: {
          schema_version: "mpj_response_v2",
          responses: [{ item_id: 1, item_type: "scale4", scale_code: "somewhat_appropriate" }],
          learner_dissent: null,
        },
      },
      {
        mission_id: "mission-1",
        profile_id: "private-learner-b",
        completed_at: "2026-08-30T10:05:00Z",
        context_judgment: {
          schema_version: "mpj_response_v2",
          responses: [{ item_id: 1, item_type: "scale4", scale_code: "very_inappropriate" }],
          learner_dissent: { reason_ko: "private dissent" },
        },
      },
    ],
    error: null,
  });
  mocks.missionRow.mockResolvedValue({ data: { mission_content: SAMPLE_MISSION_V5_NATIVE }, error: null });
  mocks.from.mockImplementation((table: string) => ({
    select: () => table === "learner_mission_logs"
      ? { eq: mocks.logRows }
      : { eq: () => ({ maybeSingle: mocks.missionRow }) },
  }));
});

afterEach(cleanup);

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/admin/class-responses?courseId=course-a&weekNo=2&missionId=mission-1"]}>
        <AdminClassResponses />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("실시간 학급 응답", () => {
  it("교과목·주차·미션의 실제 완료 응답을 익명 집계한다", async () => {
    mount();
    expect(await screen.findByText("응답 2명 · 이견 제기 1건")).toBeVisible();
    expect(screen.getByRole("combobox", { name: "응답 교과목" })).toHaveValue("course-a");
    expect(screen.getByRole("combobox", { name: "응답 주차" })).toHaveValue("2");
    expect(screen.getByRole("combobox", { name: "응답 미션" })).toHaveValue("mission-1");
    expect(screen.queryByText(/private-learner/)).not.toBeInTheDocument();
    expect(screen.queryByText(/private dissent/)).not.toBeInTheDocument();
  });

  it("예시 데이터로 전환하고 크게 볼 수 있다", async () => {
    mount();
    await screen.findByText("응답 2명 · 이견 제기 1건");
    fireEvent.click(screen.getByRole("button", { name: "예시 데이터 보기" }));
    expect(await screen.findByText("응답 12명 · 이견 제기 2건")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "크게 보기" }));
    expect(screen.getByRole("dialog", { name: "학급 응답 크게 보기" })).toBeVisible();
    expect(screen.getByText("가장 많이 선택된 응답이 정답을 의미하지는 않습니다.")).toBeVisible();
  });
});

