import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import WeeklyLearningNote from "./WeeklyLearningNote";

const mocks = vi.hoisted(() => ({ course: vi.fn() }));
vi.mock("@/lib/curriculum/useLearnerCourse", () => ({ useLearnerCourse: mocks.course }));
vi.mock("@/components/learner/LearnerJourneyShell", () => ({ LearnerJourneyShell: ({ children }: { children: ReactNode }) => <main>{children}</main> }));

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("단일 주차 강의 유인물", () => {
  it.each([false, true])("기존 review_released=%s와 무관하게 공통 내용을 인쇄할 수 있다", (reviewReleased) => {
    mocks.course.mockReturnValue({ isPending: false, error: null, data: {
      outline: { id: "course-a", title: "검증용 교과목", level: "intermediate", language_direction: "ko_zh", course_mode: "translation", target_interpreting_week_count: 0 },
      weeks: [{ week_no: 5, title: "초대", type: "regular", speech_act: "agreement", can_do: ["저장된 주차 목표"], review_released: reviewReleased, scenarios: [] }],
    } });
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    render(<MemoryRouter initialEntries={["/learner/course/course-a/week/5/note"]}><Routes>
      <Route path="/learner/course/:courseId/week/:weekNo/note" element={<WeeklyLearningNote />} />
    </Routes></MemoryRouter>);

    expect(screen.getByText("저장된 주차 목표")).toBeVisible();
    expect(screen.getByText("참여 선택권과 약속 명료성")).toBeVisible();
    expect(screen.queryByText(/복습 자료|교수자 전용 메모|too_pressuring/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /주차로 돌아가기/ })).toHaveAttribute("href", "/learner/course/course-a/week/5");
    fireEvent.click(screen.getByRole("button", { name: "인쇄·PDF" }));
    expect(print).toHaveBeenCalledOnce();
  });
});
