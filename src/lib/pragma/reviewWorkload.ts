import {
  EXTERNAL_GOLD_SAMPLE_COUNT,
  EXTERNAL_GOLD_SAMPLE_PER_SPEECH_ACT,
  FINAL_GOLD_POPULATION_COUNT,
} from "@/lib/pragma/goldProtocol";

export const REVIEW_WORKLOAD_ASSUMPTIONS = {
  goldCaseCount: FINAL_GOLD_POPULATION_COUNT,
  externalGoldSampleCount: EXTERNAL_GOLD_SAMPLE_COUNT,
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
      minimumPerSpeechAct: EXTERNAL_GOLD_SAMPLE_PER_SPEECH_ACT,
      requiredInputCount: externalGoldSampleCount * expertInputsPerGoldCase,
      estimatedMinutes: externalReviewMinutes,
    },
    researcherFinalCorpus: {
      missionCount: finalMissionCount,
      estimatedHours: researcherFinalReviewHours,
      reviewMode: "all_automated_results_confirmed_plus_warning_focused_review" as const,
    },
    automatedFinalCorpus: { missionCount: finalMissionCount },
  };
}

export const REVIEW_WORKLOAD = buildReviewWorkload();
