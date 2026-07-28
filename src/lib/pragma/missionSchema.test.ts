import { describe, expect, it } from "vitest";

import { SAMPLE_MISSION_V1 } from "@/lib/mission/missionV1Sample";
import { normalizeMission } from "@/lib/pragma/missionSchema";
import { checkMission, type CheckContext } from "@/lib/pragma/missionRules";

const context: CheckContext = {
  speech_act: "request",
  level: "intermediate",
  domain: "work",
  theme_code: "career_workplace",
  topic_code: "schedule_change",
  mode: "translation",
  source_modality: "written",
};

const provenance = {
  model: "gpt-4.1",
  prompt_version: "mission_v3_mpj4",
  mission_content_hash: "mission-v3-test",
  generated_at: "2026-07-28T07:30:00Z",
  generation_attempt: 1,
};

function missionV3() {
  const legacy = normalizeMission(SAMPLE_MISSION_V1).data!;
  return {
    ...legacy,
    schema_version: "mission_v3" as const,
    mpj_items: legacy.mpj_items.slice(0, 4),
    provenance,
  };
}

describe("mission_v3 MPJ4 contract", () => {
  it("accepts the four-item order and keeps legacy MPJ5 readable", () => {
    const current = normalizeMission(missionV3());
    expect(current.ok).toBe(true);
    expect(current.data?.schema_version).toBe("mission_v3");
    expect(current.data?.mpj_items.map((item) => item.type)).toEqual([
      "scale4",
      "judge3",
      "fix_choice",
      "reason_conf",
    ]);

    const legacy = normalizeMission(SAMPLE_MISSION_V1);
    expect(legacy.ok).toBe(true);
    expect(legacy.data?.schema_version).toBe("mission_v2");
    expect(legacy.data?.mpj_items).toHaveLength(5);
    expect(legacy.data?.mpj_items[4].type).toBe("multi_judge");
  });

  it("rejects multi_judge and a fifth item in mission_v3", () => {
    const base = normalizeMission(SAMPLE_MISSION_V1).data!;
    expect(
      normalizeMission({
        ...missionV3(),
        mpj_items: [
          ...base.mpj_items.slice(0, 3),
          base.mpj_items[4],
        ],
      }).ok,
    ).toBe(false);
    expect(
      normalizeMission({
        ...missionV3(),
        mpj_items: base.mpj_items,
      }).ok,
    ).toBe(false);
  });

  it("applies the new R1 order without weakening legacy checks", () => {
    const valid = checkMission(missionV3(), context);
    expect(
      valid.violations.filter((item) => item.id === "R1" && item.level === "fail"),
    ).toEqual([]);

    const current = missionV3();
    const invalid = checkMission(
      {
        ...current,
        mpj_items: [
          current.mpj_items[1],
          current.mpj_items[0],
          current.mpj_items[2],
          current.mpj_items[3],
        ],
      },
      context,
    );
    expect(
      invalid.violations.some((item) => item.id === "R1" && item.level === "fail"),
    ).toBe(true);
  });
});
