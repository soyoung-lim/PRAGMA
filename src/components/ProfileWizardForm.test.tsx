import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProfileWizardForm } from "./ProfileWizardForm";

const mocks = vi.hoisted(() => ({
  complete: vi.fn(),
  refresh: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/auth/useProfile", () => ({
  useProfile: () => ({ profile: null, isDevStub: true, refresh: mocks.refresh }),
  devStubCompleteProfile: mocks.complete,
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("학습자 프로필 입력", () => {
  it("이름·소속·주 사용 언어만 필수로 요구하고 나머지는 선택으로 둔다", async () => {
    render(<ProfileWizardForm />);

    fireEvent.change(screen.getByPlaceholderText("실명을 입력해 주세요"), {
      target: { value: "김학습" },
    });
    fireEvent.click(screen.getByRole("radio", { name: "대학원생(박사)" }));
    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    expect(screen.getByText(/주 사용 언어만 필수입니다/)).toBeVisible();
    expect(screen.getByText("학습 시작 수준").parentElement).toHaveTextContent("선택");
    expect(screen.queryByText("최근 HSK 급수")).not.toBeInTheDocument();
    expect(screen.getByText("한중 통번역 학습·수행 경험").parentElement).toHaveTextContent("선택");

    const submit = screen.getByRole("button", { name: "학습 시작하기" });
    expect(submit).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: "한국어" }));
    expect(screen.getByText("최근 HSK 급수").parentElement).toHaveTextContent("선택");
    expect(submit).toBeEnabled();

    fireEvent.click(submit);
    expect(mocks.complete).toHaveBeenCalledWith("김학습");
  });
});
