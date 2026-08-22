import { describe, expect, it } from "vitest";

import { SAMPLE_MISSION_V1 } from "@/lib/mission/missionV1Sample";
import { SAMPLE_MISSION_V6 } from "@/lib/mission/missionV6Sample";
import { checkMission, type CheckContext } from "@/lib/pragma/missionRules";
import { normalizeMission } from "@/lib/pragma/missionSchema";

const context: CheckContext = {
  speech_act: "request",
  level: "intermediate",
  domain: "daily",
  theme_code: "daily_living",
  topic_code: "schedule_change",
  mode: "translation",
  source_modality: "written",
};

const clone = () => structuredClone(SAMPLE_MISSION_V6);

describe("mission_v6 MPJ4 + FixReview + DCT1", () => {
  it("accepts the representative full flow and keeps MPJ5 legacy readable", () => {
    const parsed = normalizeMission(SAMPLE_MISSION_V6);
    expect(parsed.ok).toBe(true);
    expect(parsed.data?.mpj_items.map((item) => item.type)).toEqual([
      "scale4",
      "fix_choice",
      "fix_review",
      "multi_judge",
    ]);
    expect(checkMission(SAMPLE_MISSION_V6, context).violations.filter((v) => v.level === "fail")).toEqual([]);
    expect(normalizeMission(SAMPLE_MISSION_V1).ok).toBe(true);
  });

  it("keeps the historical mini-discourse mission_v5 meaning readable", () => {
    const legacy = structuredClone(SAMPLE_MISSION_V6) as unknown as {
      schema_version: string;
      mpj_items: Array<Record<string, unknown>>;
      production_task: Record<string, unknown>;
    };
    legacy.schema_version = "mission_v5";
    const review = legacy.mpj_items[2];
    legacy.mpj_items[2] = {
      ...review,
      type: "reason",
      problem_band_code: "too_direct",
      reasons: [
        { id: "legacy-primary", text_ko: "상대에게 선택권을 충분히 남기지 않았다.", kind: "primary" },
        { id: "legacy-misconception", text_ko: "짧으면 언제나 부적절하다고 판단했다.", kind: "pragmatic_misconception" },
        { id: "legacy-context", text_ko: "문법 문제만으로 설명했다.", kind: "meaning_grammar_context" },
      ],
      accepted_reason_id: "legacy-primary",
    };
    const multi = legacy.mpj_items[3] as { candidates?: unknown[] };
    multi.candidates?.push(structuredClone(multi.candidates[0]));
    legacy.production_task.focal_segments = [{
      text: String(legacy.production_task.source_text).slice(0, 8),
      role: "head",
    }];
    const parsed = normalizeMission(legacy);
    expect(parsed.ok).toBe(true);
    expect(parsed.data?.schema_version).toBe("mission_v5");
    expect(parsed.data?.production_task).toHaveProperty("focal_segments");
  });

  it("rejects a fifth MPJ item", () => {
    const mission = clone();
    mission.mpj_items.push(structuredClone(mission.mpj_items[3]));
    expect(normalizeMission(mission).ok).toBe(false);
  });

  it("fails FixChoice without exactly two valid, distinct strategies", () => {
    const mission = clone();
    const item = mission.mpj_items[1];
    if (item.type !== "fix_choice") throw new Error("fixture order");
    item.corrections[1].is_valid = true;
    expect(checkMission(mission, context).violations.some((v) => v.id === "R3" && v.level === "fail")).toBe(true);
  });

  it("fails FixReview without 3 corrections, 1 reject, and 1 core reason", () => {
    const mission = clone();
    const item = mission.mpj_items[2];
    if (item.type !== "fix_review") throw new Error("fixture order");
    item.corrections[0].verdict = "reject";
    expect(checkMission(mission, context).violations.some((v) => v.id === "R4" && v.level === "fail")).toBe(true);
  });

  it("fails when MPJ3 repeats an MPJ2 wrong-answer failure type", () => {
    const mission = clone();
    const item = mission.mpj_items[2];
    if (item.type !== "fix_review") throw new Error("fixture order");
    const rejected = item.corrections.find((correction) => correction.verdict === "reject");
    if (!rejected) throw new Error("fixture reject");
    rejected.failure_type = "over_repair";
    const accepted = item.failure_reasons.find((reason) => reason.id === item.accepted_failure_reason_id);
    if (!accepted) throw new Error("fixture reason");
    accepted.failure_type = "over_repair";
    expect(checkMission(mission, context).violations.some((v) => v.id === "R30" && v.level === "fail")).toBe(true);
  });

  it("fails MultiJudge unless it has four candidates in a 1-2-1 distribution", () => {
    const mission = clone();
    const item = mission.mpj_items[3];
    if (item.type !== "multi_judge") throw new Error("fixture order");
    item.candidates[0].band_role = "under";
    expect(checkMission(mission, context).violations.some((v) => v.id === "R5" && v.level === "fail")).toBe(true);
  });
});
