import { describe, expect, it } from "vitest";

import { learnerCounterpartLabel } from "@/components/mission/ChatScene";

describe("learnerCounterpartLabel", () => {
  it("shows only the counterpart from legacy arrow relations", () => {
    expect(
      learnerCounterpartLabel("실무 지원자 → 거래처 물류 담당자 · 몇 차례 연락한 사이"),
    ).toBe("거래처 물류 담당자 · 몇 차례 연락한 사이");
    expect(learnerCounterpartLabel("인턴 -> 거래처 담당자")).toBe("거래처 담당자");
  });

  it("keeps already learner-facing relations unchanged", () => {
    expect(learnerCounterpartLabel("거래처 배송 담당자 · 업무상 아는 사이")).toBe(
      "거래처 배송 담당자 · 업무상 아는 사이",
    );
  });
});
