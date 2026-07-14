// Shared PRAGMA enums/labels used by AdminGenerator and (future) curriculum UI.
// Extracted verbatim from AdminGenerator.tsx — values/keys/labels unchanged.
//
// Generator-only helpers intentionally REMAIN in AdminGenerator.tsx and are NOT
// moved here: SPEECH_ACT_UI_TO_INTERNAL, SPEECH_ACT_WEIGHT, CHANNEL_TO_GENRE,
// computePragmaticBurden, and the scenario prompt/save mappings.

// ── Speech act — UI-only taxonomy (9) ──
export type SpeechActUI =
  | "request" | "refusal" | "apology" | "thanks"
  | "proposal" | "agreement" | "opposition" | "compliment" | "complaint";
export const SPEECH_ACT_UI: Record<SpeechActUI, string> = {
  request: "요청",
  refusal: "거절",
  apology: "사과",
  thanks: "감사",
  proposal: "제안",
  agreement: "동의",
  opposition: "반대",
  compliment: "칭찬",
  complaint: "불만",
};
export const SPEECH_ACT_UI_EN: Record<SpeechActUI, string> = {
  request: "Request",
  refusal: "Refusal",
  apology: "Apology",
  thanks: "Thanks",
  proposal: "Suggestion",
  agreement: "Agreement",
  opposition: "Disagreement",
  compliment: "Compliment",
  complaint: "Complaint",
};

// ── Learner level (3-tier) ──
export type LearnerLevel = "beginner_intermediate" | "intermediate" | "advanced";
export const LEVEL: Record<LearnerLevel, string> = {
  beginner_intermediate: "입문 · HSK 4급",
  intermediate: "중급 · HSK 5급",
  advanced: "고급 · HSK 6급",
};

// ── Language direction ──
export type LanguageDirection = "ko_zh" | "zh_ko";

// ── Channel (4) + derived mode ──
export type ChannelUI = "email" | "messenger" | "facetoface" | "phone";
export type GenMode = "translation" | "stt_interpreting";
export const CHANNEL_TO_MODE: Record<ChannelUI, GenMode> = {
  email: "translation",
  messenger: "translation",
  facetoface: "stt_interpreting",
  phone: "stt_interpreting",
};

// ── P·D·R ──
export type PdrPower = "higher" | "equal" | "lower";
export type PdrDistance = "formal" | "close";
export type PdrBurden = "high" | "low";
export const PDR_POWER: Record<PdrPower, string> = {
  higher: "내가 낮음",
  equal: "동등",
  lower: "내가 높음",
};
export const PDR_DISTANCE: Record<PdrDistance, string> = {
  formal: "멂",
  close: "가까움",
};
export const PDR_BURDEN: Record<PdrBurden, string> = {
  high: "높음",
  low: "낮음",
};
export const PDR_POWER_SHORT: Record<PdrPower, string> = {
  higher: "P: 내가 낮음",
  equal: "P: 동등",
  lower: "P: 내가 높음",
};
export const PDR_DISTANCE_SHORT: Record<PdrDistance, string> = {
  formal: "D: 멂",
  close: "D: 가까움",
};
export const PDR_BURDEN_SHORT: Record<PdrBurden, string> = {
  high: "R: 높음",
  low: "R: 낮음",
};

// ── Domain (3) ──
export type Domain = "daily" | "school" | "work";
export const DOMAIN: Record<Domain, string> = {
  daily: "일상",
  school: "학교",
  work: "직장",
};

// ── Industry sector (7, UI-only remap onto existing enum keys) ──
export type IndustrySector =
  | "trade_distribution"
  | "IT_platform"
  | "manufacturing"
  | "tourism_hospitality"
  | "education_research"
  | "public_international_affairs"
  | "culture_content_media";
export const INDUSTRY: Record<IndustrySector, string> = {
  culture_content_media: "엔터테인먼트·미디어",
  manufacturing: "뷰티·패션·커머스",
  trade_distribution: "제조·글로벌 무역",
  IT_platform: "IT·테크·플랫폼",
  public_international_affairs: "바이오·의료·헬스케어",
  tourism_hospitality: "관광·MICE",
  education_research: "공공·교육·연구",
};
