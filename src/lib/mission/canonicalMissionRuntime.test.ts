import { describe, expect, it } from "vitest";

import { SAMPLE_MISSION_V5, SAMPLE_MISSION_V5_NATIVE } from "@/lib/mission/missionV4Sample";
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

describe("canonical mission runtime bridge", () => {
  it("keeps legacy mission_v5 readable by splitting its combined judgment and correction", () => {
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

  it("maps native mission_v5 MPJ5 items one-to-one without splitting an item", () => {
    const view = adaptRunnableMissionToCanonical({
      ...runnable(),
      mission: SAMPLE_MISSION_V5_NATIVE,
    });

    expect(view.quests.map((quest) => quest.kind)).toEqual([
      "scale",
      "scale",
      "fix_choice",
      "reason",
      "best_worst",
      "dct",
      "dct_feedback",
    ]);
    expect(view.quests.slice(0, 5).map((quest) => quest.source)).toEqual(
      SAMPLE_MISSION_V5_NATIVE.mpj_items.map((item) => item.source),
    );
    expect(view.quests[2]).toMatchObject({ kind: "fix_choice" });
    expect(view.quests[2]).not.toHaveProperty("judgmentQuestId");
    expect(view.quests.slice(0, 5).every((quest) => quest.context.precedingTurn === undefined)).toBe(true);
    expect(view.quests[3]).not.toHaveProperty("judgmentOptions");
    expect(view.quests[3]).not.toHaveProperty("referenceJudgment");
    expect(view.quests[4]).toMatchObject({ kind: "best_worst" });
    if (view.quests[4].kind !== "best_worst") throw new Error("Expected best/worst quest");
    expect(view.quests[4].candidates).toHaveLength(4);
    expect(view.quests[4].candidates.filter((candidate) => candidate.role === "best")).toHaveLength(1);
    expect(view.quests[4].candidates.filter((candidate) => candidate.role === "worst")).toHaveLength(1);
  });
});
