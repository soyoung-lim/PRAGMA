import { describe, expect, it } from "vitest";

import {
  createEmptyWeekDraft,
  weekDraftToInsert,
  weekRowToDraft,
} from "@/lib/curriculum/mappers";
import type { CurriculumWeekRow } from "@/lib/curriculum/types";

describe("커리큘럼 주차 복습 공개 매핑", () => {
  it("새 주차의 복습 자료는 기본 비공개다", () => {
    expect(createEmptyWeekDraft(2).review_released).toBe(false);
  });

  it("교수자 공개 상태를 DB 행과 저장 payload 사이에서 보존한다", () => {
    const row = {
      id: "week-2",
      outline_id: "outline-1",
      week_no: 2,
      type: "regular",
      title: "요청",
      can_do: [],
      speech_act: "request",
      channel: "messenger",
      pdr_power: "equal",
      pdr_distance: "acquaintance",
      pdr_imposition: "low",
      review_released: true,
      curriculum_load_band: null,
      competency_focus: null,
      domain: "school",
      industry: null,
      scenario_slots: 2,
      created_at: "2026-07-28T00:00:00.000Z",
      updated_at: "2026-07-28T00:00:00.000Z",
    } as CurriculumWeekRow;

    const draft = weekRowToDraft(row);
    expect(draft.review_released).toBe(true);
    expect(weekDraftToInsert(draft, row.outline_id).review_released).toBe(true);
  });
});
