import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ADMIN_NAV_GROUPS } from "@/lib/admin/adminNavigation";
import AdminQuestionDesigner from "./AdminQuestionDesigner";

vi.mock("@/components/AdminShell", () => ({
  AdminShell: ({
    title,
    description,
    children,
  }: {
    title: string;
    description?: string;
    children: React.ReactNode;
  }) => (
    <main>
      <h1>{title}</h1>
      <p>{description}</p>
      {children}
    </main>
  ),
}));

describe("AdminQuestionDesigner", () => {
  it("presents the current MJT5 plus DCT1 design", () => {
    render(<AdminQuestionDesigner />);

    expect(screen.getByRole("heading", { level: 1, name: "판단·산출 과제 설계" })).toBeInTheDocument();
    expect(screen.getByText("MJT 5개로 맥락별 판단을 연습하고, DCT 1개로 직접 산출하는 학습 구조입니다.")).toBeInTheDocument();
    expect(screen.getByText(/Metapragmatic Judgement Task/)).toBeInTheDocument();
    expect(screen.getByText(/Discourse Completion Task/)).toBeInTheDocument();
    expect(screen.getAllByText(/^MJT [1-5]$/)).toHaveLength(5);
    expect(screen.getByText("DCT 1")).toBeInTheDocument();
    expect(screen.getByText("맥락 대비 판단")).toBeInTheDocument();
    expect(screen.queryByText("적절성 판단 문항 4개")).not.toBeInTheDocument();
  });

  it("uses the approved label in the shared admin navigation", () => {
    const item = ADMIN_NAV_GROUPS
      .flatMap((group) => group.items)
      .find((candidate) => candidate.to === "/admin/question-designer");

    expect(item?.label).toBe("판단·산출 과제 설계");
  });
});
