// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SAMPLE_MISSION_V5, SAMPLE_MISSION_V5_NATIVE } from "@/lib/mission/missionV4Sample";

const scenarioId = "86d738b0-1891-4bfe-9b12-f8643ebbb45f";
const { fetchMissionByScenario } = vi.hoisted(() => ({
  fetchMissionByScenario: vi.fn(),
}));

vi.mock("@/lib/mission/missionDb", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/mission/missionDb")>();
  return { ...original, fetchMissionByScenario };
});

vi.mock("@/lib/mission/missionFeedback", () => ({ requestFeedback: vi.fn() }));
vi.mock("@/lib/mission/missionLog", () => ({ saveMissionAttempt: vi.fn() }));

import CanonicalMissionRun, {
  buildRuntimeMpjTraces,
  feedbackNeedsRevision,
} from "@/pages/learner/CanonicalMissionRun";

describe("CanonicalMissionRun live CTA route", () => {
  beforeEach(() => {
    window.scrollTo = vi.fn();
    fetchMissionByScenario.mockResolvedValue({
      scenario_id: scenarioId,
      speech_act: "request",
      learner_level: "intermediate",
      mission_status: "reviewed",
      release_gate_mode: "legacy_reviewed",
      direction: "ko_zh",
      mission: SAMPLE_MISSION_V5,
    });
  });

  it("shows the live scenario intro before entering the five-judgment screen", async () => {
    render(
      <MemoryRouter initialEntries={[`/learner/practice/${scenarioId}`]}>
        <Routes>
          <Route path="/learner/practice/:scenarioId" element={<CanonicalMissionRun />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: SAMPLE_MISSION_V5.production_task.situation_ko })).toBeInTheDocument();
    expect(screen.getByText("요청 표현 · 한국어 → 중국어")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "상황에 맞는 표현 판단하기" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /장면 속 단서 보기/ }));
    expect(screen.getByText(/채널은 위챗이고/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /내가 할 일 확인/ }));
    expect(screen.getByRole("heading", { name: "어떤 중국어 요청 표현이 이 장면에 어울릴까요?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /5개 장면으로 감 잡기/ }));

    expect(await screen.findByRole("heading", { name: "상황에 맞는 표현 판단하기" })).toBeInTheDocument();
    expect(screen.getByText(SAMPLE_MISSION_V5.mpj_items[0].situation_ko)).toBeInTheDocument();
    expect(fetchMissionByScenario).toHaveBeenCalledWith(scenarioId);
  });

  it("does not force a revision when automatic feedback is unavailable", () => {
    expect(feedbackNeedsRevision({
      available: false,
      criteria: [
        { key: "meaning", label: "의미 전달", question: "", level: "recommend", body: "판정 불가" },
      ],
    })).toBe(false);
  });

  it("stores five native MPJ items as five independent traces", () => {
    const traces = buildRuntimeMpjTraces({
      scenario_id: scenarioId,
      speech_act: "request",
      learner_level: "intermediate",
      mission_status: "reviewed",
      release_gate_mode: "authoritative_release",
      direction: "ko_zh",
      mission: SAMPLE_MISSION_V5_NATIVE,
    }, {
      A1: { pick: "somewhat_appropriate" },
      A2: { pick: "too_direct" },
      A3: { judgment: "too_direct", correctionIds: ["A3-0", "A3-1"] },
      A4: { reasonId: "r2" },
      A5: { best: "A5-1", worst: "A5-4" },
    } as Parameters<typeof buildRuntimeMpjTraces>[1]);

    expect(traces).toMatchObject([
      { item_id: 1, item_type: "scale4", scale_code: "somewhat_appropriate" },
      { item_id: 2, item_type: "judge3", band_code: "too_direct" },
      { item_id: 3, item_type: "fix_choice", band_code: "too_direct", correction_indexes: [0, 1] },
      { item_id: 4, item_type: "reason", reason_id: "r2", reason_kind: "primary" },
      { item_id: 5, item_type: "multi_judge", best_candidate_index: 1, worst_candidate_index: 4 },
    ]);
  });
});
