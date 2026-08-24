import { describe, expect, it } from "vitest";

import { SAMPLE_MISSION_V5 } from "@/lib/mission/missionV4Sample";
import type { RunnableMission } from "@/lib/mission/missionDb";
import { adaptRunnableMissionToCanonical } from "@/lib/mission/canonicalMissionRuntime";

function runnable(): RunnableMission {
  return {
    scenario_id: "86d738b0-1891-4bfe-9b12-f8643ebbb45f",
    speech_act: "request",
    learner_level: "intermediate",
    mission_status: "reviewed",
    release_gate_mode: "legacy_reviewed",
    direction: "ko_zh",
    mission: SAMPLE_MISSION_V5,
  };
}

describe("mission V4 runtime bridge", () => {
  it("opens a current mission_v5 as five learner judgments followed by DCT and feedback", () => {
    const view = adaptRunnableMissionToCanonical(runnable());

    expect(view.scenarioId).toBe("86d738b0-1891-4bfe-9b12-f8643ebbb45f");
    expect(view.speechAct).toBe("요청");
    expect(view.quests.map((quest) => quest.kind)).toEqual([
      "scale",
      "scale",
      "fix_choice",
      "reason",
      "best_worst",
      "dct",
      "dct_feedback",
    ]);
    expect(view.quests.slice(0, 5).map((quest) => quest.id)).toEqual(["A1", "A2", "A3", "A4", "A5"]);
    expect(view.lessonPoints).toHaveLength(5);
    expect(view.quests[2]).toMatchObject({ kind: "fix_choice", judgmentQuestId: "A2" });
    expect(view.quests[1].source).toBe(view.quests[2].source);
    expect(view.quests[5].source).toBe(SAMPLE_MISSION_V5.production_task.source_text);
  });
});
