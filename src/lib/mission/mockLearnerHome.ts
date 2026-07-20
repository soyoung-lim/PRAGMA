// Mock data for the learner home / hub — UI mockup only, no DB.
// Mirrors the prototype's vHome: today's mission hero + profile summary + nav tiles.

export type LearnerMode = "self" | "class";

export const TODAY_MISSION = {
  speechAct: "요청",
  channel: "위챗",
  audience: "친구에게",
  selfCopy: {
    kicker: "오늘의 미션 · 약점 기반 추천",
    body: "당신의 격식 편향을 풀기 좋은 편한 상황부터.",
  },
  classCopy: {
    kicker: "이번 주 과제 · 요청 화행",
    body: "교수님이 배포한 이번 주 과제예요. 완료 후 기록이 대시보드로 갑니다.",
  },
};

export const PROFILE_SUMMARY = {
  label: "내 프로파일 (이번 주)",
  body: "완화 표현 사용이 늘어나는 중 ↑ · 아직 위챗에서 서면투가 가끔 나와요.",
};

/** 이번 커밋에서는 라우팅 없이 '준비 중'으로만 표시. */
export const HOME_TILES = [
  { key: "strategy", label: "전략 지도", body: "요청·거절에 쓸 수 있는 전략들 보기", ready: false },
  { key: "report", label: "주간 리포트", body: "나의 언어 지문(语言指纹) 성장 보기", ready: false },
] as const;
