import { describe, expect, it } from "vitest";

import { SAMPLE_MISSION_V1 } from "@/lib/mission/missionV1Sample";
import { normalizeMission } from "@/lib/pragma/missionSchema";

describe("production vocabulary hints", () => {
  it("preserves exactly two content-word hints through v1 to v2 normalization", () => {
    const normalized = normalizeMission(SAMPLE_MISSION_V1);

    expect(normalized.ok).toBe(true);
    expect(normalized.data?.production_task.vocabulary_hints).toEqual([
      { source: "저희 쪽", target: "我们这边" },
      { source: "근처", target: "附近" },
    ]);
  });

  it("rejects a mission that provides three vocabulary hints", () => {
    const invalid = {
      ...SAMPLE_MISSION_V1,
      production_task: {
        ...SAMPLE_MISSION_V1.production_task,
        vocabulary_hints: [
          { source: "저희 쪽", target: "我们这边" },
          { source: "근처", target: "附近" },
          { source: "바꾸다", target: "改" },
        ],
      },
    };

    expect(normalizeMission(invalid).ok).toBe(false);
  });
});
