export const REVIEW_WORKLOAD_ASSUMPTIONS = {
  goldCaseCount: 30,
  externalGoldSampleCount: 18,
  finalMissionCount: 504,
  externalReviewMinutes: [45, 60] as const,
  researcherFinalReviewHours: [3, 5] as const,
} as const;

export function buildReviewWorkload() {
  const {
    goldCaseCount,
    externalGoldSampleCount,
    finalMissionCount,
    externalReviewMinutes,
    researcherFinalReviewHours,
  } = REVIEW_WORKLOAD_ASSUMPTIONS;

  // 연구자: 맥락 3 + 후보별 (대역·의미·근거) 3×3 + 종합판정·근거 2.
  const researcherInputsPerGoldCase = 14;
  // 외부 전문가는 9화행×2개 층화표본만 확인한다: 연구자 입력 14 + 독립성 선언 3.
  const expertInputsPerGoldCase = 17;

  return {
    researcher: {
      caseCount: goldCaseCount,
      requiredInputCount: goldCaseCount * researcherInputsPerGoldCase,
      resolutionActionCount: goldCaseCount,
    },
    goldExpertPerPerson: {
      caseCount: externalGoldSampleCount,
      minimumPerSpeechAct: 2,
      requiredInputCount: externalGoldSampleCount * expertInputsPerGoldCase,
      estimatedMinutes: externalReviewMinutes,
    },
    researcherFinalCorpus: {
      missionCount: finalMissionCount,
      estimatedHours: researcherFinalReviewHours,
      reviewMode: "all_items_fast_triage_plus_flagged_deep_review" as const,
    },
    automatedFinalCorpus: { missionCount: finalMissionCount },
  };
}

export const REVIEW_WORKLOAD = buildReviewWorkload();
