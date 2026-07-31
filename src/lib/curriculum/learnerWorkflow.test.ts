import { describe, expect, it } from "vitest";
import {
  MPJ_ITEM_COUNT,
  learnerWorkflowSteps,
  learnerWorkflowSummary,
} from "@/lib/curriculum/learnerWorkflow";

describe("learnerWorkflow", () => {
  it("한 번의 수행 순서를 정본 그대로 유지한다", () => {
    expect(learnerWorkflowSteps().map((step) => step.key)).toEqual([
      "scenario",
      "judge",
      "produce",
      "feedback",
      "revise",
    ]);
  });

  it("MPJ는 4문항이다 — legacy 5문항으로 되돌리지 않는다", () => {
    expect(MPJ_ITEM_COUNT).toBe(4);
    const judge = learnerWorkflowSteps().find((step) => step.key === "judge");
    expect(judge?.aside).toBe("MPJ 4");
    expect(judge?.detail).toContain("4번");
  });

  it("실제 문항 수를 받으면 그 값을 쓴다", () => {
    const judge = learnerWorkflowSteps({ mpjCount: 5 }).find(
      (step) => step.key === "judge",
    );
    expect(judge?.aside).toBe("MPJ 5");
  });

  it("통역 미션이면 산출 단계 이름만 바뀐다", () => {
    const translation = learnerWorkflowSteps();
    const interpreting = learnerWorkflowSteps({ interpreting: true });

    expect(translation[2].label).toBe("직접 번역하기");
    expect(interpreting[2].label).toBe("직접 통역하기");
    expect(interpreting.map((step) => step.key)).toEqual(
      translation.map((step) => step.key),
    );
  });

  it("요약은 단계 이름을 순서대로 이어 붙인다", () => {
    expect(learnerWorkflowSummary()).toBe(
      "장면 이해하기 → 표현 비교하기 → 직접 번역하기 → 피드백 살피기 → 다시 다듬기",
    );
    expect(learnerWorkflowSummary({ interpreting: true })).toContain(
      "직접 통역하기",
    );
  });
});
