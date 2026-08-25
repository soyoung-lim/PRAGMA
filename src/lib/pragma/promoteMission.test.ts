import { describe, expect, it } from "vitest";

import { repairFindingsForRuleViolations } from "./promoteMission";

describe("repairFindingsForRuleViolations", () => {
  it("keeps the first duplicate and repairs every later R27 item", () => {
    expect(repairFindingsForRuleViolations([{
      id: "R27",
      level: "fail",
      message: "v4 MPJ 문항 2·3·4의 situation_ko가 완전히 중복됨",
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
