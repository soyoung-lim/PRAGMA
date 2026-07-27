import { describe, expect, it } from "vitest";
import { auditTopicCoverage, buildBatchPlan } from "@/lib/pragma/batchPlan";
import type { ScenarioTopic } from "@/lib/pragma/scenarioTopics";

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
    expect(
      plan.filter((cell) => cell.domain === "school").map((cell) => cell.topic_code),
    ).not.toContain("group_work_coordination");
  });
});
