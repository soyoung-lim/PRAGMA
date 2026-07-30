// 미니 담화형 원문의 집중 구간 분할 — 표시가 원문을 왜곡하지 않는지 검사한다.
import { describe, expect, it } from "vitest";
import { splitByFocalSegments } from "@/components/mission/FocalSourceText";

const SOURCE =
  "지난번에 보내주신 샘플은 잘 받았습니다. 내부 검토에 하나가 더 필요해서요. 가능하시다면 오늘 중으로 하나 더 보내주실 수 있을까요? 번거롭게 해드려 죄송합니다.";

describe("splitByFocalSegments", () => {
  it("분할 결과를 이어 붙이면 항상 원문과 같다", () => {
    const parts = splitByFocalSegments(SOURCE, [
      { text: "가능하시다면 오늘 중으로 하나 더 보내주실 수 있을까요?", role: "head" },
      { text: "번거롭게 해드려 죄송합니다.", role: "support" },
    ]);
    expect(parts.map((p) => p.text).join("")).toBe(SOURCE);
    expect(parts.filter((p) => p.focal)).toHaveLength(2);
  });

  it("원문에 없는 구간은 강조하지 않고 건너뛴다", () => {
    const parts = splitByFocalSegments(SOURCE, [
      { text: "여기에 없는 문장입니다", role: "head" },
    ]);
    expect(parts.map((p) => p.text).join("")).toBe(SOURCE);
    expect(parts.some((p) => p.focal)).toBe(false);
  });

  it("겹치는 구간은 앞선 것만 살린다", () => {
    const parts = splitByFocalSegments(SOURCE, [
      { text: "가능하시다면 오늘 중으로", role: "head" },
      { text: "오늘 중으로 하나 더", role: "support" },
    ]);
    expect(parts.map((p) => p.text).join("")).toBe(SOURCE);
    expect(parts.filter((p) => p.focal)).toHaveLength(1);
  });

  it("구간이 없으면 원문 한 덩어리만 돌려준다", () => {
    const parts = splitByFocalSegments(SOURCE, []);
    expect(parts).toEqual([{ text: SOURCE, focal: false }]);
  });
});
