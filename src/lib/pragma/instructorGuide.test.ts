import { describe, expect, it } from "vitest";

import { SAMPLE_MISSION_V5, SAMPLE_MISSION_V5_NATIVE } from "@/lib/mission/missionV4Sample";
import { buildInstructorMissionGuide } from "@/lib/pragma/instructorGuide";

describe("instructor mission guide", () => {
  it("projects approved mission data into the six-step teaching material inputs", () => {
    const mission = structuredClone(SAMPLE_MISSION_V5_NATIVE);
    mission.mpj_items[0].pdr = { ...mission.mpj_items[1].pdr, r: "low" };

    const guide = buildInstructorMissionGuide(mission, "요청");

    expect(guide.speechActKo).toBe("요청");
    expect(guide.mpjItems).toHaveLength(5);
    expect(guide.contrast).toMatchObject({ verified: true });
    expect(guide.contrast.changedKo).toContain("R(부담)");
    expect(guide.misconceptionKo).toBeTruthy();
    expect(guide.coreReasonKo).toBeTruthy();
    expect(guide.dct.alternatives).toHaveLength(2);
    expect(guide.mpjItems.find((item) => item.id === 5)?.candidates).toHaveLength(4);
  });

  it("does not invent a single-axis claim for legacy or compound contrasts", () => {
    const guide = buildInstructorMissionGuide(SAMPLE_MISSION_V5, "요청");

    expect(guide.contrast.verified).toBe(false);
    expect(guide.contrast.changedKo).toBeUndefined();
    expect(guide.contrast.firstSituationKo).toBeTruthy();
    expect(guide.contrast.secondSituationKo).toBeTruthy();
  });
});

