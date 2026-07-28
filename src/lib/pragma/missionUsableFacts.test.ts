import { describe, expect, it } from "vitest";

import { normalizeMission } from "@/lib/pragma/missionSchema";
import { checkMission, type CheckContext } from "@/lib/pragma/missionRules";
import { SAMPLE_MISSION_V1 } from "@/lib/mission/missionV1Sample";

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
  model: "gpt-4o",
  prompt_version: "mission_v2",
  mission_content_hash: "usable-facts-test",
  generated_at: "2026-07-28T00:00:00Z",
  generation_attempt: 1,
};

describe("0-w usable_facts inheritance", () => {
  it("accepts an exact core list and rejects mission-side drift", () => {
    const base = normalizeMission(SAMPLE_MISSION_V1).data!;
    const fact = "회의실은 다음 날에도 예약할 수 있다.";
    const mission = {
      ...base,
      production_task: { ...base.production_task, usable_facts: [fact] },
      provenance,
    };
    const core = {
      schema_version: "scenario_core_v2",
      direction: base.direction,
      situation_ko: base.production_task.situation_ko,
      relation_ko: base.production_task.relation_ko,
      source_modality: base.production_task.source_modality,
      source_text: base.production_task.source_text,
      preceding_turn: base.production_task.preceding_turn,
      pdr: base.production_task.pdr,
      usable_facts: [fact],
    };

    const matching = checkMission(mission, context, core);
    expect(
      matching.violations.filter((item) => item.id === "R23" && item.level === "fail"),
    ).toEqual([]);

    const drifted = checkMission(
      {
        ...mission,
        production_task: {
          ...mission.production_task,
          usable_facts: ["승인되지 않은 다른 사실"],
        },
      },
      context,
      core,
    );
    expect(
      drifted.violations.filter((item) => item.id === "R23" && item.level === "fail"),
    ).toHaveLength(1);
  });
});
