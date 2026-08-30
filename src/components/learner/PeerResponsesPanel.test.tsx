// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PeerResponsesPanel } from "./PeerResponsesPanel";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/mission/classResponseRelease", () => ({ getLearnerPeerResponses: mocks.get }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mount = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <PeerResponsesPanel courseId="856d51f6-5d13-4795-80fa-e91919131881" missionId="mission-1" enabled learnerChoices={{ "1:적절성 판단": ["somewhat_appropriate"] }} />
  </QueryClientProvider>,
);

describe("동료 학습자 응답", () => {
  it("공개 전과 최소 인원 미달을 구분한다", async () => {
    mocks.get.mockResolvedValue({ state: "minimum_not_met", learnerCount: 4 });
    mount();
    expect(await screen.findByText("아직 집계 중입니다.")).toBeVisible();
    expect(screen.getByText(/5명 이상/)).toBeVisible();
  });

  it("공개 후 익명 분포에서 내 선택을 표시한다", async () => {
    mocks.get.mockResolvedValue({
      state: "released",
      learnerCount: 6,
      releasedAt: "2026-08-30T10:00:00Z",
      pattern: {
        missionId: "mission-1",
        learners: 6,
        dissents: 0,
        items: [{
          itemId: 1,
          title: "판단 1 · 첫인상 판단",
          targetPreview: null,
          groups: [{ heading: "적절성 판단", total: 6, choices: [
            { key: "somewhat_appropriate", label: "다소 적절", count: 4 },
            { key: "very_inappropriate", label: "매우 부적절", count: 2 },
          ] }],
        }],
      },
    });
    mount();
    expect(await screen.findByText("내 선택")).toBeVisible();
    expect(screen.getByText(/가장 많이 선택된 응답이 정답을 의미하지는 않습니다/)).toBeVisible();
  });
});
