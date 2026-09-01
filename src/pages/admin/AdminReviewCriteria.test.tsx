import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import AdminReviewCriteria from "@/pages/admin/AdminReviewCriteria";

describe("AdminReviewCriteria", () => {
  beforeEach(() => {
    vi.stubGlobal("crypto", webcrypto);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("presents generation as separate and quality inspection as exactly five stages", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/admin/review-criteria"]}>
        <AdminReviewCriteria />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "검수 기준·운영 프롬프트" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "품질 검사는 5단계입니다" })).toBeInTheDocument();
    expect(screen.getByText(/콘텐츠 생성은 이 검사에 앞선 제작 과정/)).toBeInTheDocument();
    expect(screen.getByText("생성·저장 선행 게이트 · 5단계 밖")).toBeInTheDocument();
    expect(screen.getByText(/R 규칙 검사 \+ production quality critic/)).toBeInTheDocument();

    const steps = container.querySelector("ol");
    expect(steps).not.toBeNull();
    expect(within(steps!).getAllByRole("listitem")).toHaveLength(5);
    for (const label of ["R 검사", "OpenAI 1차", "Claude 교차", "OpenAI 정리", "교수자 최종 승인"]) {
      expect(within(steps!).getByRole("heading", { name: label })).toBeInTheDocument();
    }
    expect(container.textContent).not.toContain("6단계");
  });

  it("separates the R catalogue, operational prompts and learner runtime feedback", () => {
    render(
      <MemoryRouter initialEntries={["/admin/review-criteria"]}>
        <AdminReviewCriteria />
      </MemoryRouter>,
    );

    expect(screen.getByText("R1–R33 전체 카탈로그 보기 · 33개 번호")).toBeInTheDocument();
    expect(screen.getByText("R22 retired")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "운영 검수 프롬프트 · 읽기 전용" })).toBeInTheDocument();
    expect(screen.getByText("학습자 실행 중 피드백 프롬프트 · 5단계 품질 검사 밖")).toBeInTheDocument();
  });
});
