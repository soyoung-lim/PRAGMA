import { describe, expect, it } from "vitest";

import { SAMPLE_MISSION_V5, SAMPLE_MISSION_V5_NATIVE } from "@/lib/mission/missionV4Sample";
import type { RunnableMission } from "@/lib/mission/missionDb";
import { adaptRunnableMissionToCanonical, compactLearnerScenario } from "@/lib/mission/canonicalMissionRuntime";

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

function asRefusal<T>(mission: T): T {
  return JSON.parse(
    JSON.stringify(mission)
      .split("request_mitigation_optionality").join("refusal_softening")
      .split("too_direct").join("too_blunt")
      .split("too_indirect").join("over_elaborate"),
  ) as T;
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
    if (view.quests[2].kind !== "fix_choice") throw new Error("Expected fix-choice quest");
    expect(view.quests[2].corrections).toHaveLength(3);
    expect(view.quests[2].corrections.filter((candidate) => candidate.valid)).toHaveLength(1);
    expect(view.quests[1].source).toBe(view.quests[2].source);
    expect(view.quests[5].source).toBe(SAMPLE_MISSION_V5.production_task.source_text);
    expect(view.lessonPoints.every((point) => point.text.includes("「"))).toBe(true);
    expect(view.lessonPoints[4].text).toContain("BEST");
    expect(view.lessonPoints[4].text).toContain("WORST");
  });

  it("keeps legacy response-act preceding turns readable", () => {
    const view = adaptRunnableMissionToCanonical({
      ...runnable(),
      speech_act: "refusal",
      mission: asRefusal(SAMPLE_MISSION_V5),
    });

    expect(view.quests[0].context.precedingTurn).toBe(SAMPLE_MISSION_V5.mpj_items[0].preceding_turn);
  });

  it("maps native mission_v5 MPJ5 items one-to-one without splitting an item", () => {
    const nativeWithHistoricalTurn = asRefusal(structuredClone(SAMPLE_MISSION_V5_NATIVE));
    nativeWithHistoricalTurn.mpj_items[0].preceding_turn = "화면에 표시하면 안 되는 과거 값";
    const view = adaptRunnableMissionToCanonical({
      ...runnable(),
      speech_act: "refusal",
      mission: nativeWithHistoricalTurn,
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
    if (view.quests[2].kind !== "fix_choice") throw new Error("Expected fix-choice quest");
    expect(view.quests[2].corrections).toHaveLength(3);
    expect(view.quests[2].corrections.filter((candidate) => candidate.valid)).toHaveLength(1);
    expect(view.quests.slice(0, 5).every((quest) => quest.context.precedingTurn === undefined)).toBe(true);
    expect(view.quests[3]).toMatchObject({
      kind: "reason",
      prompt: "이 표현은 이 상황에 적절한가요?",
      referenceJudgment: "inappropriate",
    });
    expect(view.quests[4]).toMatchObject({ kind: "best_worst" });
    if (view.quests[4].kind !== "best_worst") throw new Error("Expected best/worst quest");
    expect(view.quests[4].candidates).toHaveLength(4);
    expect(view.quests[4].candidates.filter((candidate) => candidate.role === "best")).toHaveLength(1);
    expect(view.quests[4].candidates.filter((candidate) => candidate.role === "worst")).toHaveLength(1);
  });

  it("projects historical learner scenes to two concise, non-meta sentences", () => {
    const compact = compactLearnerScenario(
      "알고 지내는 후배가 식당 예약 변경을 부탁했다. 글로 작성해 보내며 즉시 반응을 기대하지 않는 기록형 요청이다. 변경을 처리하려면 운영자인 내가 확인해야 한다.",
    );

    expect(compact).toBe("알고 지내는 후배가 식당 예약 변경을 부탁했다. 변경을 처리하려면 운영자인 내가 확인해야 한다.");
    expect(compact).not.toContain("즉시 반응");
  });
});
