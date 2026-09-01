import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import LoungeModulePage from "@/pages/learner/LoungeModulePage";

const renderModule = (module: string) => render(
  <MemoryRouter initialEntries={[`/learner/lounge/${module}`]}>
    <Routes>
      <Route path="/learner/lounge/:module" element={<LoungeModulePage />} />
      <Route path="/learner/lounge" element={<p>라운지 홈</p>} />
    </Routes>
  </MemoryRouter>,
);

describe("LoungeModulePage", () => {
  it("reveals decoder guidance in place after a choice", () => {
    renderModule("decode");
    expect(screen.getByRole("heading", { name: "해독실", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("1 / 10")).toBeVisible();
    expect(screen.getByText("你临场反应也太强了，666！")).toHaveClass("font-zh");
    fireEvent.click(screen.getByRole("button", { name: "발표를 6분 66초 동안 했네." }));
    expect(screen.getByText("정답")).toBeVisible();
    expect(screen.getByText("선택한 오답")).toBeVisible();
    expect(screen.getByText("한 줄 포인트")).toBeVisible();
    expect(screen.getByText("666은 온라인에서 ‘잘한다, 대박’이라는 감탄이에요.")).toBeVisible();
  });

  it("keeps verified facts and checked sources distinct in culture code", () => {
    renderModule("culture");
    fireEvent.click(screen.getByRole("button", { name: "춘절 귀성표 구하기가 너무 힘들어서 올해는 일찍 출발해야 할 것 같아." }));
    expect(screen.getByText("정답")).toBeVisible();
    expect(screen.getByText("한 줄 포인트")).toBeVisible();
    expect(screen.getByText("春运은 춘절 전후의 대규모 귀성 이동이에요.")).toBeVisible();
    expect(screen.getByText("확인한 출처")).toBeVisible();
  });

  it("asks literal-trap items as a positive translation choice", () => {
    renderModule("literal");
    expect(screen.getByRole("heading", { name: "가장 자연스럽게 옮긴 문장은?", level: 3 })).toBeVisible();
    expect(screen.getByText("明天我们在课上做小组报告。")).toHaveClass("font-zh");
    fireEvent.click(screen.getByRole("button", { name: "明天我们在课上做小组报告。" }));
    expect(screen.getByText("정답")).toBeVisible();
  });

  it("redirects retired or unknown module ids to the lounge home", () => {
    renderModule("theater");
    expect(screen.getByText("라운지 홈")).toBeVisible();
  });
});
