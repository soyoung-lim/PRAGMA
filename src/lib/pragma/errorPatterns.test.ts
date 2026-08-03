import { describe, expect, it } from "vitest";

import { ERROR_PATTERNS, errorPatternsForAct } from "@/lib/pragma/errorPatterns";

describe("errorPatternsForAct — 방향 필터", () => {
  it("중국어 자원에 매인 시드를 zh_ko(한국어 산출) 미션에 주입하지 않는다", () => {
    const zhKoRequest = errorPatternsForAct("request", "zh_ko").map((p) => p.patternId);
    for (const id of ["weak_internal_mitigation", "ba_imperative_overuse", "hanja_interference"]) {
      expect(zhKoRequest, `${id}는 중국어 산출 전용이다`).not.toContain(id);
    }
  });

  it("ko_zh에서는 기존 시드가 그대로 나온다 (회귀 방지)", () => {
    const koZhRequest = errorPatternsForAct("request", "ko_zh").map((p) => p.patternId);
    expect(koZhRequest).toEqual([
      "learner_verbosity",
      "weak_internal_mitigation",
      "hanja_interference",
      "ba_imperative_overuse",
    ]);
  });

  it("방향 무관 시드는 두 방향 모두에 남는다", () => {
    for (const direction of ["ko_zh", "zh_ko"] as const) {
      expect(errorPatternsForAct("refusal", direction).map((p) => p.patternId)).toContain(
        "learner_verbosity",
      );
    }
  });

  it("화행 필터는 방향과 독립적으로 그대로 작동한다", () => {
    expect(errorPatternsForAct("compliment", "ko_zh").map((p) => p.patternId)).not.toContain(
      "excessive_gratitude",
    );
  });

  // zh_ko 전용 오류 패턴은 아직 하나도 없다. 중→한은 "모어를 산출"하는 과제라
  // 어휘·문법 오류가 아니라 원발화의 태도를 어디까지 옮기는가(매개 판단)가 쟁점이다.
  // 이 테스트는 공백을 드러내 두기 위한 것이며, 패턴이 승인되면 함께 갱신한다.
  it("현재 zh_ko 전용 패턴은 없다 — 공백을 명시적으로 기록한다", () => {
    const zhKoOnly = ERROR_PATTERNS.filter(
      (p) => p.applicableDirections?.length === 1 && p.applicableDirections[0] === "zh_ko",
    );
    expect(zhKoOnly).toHaveLength(0);
  });
});
