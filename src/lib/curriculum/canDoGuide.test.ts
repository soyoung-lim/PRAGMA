import { describe, expect, it } from "vitest";
import { buildCanDoSuggestions } from "./canDoGuide";

describe("buildCanDoSuggestions", () => {
  it("connects situation, communicative action, and observable performance", () => {
    expect(
      buildCanDoSuggestions(
        {
          speech_act: "complaint",
          domain: "school",
          channel: "messenger",
        },
        "ko_zh",
      ),
    ).toEqual([
      "학업의 메신저 상황에서 ‘불만’ 소통 행동을 관계와 부담에 맞게 수행할 수 있다.",
      "한→중 번역에서 전달할 의미를 유지하며 상대에게 주는 인상을 점검하고 표현을 다듬을 수 있다.",
    ]);
  });

  it("uses neutral placeholders when optional planning fields are empty", () => {
    expect(
      buildCanDoSuggestions(
        {
          speech_act: null,
          domain: null,
          channel: null,
        },
        "zh_ko",
      ),
    ).toEqual([
      "주어진 통번역 상황에서 목표 소통 행동을 관계와 부담에 맞게 수행할 수 있다.",
      "중→한 통번역에서 전달할 의미를 유지하며 상대에게 주는 인상을 점검하고 표현을 다듬을 수 있다.",
    ]);
  });
});
