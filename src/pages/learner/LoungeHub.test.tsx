import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import LoungeHub from "@/pages/learner/LoungeHub";

describe("LoungeHub", () => {
  it("presents three optional modules without promoting catalog size", () => {
    render(<MemoryRouter initialEntries={["/learner/lounge"]}><LoungeHub /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "가볍게 둘러보기", level: 1 })).toBeVisible();
    expect(screen.getByRole("heading", { name: "해독실" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "문화코드" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "직역 함정" })).toBeVisible();
    expect(screen.queryByText(/10개 사례 보기/)).not.toBeInTheDocument();
  });
});
