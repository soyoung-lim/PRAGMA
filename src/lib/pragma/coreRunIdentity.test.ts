import { describe, expect, it } from "vitest";
import { createCoreRunId, isCoreRunIdForDirection } from "./coreRunIdentity";

describe("coreRunIdentity", () => {
  it("방향과 시각으로 결정론적인 실행 ID를 만든다", () => {
    expect(createCoreRunId("zh_ko", 1785926368500)).toBe(
      "core_zh_ko_1785926368500",
    );
  });

  it("현재 방향의 코어 실행 ID만 허용한다", () => {
    expect(isCoreRunIdForDirection("core_zh_ko_1785926368500", "zh_ko")).toBe(true);
    expect(isCoreRunIdForDirection("core_zh_ko_1785926368500", "ko_zh")).toBe(false);
    expect(isCoreRunIdForDirection("mission_zh_ko_1785926368500", "zh_ko")).toBe(false);
    expect(isCoreRunIdForDirection("core_zh_ko_latest", "zh_ko")).toBe(false);
  });
});
