// Shared PRAGMA enums/labels used by AdminGenerator and (future) curriculum UI.
// Extracted verbatim from AdminGenerator.tsx — values/keys/labels unchanged.
//
// Generator-only helpers intentionally REMAIN in AdminGenerator.tsx and are NOT
// moved here: SPEECH_ACT_UI_TO_INTERNAL, SPEECH_ACT_WEIGHT, CHANNEL_TO_GENRE,
// computePragmaticBurden, and the scenario prompt/save mappings.

// ── Speech act — UI-only taxonomy (9) ──
// NOTE: internal_key `agreement` is FROZEN (persisted in scenarios.speech_act /
// decision_traces.speech_act, ENUMS.md registry). Its DISPLAY LABEL was changed
// 동의→"초대" (concept = 초대·공동행동 권유 / invitation; short 2-char label for UI
// uniformity across the 9 acts). 동의 is no longer a top-level act (absorbed into
// `opposition` response strategies). Key kept for DB stability; act_position of
// `agreement` is now INITIATING (invitation is an initiating act), see ENUMS.md §12.
export type SpeechActUI =
  | "request" | "refusal" | "apology" | "thanks"
  | "proposal" | "agreement" | "opposition" | "compliment" | "complaint";
export const SPEECH_ACT_UI: Record<SpeechActUI, string> = {
  request: "요청",
  refusal: "거절",
  apology: "사과",
  thanks: "감사",
  proposal: "제안",
  agreement: "초대",
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
  agreement: "Invitation",
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
// D/R expanded 2→3 values (2026-07-19) per scenario-matrix LOCK (D: 친밀·지인·초면 / R: 저·중·고).
// Existing keys kept frozen for stored data; new keys: acquaintance(지인), mid(중간).
// D operational definitions: close=사적 관계 / acquaintance=인지하나 개인적 관계 없음 / formal=상호작용 이력 0(초면).
export type PdrPower = "higher" | "equal" | "lower";
export type PdrDistance = "close" | "acquaintance" | "formal";
export type PdrBurden = "low" | "mid" | "high";
export const PDR_POWER: Record<PdrPower, string> = {
  higher: "내가 낮음",
  equal: "동등",
  lower: "내가 높음",
};
export const PDR_DISTANCE: Record<PdrDistance, string> = {
  close: "친밀 (가까운 사이)",
  acquaintance: "지인 (알지만 어색)",
  formal: "초면 (멂)",
};
export const PDR_BURDEN: Record<PdrBurden, string> = {
  low: "낮음",
  mid: "중간",
  high: "높음",
};
export const PDR_POWER_SHORT: Record<PdrPower, string> = {
  higher: "P: 내가 낮음",
  equal: "P: 동등",
  lower: "P: 내가 높음",
};
export const PDR_DISTANCE_SHORT: Record<PdrDistance, string> = {
  close: "D: 친밀",
  acquaintance: "D: 지인",
  formal: "D: 초면",
};
export const PDR_BURDEN_SHORT: Record<PdrBurden, string> = {
  low: "R: 낮음",
  mid: "R: 중간",
  high: "R: 높음",
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
