// Mock data for the practice (production-first) mission — UI mockup only, no DB.
//
// Structure follows the "일반 미션 수직 슬라이스" spec: 상황 읽기 → 최초 번역 →
// 수신자 관점 → 판단/실현 2단 진단 → 3종 대조(차이 발견용, 정답 선택 아님) →
// 메시지 엑스레이 → 한 곳 수정 → (transfer만) CS → 원리 카드.
// Distinct from mockMission.ts (judgment-first research shell) — no candidate
// pool, no rating scale. Reuses only the SituationCard shape.

import type { SituationCard } from "@/lib/mission/mockMission";

export type PracticeMode = "quick" | "transfer";

export const PRACTICE_SCENARIO = {
  id: "scn_quick_wechat_deadline",
  speechAct: "요청",
  mode: "번역" as const,
  channel: "위챗" as const,
  sourceText:
    "샤오린, 혹시 발표 자료 마감을 하루만 미뤄도 괜찮을까? 내 파트 정리가 좀 늦어져서… 안 되면 편하게 말해줘!",
  situation: {
    headline: "이번 학기 처음 같은 조가 된 중국인 동급생에게 위챗으로 부탁해야 합니다.",
    audience: "샤오린(小林)",
    relation: "이번 학기 처음 같은 조가 된 동급생 · 아직 조금 어색한 사이",
    channel: "위챗 메시지",
    goal: "발표 자료 마감을 하루 미뤄도 되는지 부탁하기",
    mustConvey: ["마감을 하루 연기", "부탁이지 통보가 아님"],
    usableFacts: ["내 파트 정리가 늦어짐", "안 되면 거절해도 괜찮음"],
    internalPdr: { p: "동등", d: "어색함(초기)", r: "중간" },
  } satisfies SituationCard,
};

/** ① 상황 읽기 — 매체 감각을 주는 위챗 스레드(정적 mock). */
export const WECHAT_THREAD = {
  title: `微信 · ${"샤오린(小林)"}`,
  messages: [
    { from: "them" as const, who: "샤오린(小林)", text: "发表资料我做好一半了，你那边呢？" },
    { from: "me" as const, who: null, text: "…(내가 지금 이 부탁을 보내야 함)" },
  ],
};

/** ① 상황 읽기 — 관계를 어떻게 읽었는지 자기 진단(정답 채점 없음). */
export const RELATION_GUESS_OPTIONS = [
  "아주 친한 사이",
  "알지만 아직 조금 어색한 사이",
  "오늘 처음 연락하는 사이",
] as const;

/** ③ 수신자 관점 — 학습자의 초고와 무관하게 항상 뜨는 mock 코멘트. */
export const RECEIVER_PERSPECTIVE = {
  points: [
    "이유(정리가 늦음)는 잘 전해질 거예요.",
    "부탁을 여는 완충 한 마디가 없으면 조금 갑작스럽게 느껴질 수 있어요.",
    "아주 편한 사이라면 이대로도 무리 없이 통할 수 있어요.",
  ],
  fidelityCheck: "원문의 '안 되면 편하게 말해줘'(선택권)가 내 번역에 담겼는지 확인해 보세요.",
};

/** ④ 상황 판단 / 표현 실현 2단 진단 — 채점 아님, 자기 성찰용 선택지. */
export const MAPPING_SITUATION_OPTIONS = [
  "부담이 크다고 봤다",
  "부담이 중간 정도라고 봤다",
  "부담이 크지 않다고 봤다",
] as const;
export const MAPPING_REFLECTED_OPTIONS = [
  "판단대로 완화 표현을 넣었다",
  "판단과 달리 완화 표현이 거의 없다",
  "판단과 달리 필요 이상으로 완화했다",
] as const;

/** ⑤ 3종 대조 — 차이 발견용. "정답"이 아니라 관찰 대상 3장. */
export const CONTRAST_ADJUSTED = {
  label: "완충 한 가지만 더한 표현",
  zh: "小林，不好意思，发表资料的截止日期能推迟一天吗？我这部分整理得有点慢。",
  feature: "완충 표현 不好意思 하나만 추가",
};
export const CONTRAST_BOUNDARY = {
  label: "경계 · 문법은 맞는데 사이가 어색해져요",
  zh: "小林您好，非常抱歉打扰您。请问发表资料的截止日期是否可以延期一天？给您带来不便，敬请谅解。",
  features: ["한국식 격식 직역투", "동급생에게 您·敬请谅解 = 거리 두기", "문법은 완벽하나 관계가 어색해짐"],
};

/** ⑥ 메시지 엑스레이 — 학습자 산출을 기능 단위로 보여주는 mock 고정 분해. */
export const XRAY_SEGMENTS: { label: string; present: boolean; note: string }[] = [
  { label: "접근·호칭", present: true, note: "이름을 불러 대화를 열었어요." },
  { label: "완충 표현", present: false, note: "아직 완충 한 마디가 보이지 않아요." },
  { label: "핵심 요청", present: true, note: "마감 연기 요청은 분명해요." },
  { label: "이유 제시", present: true, note: "정리가 늦었다는 이유가 담겼어요." },
  { label: "선택권·거절 여지", present: false, note: "상대가 거절할 수 있다는 신호가 아직 안 보여요." },
];

/** ⑦ 한 곳 수정 — 위치·이유만 제시, 완성된 정답 표현은 주지 않음. */
export const ONE_SPOT_FIX = {
  location: "부탁을 여는 첫 부분",
  hint: "완충 표현이 하나 있으면 훨씬 편하게 읽혀요 (예: 不好意思 / …可以吗). 한 곳만 고쳐보세요.",
};

/**
 * DEV 전용 데모 채우기 값 — 프로토타입 mDemo()에 대응.
 * 학습자 UI에는 노출되지 않으며 [DEV] 설계 확인 패널에서만 쓰인다.
 */
export const DEMO_VALUES = {
  relationGuess: RELATION_GUESS_OPTIONS[1],
  draft: "小林，发表资料的截止日期能推迟一天吗？我这部分整理得有点慢。",
  situationCall: MAPPING_SITUATION_OPTIONS[1],
  productionReflected: MAPPING_REFLECTED_OPTIONS[1],
  revised: "小林，不好意思，发表资料的截止日期能推迟一天吗？我这部分整理得有点慢~",
  csDraft: "尊敬的X教授：您好！冒昧打扰，我想请问发表资料的截止日期是否可以推迟一天，谢谢您的理解。",
};

/** transfer 전용 CS — 기존 CS 인프라(단일 조건 변경) 재사용. */
export const TRANSFER_CS = {
  changedDimension: "상대·매체" as const,
  csLabel: "전이 · 상대와 매체만 변경",
  situation: {
    headline: "이번엔 같은 부탁을, 처음 뵙는 교수님께 이메일로 전해야 합니다.",
    audience: "지도 교수",
    relation: "처음 뵙는 교수 · 상대가 결정권을 가짐",
    channel: "이메일",
    goal: "발표 자료 마감을 하루 미뤄도 되는지 부탁하기",
    mustConvey: ["마감을 하루 연기", "부탁이지 통보가 아님"],
    usableFacts: ["내 파트 정리가 늦어짐"],
    internalPdr: { p: "상대가 높음", d: "초면", r: "중간" },
  } satisfies SituationCard,
};

/** ⑧ 원리 카드 + 완료. */
export const PRINCIPLE_CARD = {
  verdict: "부분 조정 필요",
  verdictNote: "뜻은 정확했고, 완화만 보강하면 됩니다.",
  headline:
    "부담이 있는 부탁은, 친한 사이라도 완화 표현(不好意思 / 可以吗)이 하나 있으면 상대가 더 편하게 받아들이는 데 도움이 될 수 있어요.",
  applyCondition: "편한 매체에서도 부탁의 부담이 '중간' 이상일 때.",
  exception: "아주 급하거나 매우 친하면 생략도 자연스러울 수 있어요 — 규칙이 아니라 스펙트럼.",
};

export const PRACTICE_EVENT_SEQUENCE = [
  "situation_read",
  "first_translation_submitted",
  "receiver_perspective_viewed",
  "mapping_diagnosis_submitted",
  "contrast_viewed",
  "xray_viewed",
  "one_spot_fix_submitted",
  "cs_submitted",
  "principle_viewed",
] as const;
export type PracticeMissionEvent = (typeof PRACTICE_EVENT_SEQUENCE)[number];
