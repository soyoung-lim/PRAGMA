import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { LearnerBottomNav } from "@/components/learner/LearnerBottomNav";

describe("LearnerBottomNav", () => {
  it("renders course, records, and lounge in the approved order", () => {
    render(<MemoryRouter initialEntries={["/learner/lounge/culture"]}><LearnerBottomNav /></MemoryRouter>);
    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.textContent?.trim())).toEqual(["수업", "기록", "라운지"]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/learner/course",
      "/learner/records",
      "/learner/lounge",
    ]);
    expect(screen.getByRole("link", { name: "라운지" })).toHaveClass("text-[#15202B]");
  });
});
