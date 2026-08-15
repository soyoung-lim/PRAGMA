import { describe, expect, it } from "vitest";

import { buildReviewWorkload } from "@/lib/pragma/reviewWorkload";
import {
  EXTERNAL_GOLD_RESERVE_PER_SPEECH_ACT,
  FINAL_GOLD_CASES_PER_SPEECH_ACT,
  FINAL_GOLD_POPULATION_COUNT,
} from "@/lib/pragma/goldProtocol";

describe("review workload", () => {
  it("counts every required current-form input without treating the estimate as observed time", () => {
    const workload = buildReviewWorkload();

    expect(workload.researcher).toEqual({
      caseCount: 45,
      requiredInputCount: 630,
      resolutionActionCount: 45,
    });
    expect(workload.goldExpertPerPerson).toEqual({
      caseCount: 18,
      minimumPerSpeechAct: 2,
      requiredInputCount: 306,
      estimatedMinutes: [45, 60],
    });
    expect(workload.researcherFinalCorpus).toEqual({
      missionCount: 504,
      estimatedHours: [3, 5],
      reviewMode: "all_automated_results_confirmed_plus_warning_focused_review",
    });
    expect(FINAL_GOLD_POPULATION_COUNT).toBe(45);
    expect(FINAL_GOLD_CASES_PER_SPEECH_ACT).toBe(5);
    expect(EXTERNAL_GOLD_RESERVE_PER_SPEECH_ACT).toBe(3);
  });
});
