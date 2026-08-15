import { describe, expect, it } from "vitest";

import { buildReviewWorkload } from "@/lib/pragma/reviewWorkload";

describe("review workload", () => {
  it("counts every required current-form input without treating the estimate as observed time", () => {
    const workload = buildReviewWorkload();

    expect(workload.researcher).toEqual({
      caseCount: 30,
      requiredInputCount: 420,
      resolutionActionCount: 30,
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
      reviewMode: "all_items_fast_triage_plus_flagged_deep_review",
    });
  });
});
