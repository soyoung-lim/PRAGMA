import { describe, expect, it } from "vitest";

import {
  applyMissionRepairOperations,
  canPersistRepairQuality,
  repairFindingsForRuleViolations,
} from "./promoteMission";

describe("repairFindingsForRuleViolations", () => {
  it("keeps the first duplicate and repairs every later R27 item", () => {
    expect(repairFindingsForRuleViolations([{
      id: "R27",
      level: "fail",
      message: "v4 MPJ 문항 2·3·4의 situation_ko가 완전히 중복됨. 앵커 PDR은 유지하되 다시 만드세요",
    }])).toEqual([
      expect.objectContaining({
        code: "rule_R27_duplicate_situation",
        where: "mpj_items[2].situation_ko",
      }),
      expect.objectContaining({
        code: "rule_R27_duplicate_situation",
        where: "mpj_items[3].situation_ko",
      }),
    ]);
  });

  it("does not route invariant failures such as R5 to item repair", () => {
    expect(repairFindingsForRuleViolations([{
      id: "R5",
      level: "fail",
      message: "문항 5: 현행 MultiJudge는 앵커 PDR에서 한 축만 바꾼 대비 상황이어야 함",
    }])).toEqual([]);
  });

  it("routes item-local band and diagnostic failures to their allowed blocks", () => {
    expect(repairFindingsForRuleViolations([
      {
        id: "R18",
        level: "fail",
        message: "문항 4: reason problem_band_code가 적정 대역임",
      },
      {
        id: "R33",
        level: "fail",
        message: "현행 mission_v5는 서로 다른 진단차원을 2~6개 포함해야 함",
      },
    ])).toEqual([
      expect.objectContaining({ code: "rule_R18_item", where: "mpj_items[3]" }),
      expect.objectContaining({ code: "rule_R33_diagnostics", where: "diagnostic_dimensions" }),
    ]);
  });
});

describe("candidate-level mission repair", () => {
  it("changes only the targeted MJT3/MJT5 candidate and freezes answer metadata", () => {
    const original = {
      mpj_items: [
        { id: 1, type: "scale4" },
        { id: 2, type: "judge3" },
        {
          id: 3,
          type: "fix_choice",
          corrections: [
            { text: "fix-a", note_ko: "a", is_valid: true },
            { text: "fix-b", note_ko: "b", is_valid: false },
            { text: "fix-c", note_ko: "c", is_valid: false },
          ],
        },
        { id: 4, type: "reason" },
        {
          id: 5,
          type: "multi_judge",
          candidates: [
            { text: "multi-a", note_ko: "a", accepted_band_codes: ["within_band"] },
            { text: "multi-b", note_ko: "b", accepted_band_codes: ["too_low"] },
            { text: "multi-c", note_ko: "c", accepted_band_codes: ["within_band"] },
            { text: "multi-d", note_ko: "d", accepted_band_codes: ["too_high"] },
          ],
        },
      ],
      production_task: { reference_alternatives: [] },
    };

    const patched = applyMissionRepairOperations(original, [
      {
        operation: "replace_fix_choice_candidate",
        item_index: 2,
        candidate_index: 1,
        candidate: { text: "fix-b-new", note_ko: "b-new", is_valid: true },
      },
      {
        operation: "replace_multi_judge_candidate",
        item_index: 4,
        candidate_index: 3,
        candidate: { text: "multi-d-new", note_ko: "d-new", accepted_band_codes: ["within_band"] },
      },
    ]);

    const items = patched.mpj_items as Array<Record<string, unknown>>;
    const corrections = items[2].corrections as Array<Record<string, unknown>>;
    const candidates = items[4].candidates as Array<Record<string, unknown>>;
    expect(corrections[1]).toEqual({ text: "fix-b-new", note_ko: "b-new", is_valid: false });
    expect(corrections[0]).toEqual(original.mpj_items[2].corrections[0]);
    expect(corrections[2]).toEqual(original.mpj_items[2].corrections[2]);
    expect(candidates[3]).toEqual({
      text: "multi-d-new",
      note_ko: "d-new",
      accepted_band_codes: ["too_high"],
    });
    expect(candidates.slice(0, 3)).toEqual(original.mpj_items[4].candidates.slice(0, 3));
    expect(items[0]).toEqual(original.mpj_items[0]);
  });

  it("does not permit a critic-failing repair revision to be persisted", () => {
    expect(canPersistRepairQuality({
      verdict: "fail",
      summary_ko: "still failing",
      findings: [],
      model: "critic",
      prompt_version: "quality-test",
      checked_at: "2026-08-29T00:00:00.000Z",
    })).toBe(false);
  });
});
