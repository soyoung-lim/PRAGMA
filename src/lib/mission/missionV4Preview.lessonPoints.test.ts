import { describe, expect, it } from "vitest";

import { REQUEST_MISSION_V4_PREVIEW } from "./missionV4Preview";

describe("REQUEST_MISSION_V4_PREVIEW lessonPoints", () => {
  it("keeps one grounded lesson in MPJ1–5 order without revealing the DCT answer", () => {
    const { lessonPoints, quests } = REQUEST_MISSION_V4_PREVIEW;
    const dct = quests.find((quest) => quest.kind === "dct");

    expect(lessonPoints).toHaveLength(5);
    expect(lessonPoints.map((point) => point.questId)).toEqual(["A1", "A2", "A3", "A4", "A5"]);
    expect(lessonPoints.map((point) => point.label)).toEqual([
      "첫인상 판단",
      "상황 비교",
      "고쳐 보기",
      "이유 찾기",
      "BEST·WORST",
    ]);
    for (const point of lessonPoints) {
      expect(point.highlights?.length).toBeGreaterThan(0);
      for (const highlight of point.highlights ?? []) expect(point.text).toContain(highlight);
      expect(point.text).not.toContain("P·D·R");
      if (dct) expect(point.text).not.toContain(dct.referenceAnswer);
    }
  });
});
