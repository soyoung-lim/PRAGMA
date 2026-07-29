import { describe, expect, it } from "vitest";

import { SAMPLE_MISSION_V4 } from "@/lib/mission/missionV4Sample";
import { normalizeMission } from "@/lib/pragma/missionSchema";

describe("mission_v4 translation vocabulary hints", () => {
  it("accepts exactly two non-pragmatic vocabulary hints", () => {
    const parsed = normalizeMission(SAMPLE_MISSION_V4);
    expect(parsed.ok).toBe(true);
    expect(parsed.data?.production_task.vocabulary_hints).toEqual([
      { source: "배송지", target: "收货地址" },
      { source: "새 사무실", target: "新办公室" },
    ]);
  });

  it("rejects a translation task with three hints", () => {
    expect(
      normalizeMission({
        ...SAMPLE_MISSION_V4,
        production_task: {
          ...SAMPLE_MISSION_V4.production_task,
          vocabulary_hints: [
            ...(SAMPLE_MISSION_V4.production_task.vocabulary_hints ?? []),
            { source: "주문", target: "订单" },
          ],
        },
      }).ok,
    ).toBe(false);
  });
});
