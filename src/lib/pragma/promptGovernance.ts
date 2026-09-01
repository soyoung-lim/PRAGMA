export const GENERATION_PROMPT_GROUPS = ["core", "mission", "review", "authoring"] as const;
export const LEARNER_RUNTIME_PROMPT_GROUPS = ["runtime"] as const;

export const PROMPT_GOVERNANCE_GROUPS = [
  ...GENERATION_PROMPT_GROUPS,
  ...LEARNER_RUNTIME_PROMPT_GROUPS,
] as const;
