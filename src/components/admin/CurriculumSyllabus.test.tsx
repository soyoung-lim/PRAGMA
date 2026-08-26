import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CurriculumSyllabus } from "@/components/admin/CurriculumSyllabus";
import type { ComposerCore } from "@/lib/curriculum/composer";
import type { AssignMap } from "@/lib/curriculum/composerPlanning";
import type { CurriculumOutlineRow, CurriculumWeekRow } from "@/lib/curriculum/types";

const outline = {
  id: "outline-1",
  title: "화행 기반 한중 번역",
  semester_goal: "맥락에 맞는 화행 번역을 수행한다.",
  level: "intermediate",
  language_direction: "ko_zh",
  course_mode: "translation",
  week_count: 15,
  scenarios_per_week: 2,
  domain: "daily",
  target_speech_acts: ["request"],
} as CurriculumOutlineRow;

const weeks = [
  {
    id: "week-1",
    week_no: 1,
    type: "regular",
    title: "요청",
    speech_act: "request",
    can_do: ["관계와 부담에 맞는 요청을 번역할 수 있다."],
  },
] as CurriculumWeekRow[];

const assignments: AssignMap = {
  1: [
    { scenario_id: "scenario-a", slot_role: "A" },
    { scenario_id: "scenario-b", slot_role: "B" },
  ],
};

const coreById = {
  "scenario-a": { scenario_id: "scenario-a", mode: "translation", situation_ko: "교수자에게 기한 연장을 요청한다." },
  "scenario-b": { scenario_id: "scenario-b", mode: "translation", situation_ko: "친구에게 도움을 요청한다." },
} as unknown as Record<string, ComposerCore>;

describe("CurriculumSyllabus", () => {
  it("projects the current course and both weekly mission sets without inventing policy", () => {
    render(
      <CurriculumSyllabus
        outline={outline}
        weeks={weeks}
        assignments={assignments}
        coreById={coreById}
      />,
    );

    expect(screen.getByRole("heading", { name: outline.title })).toBeInTheDocument();
    expect(screen.getByText(/교수자에게 기한 연장을 요청한다/)).toBeInTheDocument();
    expect(screen.getByText(/친구에게 도움을 요청한다/)).toBeInTheDocument();
    expect(screen.getByText("평가 방법 · 교수자 기입")).toBeInTheDocument();
  });
});
