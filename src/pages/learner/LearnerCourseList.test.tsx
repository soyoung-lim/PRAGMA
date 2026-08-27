import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CurriculumOutlineRow } from "@/lib/curriculum/types";
import { useLearnerCourses } from "@/lib/curriculum/useLearnerCourse";
import { COURSE_PRESETS } from "@/lib/pragma/scenarioTopics";
import LearnerCourseList from "@/pages/learner/LearnerCourseList";

vi.mock("@/lib/curriculum/useLearnerCourse", () => ({ useLearnerCourses: vi.fn() }));

const courses = COURSE_PRESETS.map((preset) => ({
  id: preset.outline_id,
  title: preset.label,
  level: preset.target_level,
  language_direction: preset.language_direction,
  domain: preset.primary_domain,
  course_mode: preset.course_mode,
  target_interpreting_week_count: preset.target_interpreting_week_count,
  composition_theme_codes: preset.included_themes,
  target_speech_acts: ["request", "thanks", "compliment"],
})) as CurriculumOutlineRow[];

function mockCourses(data: CurriculumOutlineRow[], error: Error | null = null, isPending = false) {
  vi.mocked(useLearnerCourses).mockReturnValue({
    data, error, isPending,
  } as ReturnType<typeof useLearnerCourses>);
}

function renderCourses() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <LearnerCourseList />
    </MemoryRouter>,
  );
}

beforeEach(() => mockCourses(courses));
afterEach(() => cleanup());

describe("LearnerCourseList", () => {
  it("shows student-facing introductions and omits curriculum inventory details", () => {
    renderCourses();

    expect(screen.getByRole("heading", { level: 1, name: "내 교과목" })).toBeInTheDocument();
    const list = within(screen.getByRole("list", { name: "교과목 목록" }));
    expect(list.getAllByRole("listitem")).toHaveLength(3);
    expect(list.getAllByText("중급")).toHaveLength(2);
    expect(list.getByText("고급")).toBeInTheDocument();
    expect(list.getAllByText("한→중")).toHaveLength(2);
    expect(list.getByText("중→한")).toBeInTheDocument();
    expect(list.getByText("상황과 관계를 읽고, 의도와 말투를 살려 중국어로 옮깁니다.")).toBeInTheDocument();
    expect(list.getByText("회의·협업·고객 응대에 필요한 중국어 표현과 전달 방식을 익힙니다.")).toBeInTheDocument();
    expect(list.getByText("중국어의 의도와 뉘앙스를 자연스러운 한국어로 옮깁니다.")).toBeInTheDocument();
    expect(list.queryByText(/15주|실제 학습|개 화행|번역 \d+주|통역 \d+주/)).not.toBeInTheDocument();
    expect(list.queryByText(/유학·국제교류|콘텐츠·SNS·플랫폼/)).not.toBeInTheDocument();
  });

  it("links each full-title card to its existing weekly plan", () => {
    renderCourses();

    const list = within(screen.getByRole("list", { name: "교과목 목록" }));
    expect(list.getAllByText("주차별 학습계획 보기")).toHaveLength(3);
    for (const course of courses) {
      const link = list.getByRole("link", { name: course.title });
      expect(link).toHaveAttribute("href", `/learner/course/${course.id}`);
      expect(link).toHaveAccessibleDescription();
      const title = within(link).getByRole("heading", { level: 2, name: course.title });
      expect(title).toHaveClass("sm:whitespace-nowrap", "break-keep");
      expect(title).not.toHaveClass("truncate");
    }
  });

  it.each([
    { state: "loading", pending: true, error: null, message: "교과목을 불러오는 중…" },
    { state: "empty", pending: false, error: null, message: "아직 게시된 교과목이 없습니다." },
    { state: "error", pending: false, error: new Error("교과목 조회 실패"), message: "교과목 조회 실패" },
  ])("preserves the $state state without inventing course cards", ({ pending, error, message }) => {
    mockCourses([], error, pending);
    renderCourses();

    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "교과목 목록" })).not.toBeInTheDocument();
  });
});
