import { describe, expect, it } from "vitest";
import {
  auditTopicCompatibility,
  auditTopicCoverage,
  buildBatchPlan,
  FINAL_CORPUS_QUOTA_504,
  PDR_CONSTRUCT_CELLS,
  summarizePlan,
} from "@/lib/pragma/batchPlan";
import {
  getScenarioTopic,
  topicSupportsContext,
  type ScenarioTopic,
} from "@/lib/pragma/scenarioTopics";

describe("topic coverage audit", () => {
  it("has no blocking speech-act/domain gaps after the approved work seeds", () => {
    const audit = auditTopicCoverage();

    expect(audit.missing).toEqual([]);
    expect(audit.wildcardOnly).toEqual([]);
  });

  it("distinguishes a blocking gap from wildcard-only coverage", () => {
    const topics: ScenarioTopic[] = [
      {
        code: "school_wildcard",
        labelKo: "학교 중립 시드",
        themeCode: "campus_study",
        allowedDomains: ["school"],
        situationSeedKo: "학교에서 생기는 상호작용",
      },
    ];

    expect(auditTopicCoverage(["refusal"], ["school", "work"], topics)).toEqual({
      missing: [{ speechAct: "refusal", domain: "work" }],
      wildcardOnly: [{ speechAct: "refusal", domain: "school" }],
    });
  });

  it("builds the current full plan without silent topic fallback", () => {
    const plan = buildBatchPlan();

    expect(plan).not.toHaveLength(0);
    for (const cell of plan) {
      const topic = getScenarioTopic(cell.topic_code);
      expect(topic?.allowedSpeechActs).toContain(cell.speech_act_ui);
    }
  });

  it("has no topic gaps across speech act, P, D, mode, and domain", () => {
    expect(auditTopicCompatibility()).toEqual([]);
  });

  it("keeps role-bound topics out of contradictory P/D cells", () => {
    const professorRequest = getScenarioTopic("deadline_extension");
    const directionHelp = getScenarioTopic("direction_help");
    expect(professorRequest).toBeDefined();
    expect(directionHelp).toBeDefined();

    expect(
      topicSupportsContext(professorRequest!, {
        speechAct: "request",
        domain: "school",
        power: "lower",
        distance: "acquaintance",
        mode: "translation",
      }),
    ).toBe(false);
    expect(
      topicSupportsContext(directionHelp!, {
        speechAct: "request",
        domain: "daily",
        power: "equal",
        distance: "close",
        mode: "stt_interpreting",
      }),
    ).toBe(false);
  });

  it("keeps actor direction and speech-act branches in separate topic seeds", () => {
    const neighborRequest = getScenarioTopic("neighbor_noise");
    const neighborApology = getScenarioTopic("neighbor_noise_apology");
    const feedbackOpposition = getScenarioTopic("comment_feedback_disagreement");
    const contentCompliment = getScenarioTopic("content_strength_compliment");

    expect(neighborRequest?.allowedSpeechActs).toEqual(["request", "complaint"]);
    expect(neighborRequest?.situationSeedKo).toContain("상대 이웃이 낸");
    expect(neighborApology?.allowedSpeechActs).toEqual(["apology"]);
    expect(neighborApology?.situationSeedKo).toContain("화자 본인의 집");
    expect(feedbackOpposition?.allowedSpeechActs).toEqual(["opposition"]);
    expect(contentCompliment?.allowedSpeechActs).toEqual(["compliment"]);
  });
});

describe("construct matrix coverage", () => {
  it("contains all 27 unique P/D/R combinations", () => {
    const unique = new Set(
      PDR_CONSTRUCT_CELLS.map((cell) => `${cell.p}|${cell.d}|${cell.r}`),
    );
    expect(unique.size).toBe(27);
  });

  it("covers all 243 speech-act × P × D × R cells in the 504 final plan", () => {
    const plan = buildBatchPlan(FINAL_CORPUS_QUOTA_504);
    const summary = summarizePlan(plan);

    expect(summary.total).toBe(504);
    expect(summary.emptyActPdrCells).toEqual([]);
    expect(summary.minActPdrCount).toBeGreaterThanOrEqual(2);
  });

  it("does not lock each domain to one power value", () => {
    const plan = buildBatchPlan(FINAL_CORPUS_QUOTA_504);

    for (const domain of ["daily", "school", "work"] as const) {
      expect(new Set(plan.filter((cell) => cell.domain === domain).map((cell) => cell.pdr_power)))
        .toEqual(new Set(["equal", "higher", "lower"]));
    }
  });
});
