export const GOLD_SPEECH_ACTS = [
  "request",
  "refusal",
  "apology",
  "thanks",
  "proposal",
  "agreement",
  "opposition",
  "compliment",
  "complaint",
] as const;

export const BOOTSTRAP_SEED_GOLD_CASE_COUNT = 30;
export const BOOTSTRAP_SEED_GOLD_SPEECH_ACT_COUNT = 3;

// 최종 9화행 Gold는 최초 외부표본 2개 뒤에도 화행별 예비 3개가 남도록 고정한다.
export const FINAL_GOLD_CASES_PER_SPEECH_ACT = 5;
export const FINAL_GOLD_POPULATION_COUNT =
  GOLD_SPEECH_ACTS.length * FINAL_GOLD_CASES_PER_SPEECH_ACT;
export const EXTERNAL_GOLD_SAMPLE_PER_SPEECH_ACT = 2;
export const EXTERNAL_GOLD_SAMPLE_COUNT =
  GOLD_SPEECH_ACTS.length * EXTERNAL_GOLD_SAMPLE_PER_SPEECH_ACT;
export const EXTERNAL_GOLD_RESERVE_PER_SPEECH_ACT =
  FINAL_GOLD_CASES_PER_SPEECH_ACT - EXTERNAL_GOLD_SAMPLE_PER_SPEECH_ACT;

export const GOLD_NONCONSENSUS_TERMINAL_RULE = {
  resolutionMethod: "terminal_nonconsensus",
  finalStatus: "rejected",
  action: "exclude_case_open_all_reserves_and_hold_release",
} as const;
