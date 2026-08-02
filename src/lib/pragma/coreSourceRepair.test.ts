import { describe, expect, it } from "vitest";

import {
  buildCoreSourceRepairPrompt,
  coreSourceSentenceIssue,
  countCoreSourceSentences,
} from "../../../supabase/functions/_shared/coreSourceRepair";

describe("core source discourse boundary", () => {
  it("중국어 쉼표만 이어진 장문은 한 문장으로 판정한다", () => {
    const source =
      "我觉得学校的延期政策很不合理，明明很多人都需要，但他们只是简单地拒绝了我们的请求，这让我们很难适应新的学期安排。";

    expect(countCoreSourceSentences(source)).toBe(1);
    expect(coreSourceSentenceIssue(source)?.count).toBe(1);
  });

  it("중국어 종결부호로 나뉜 2~4문장은 통과한다", () => {
    const source =
      "我觉得学校的延期政策很不合理。很多人都需要延期，但学校只是简单地拒绝了我们的请求。这让我们很难适应新的学期安排。";

    expect(countCoreSourceSentences(source)).toBe(3);
    expect(coreSourceSentenceIssue(source)).toBeNull();
  });

  it("교정 요청은 기존 사실 보존과 중국어 문장 경계를 함께 고정한다", () => {
    const prompt = buildCoreSourceRepairPrompt({
      originalUserPrompt: "PROBE_REQUEST",
      previousOutput: { source_text: "조건을 바꾸지 않는다。" },
      sourceLanguage: "zh",
      lengthHintKo: "2~3문장의 짧은 구두 담화",
      measuredSentenceCount: 1,
    });

    expect(prompt).toContain("PROBE_REQUEST");
    expect(prompt).toContain("중국어 종결부호(。！？)");
    expect(prompt).toContain("인물·관계·상황·사실·화행 목적은 그대로 보존");
    expect(prompt).toContain("focal_segments");
  });
});
