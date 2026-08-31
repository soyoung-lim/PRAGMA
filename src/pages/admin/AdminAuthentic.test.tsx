import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import AdminAuthentic from "./AdminAuthentic";

vi.mock("@/components/AdminShell", () => ({
  AdminShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));

vi.mock("./AuthenticImportPanel", () => ({
  AUTHENTIC_HANDOFF_KEY: "pragma:authentic-apply",
  default: ({ onApply }: { onApply: (value: unknown) => void }) => (
    <button type="button" onClick={() => onApply({ source_text: "확정 원문", provenance: { source_type: "authentic_text" } })}>
      후보 전달
    </button>
  ),
}));

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

describe("원자료 분석 독립 화면", () => {
  it("교수자가 고른 후보를 근거와 함께 생성기로 한 번 전달한다", () => {
    render(
      <MemoryRouter initialEntries={["/admin/authentic"]}>
        <Routes>
          <Route path="/admin/authentic" element={<AdminAuthentic />} />
          <Route path="/admin/generator" element={<p>생성기 도착</p>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("근거 확인·후보 선택")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "후보 전달" }));
    expect(screen.getByText("생성기 도착")).toBeVisible();
    expect(JSON.parse(sessionStorage.getItem("pragma:authentic-apply") ?? "null")).toMatchObject({
      source_text: "확정 원문",
      provenance: { source_type: "authentic_text" },
    });
  });
});
