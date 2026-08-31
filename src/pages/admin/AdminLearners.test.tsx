import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import AdminLearners from "./AdminLearners";

const mocks = vi.hoisted(() => ({ order: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ order: mocks.order }),
      }),
    }),
  },
}));

vi.mock("@/components/AdminShell", () => ({
  AdminShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));

beforeEach(() => {
  mocks.order.mockResolvedValue({
    data: [
      {
        id: "profile-a",
        user_id: "user-a",
        full_name: "박정원",
        email: "auraweon7@gmail.com",
        affiliation: "교강사/연구자",
        affiliation_or_status: null,
        profile_completed: true,
        approval_status: "approved",
        anonymous_participant_id: "anon-a",
        updated_at: "2026-08-07T12:55:00Z",
        created_at: "2026-08-07T12:00:00Z",
        role: "learner",
      },
      {
        id: "profile-b",
        user_id: "user-b",
        full_name: "임소영",
        email: "learner@example.com",
        affiliation: "대학원생(박사)",
        affiliation_or_status: null,
        profile_completed: false,
        approval_status: "pending_approval",
        anonymous_participant_id: null,
        updated_at: "2026-08-07T12:55:00Z",
        created_at: "2026-08-07T12:00:00Z",
        role: "learner",
      },
    ],
    error: null,
  });
});

afterEach(cleanup);

describe("학습자 승인·관리 목록", () => {
  it("정보 길이에 맞춘 고정 열 비율과 정렬된 관리 동작을 표시한다", async () => {
    render(<MemoryRouter><AdminLearners /></MemoryRouter>);

    expect(await screen.findByText("박정원")).toBeVisible();
    expect(screen.getByText("교강사/연구자")).toBeVisible();
    expect(screen.getAllByText("승인 완료").find((node) => node.tagName === "DIV")).toHaveClass("bg-emerald-50");
    expect(screen.getByText("프로필 완료")).toBeVisible();
    expect(screen.getByText("익명 ID")).toBeVisible();

    const learnerCell = screen.getByText("박정원").closest("td");
    expect(learnerCell?.querySelector('[aria-hidden="true"]')).toBeNull();

    const table = screen.getByRole("table");
    expect(table).toHaveClass("table-fixed", "min-w-[860px]");
    expect(Array.from(table.querySelectorAll("col")).map((col) => col.style.width)).toEqual([
      "26%", "14%", "9%", "18%", "13%", "20%",
    ]);
    expect(screen.getAllByRole("link", { name: "수행 기록 →" })[0]).toHaveAttribute(
      "href",
      "/admin/decision-traces?q=auraweon7%40gmail.com",
    );
    expect(screen.getAllByRole("button", { name: "상세" })[0]).toBeVisible();
  });

  it("표 안에서 학습자·소속·세 가지 승인 상태를 필터링한다", async () => {
    render(<MemoryRouter><AdminLearners /></MemoryRouter>);
    expect(await screen.findByText("박정원")).toBeVisible();

    const statusFilter = screen.getByRole("combobox", { name: "상태 필터" });
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "전체", "승인 대기", "승인 완료", "반려 처리",
    ]);

    fireEvent.change(screen.getByRole("textbox", { name: "학습자 필터" }), {
      target: { value: "박정원" },
    });
    expect(screen.queryByText("임소영")).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "학습자 필터" }), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "소속 필터" }), {
      target: { value: "대학원생" },
    });
    expect(screen.queryByText("박정원")).not.toBeInTheDocument();
    expect(screen.getByText("임소영")).toBeVisible();

    fireEvent.change(screen.getByRole("textbox", { name: "소속 필터" }), {
      target: { value: "" },
    });
    fireEvent.change(statusFilter, { target: { value: "approved" } });
    expect(screen.getByText("박정원")).toBeVisible();
    expect(screen.queryByText("임소영")).not.toBeInTheDocument();
  });
});
