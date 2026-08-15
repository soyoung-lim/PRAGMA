import type { LearnerLevel } from "@/lib/pragma/enums";

export interface MissionLevelPolicy {
  label: string;
  hsk: string;
  sentenceProfile: string;
  resourceProfile: string;
  sourceLength: string;
  promptText: string;
}

/** 미션 생성과 관리자 설명 화면이 함께 사용하는 수준 정책 정본. */
export const MISSION_LEVEL_POLICIES: Record<LearnerLevel, MissionLevelPolicy> = {
  beginner_intermediate: {
    label: "입문",
    hsk: "HSK 4급",
    sentenceProfile: "단문 중심 · 종속절 제한",
    resourceProfile: "핵심 표현 자원 1개 조합",
    sourceLength: "1~2문장",
    promptText: "입문(HSK4): 단문 중심, 종속절 제한. 자원 조합 1개. 원문 1~2문장.",
  },
  intermediate: {
    label: "중급",
    hsk: "HSK 5급",
    sentenceProfile: "복문 1~2개 · 이유·조건 표현 사용",
    resourceProfile: "핵심 표현 자원 2개 조합",
    sourceLength: "2~4문장",
    promptText: "중급(HSK5): 복문 1~2개, 이유·조건 표현 사용. 자원 조합 2개. 원문 2~4문장.",
  },
  advanced: {
    label: "고급",
    hsk: "HSK 6급",
    sentenceProfile: "담화 조직 · 복합 전략",
    resourceProfile: "상황에 맞는 복합 자원 선택",
    sourceLength: "3~5문장 · 통역은 짧은 구두 담화",
    promptText: "고급(HSK6): 담화 조직·복합 전략. 자원 선택 배열. 원문 3~5문장(통역은 짧은 구두 담화).",
  },
};

export const MISSION_LEVEL_ORDER: LearnerLevel[] = [
  "beginner_intermediate",
  "intermediate",
  "advanced",
];

export const missionLevelPolicyPrompt = (level: LearnerLevel): string =>
  MISSION_LEVEL_POLICIES[level].promptText;
