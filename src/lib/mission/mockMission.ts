// Mock data for the learner 5-step mission shell (UI mockup only — no DB).
//
// Shape follows PRAGMA 최종스펙 v3.1: one shared `scenario` → three
// `item_version`s selected by level_preset. Nothing here is persisted; this
// exists so the shell can be reviewed visually before any backend exists.

export type Level = "beginner" | "intermediate" | "advanced";
export type JudgmentAxis = "politeness" | "register" | "axis_fidelity";
export type CsType = "single_pdr" | "double_pdr" | "channel" | "none";
export type ProductionType =
  | "strength_adjust"
  | "controlled_translation"
  | "short_email"
  | "real_message";

/** One judgment candidate. Label letters are display-only; id is the key. */
export interface Candidate {
  id: string;
  text: string;
  /** Native-tutor one-word read (mock, shown only in feedback). */
  gloss: string;
}

/** Natural-language situation card. P/D/R stays internal — never rendered. */
export interface SituationCard {
  headline: string;
  audience: string;
  relation: string;
  channel: string;
  goal: string;
  mustConvey: string[];
  usableFacts: string[];
  /** Internal only — displayed in the dev panel to prove it stays hidden. */
  internalPdr: { p: string; d: string; r: string };
}

export interface LevelPreset {
  level: Level;
  label: string;
  /** Candidate subset for this item_version. */
  candidateIds: string[];
  judgmentAxis: JudgmentAxis;
  axisPrompt: string;
  /** Rating scale, low index = too direct end. Spec §2 wording. */
  scale: string[];
  showNeedsAdjust: boolean;
  showConfidence: boolean;
  reasonTags: string[];
  /** Beginner: single-tap optional. Others: required. */
  reasonRequired: boolean;
  csType: CsType;
  csLabel: string;
  csSituation: SituationCard;
  production: ProductionType;
  productionPrompt: string;
  hintPolicy: "on" | "off";
  /** Beginner practice only — "오늘의 표현" mini card. */
  miniCard?: string[];
  reportFocus: string[];
}

// ── Shared scenario (one per mission) ──

export const SCENARIO = {
  id: "scn_payment_delay",
  speechAct: "요청",
  mode: "번역" as const,
  channel: "email" as const,
  domain: "직장 · 무역",
  sourceText: "결제일을 일주일만 미뤄 주실 수 있을까요?",
  sourceInformationUnits: ["결제일", "일주일 연기", "요청(의문 형식)"],
  allowedCommitments: ["새 결제일: 다음 주 금요일"],
  situation: {
    headline: "처음 만나는 중국 거래처 책임자에게 업무 이메일로 결제일 연기를 요청해야 합니다.",
    audience: "중국 거래처 책임자 (王经理)",
    relation: "처음 만나는 사이 · 상대가 결정권을 가짐",
    channel: "업무 이메일",
    goal: "결제일을 일주일 미뤄도 되는지 요청하기",
    mustConvey: ["결제일을 일주일 연기", "요청이지 통보가 아님"],
    usableFacts: ["새 결제일은 다음 주 금요일", "사내 결제 절차 지연"],
    internalPdr: { p: "상대가 높음", d: "멂", r: "높음" },
  } satisfies SituationCard,
};

// ── Candidate pool (pilot A~F + one advanced-only micro variant) ──

export const CANDIDATES: Record<string, Candidate> = {
  cand_a: { id: "cand_a", text: "能不能把付款日期延后一周？", gloss: "比较随便" },
  cand_b: { id: "cand_b", text: "不知道是否方便将付款日期推迟一周？", gloss: "专业委婉" },
  cand_c: { id: "cand_c", text: "不知贵公司是否方便将付款日期延后一周？", gloss: "官方疏离" },
  cand_d: { id: "cand_d", text: "把付款日期延后一周吧。", gloss: "强势要求" },
  cand_e: { id: "cand_e", text: "请您把付款日期延后一周。", gloss: "机械通知" },
  cand_f: { id: "cand_f", text: "这边可能需要将付款日期稍微延后一周，可以吗？", gloss: "亲切商量" },
  cand_g: {
    id: "cand_g",
    text: "关于付款日期，我方希望能延后一周，还请贵司予以支持。",
    gloss: "正式但少了选择余地",
  },
};

// ── CS situations (only the changed dimensions differ) ──

const CS_DOUBLE: SituationCard = {
  headline: "여러 번 거래한 친한 동급 담당자에게 같은 요청을 합니다.",
  audience: "거래처 담당자 (小李)",
  relation: "여러 번 거래한 동급 · 편한 사이",
  channel: "업무 이메일",
  goal: "결제일을 일주일 미뤄도 되는지 요청하기",
  mustConvey: ["결제일을 일주일 연기", "요청이지 통보가 아님"],
  usableFacts: ["새 결제일은 다음 주 금요일", "사내 결제 절차 지연"],
  internalPdr: { p: "동등", d: "가까움", r: "높음" },
};

const CS_SINGLE: SituationCard = {
  ...SCENARIO.situation,
  headline: "이번에는 여러 번 거래해 온 익숙한 책임자에게 같은 요청을 합니다.",
  relation: "여러 번 거래한 사이 · 상대가 결정권을 가짐",
  internalPdr: { p: "상대가 높음", d: "가까움", r: "높음" },
};

const CS_CHANNEL: SituationCard = {
  ...SCENARIO.situation,
  headline: "같은 상대에게, 이번에는 위챗 메시지로 같은 요청을 합니다.",
  channel: "위챗 메시지",
  internalPdr: { p: "상대가 높음", d: "멂", r: "높음" },
};

// ── Level presets (item_version stand-ins) ──

// Spec §2 wording (최종스펙 v3.1 = 유일 정본). NOTE: the workflow LOCK doc
// words the 5-point poles differently (공손함↔무례함) — unresolved, see report.
const SCALE_5 = [
  "너무 직접적",
  "조금 직접적",
  "알맞음",
  "조금 과하게 공손",
  "필요 이상으로 공손",
];
const SCALE_3 = ["지나치게 직접적이다", "상황에 알맞다", "필요 이상으로 공손하다"];

export const PRESETS: Record<Level, LevelPreset> = {
  beginner: {
    level: "beginner",
    label: "입문 · HSK 4",
    candidateIds: ["cand_d", "cand_b", "cand_c"],
    judgmentAxis: "politeness",
    axisPrompt: "이 표현이 이 상황에 얼마나 알맞은지 고르세요.",
    scale: SCALE_3,
    showNeedsAdjust: false,
    showConfidence: false,
    reasonTags: ["너무 직접적", "너무 딱딱함", "알맞음"],
    reasonRequired: false,
    csType: "double_pdr",
    csLabel: "CS-2 · 큰 대조 (관계·거리 변경)",
    csSituation: CS_DOUBLE,
    production: "strength_adjust",
    productionPrompt: "아래 문장은 너무 직접적입니다. 완화 표현을 하나만 추가해 보세요.",
    hintPolicy: "on",
    miniCard: ["能不能……？", "可以吗？", "不好意思……", "麻烦您……"],
    reportFocus: ["관습 표현 인식", "명백한 과직접·과공손 탐지", "핵심 의미 보존"],
  },
  intermediate: {
    level: "intermediate",
    label: "중급 · HSK 5",
    candidateIds: ["cand_a", "cand_b", "cand_c", "cand_e", "cand_f"],
    judgmentAxis: "politeness",
    axisPrompt: "이 표현이 이 상황에 얼마나 알맞은지 고르세요. (이번 문항의 판단 초점: 공손성)",
    scale: SCALE_5,
    showNeedsAdjust: true,
    showConfidence: true,
    reasonTags: [
      "너무 직접적",
      "지나치게 격식적",
      "너무 가벼움",
      "상대에게 선택권을 줌",
      "채널과 맞지 않음",
      "겉은 공손하지만 명령처럼 들림",
    ],
    reasonRequired: true,
    csType: "single_pdr",
    csLabel: "CS-1 · 한 조건만 변경 (거리)",
    csSituation: CS_SINGLE,
    production: "controlled_translation",
    productionPrompt:
      "위 원문을 이 상황에 맞게 중국어로 옮기세요. 원문에 없는 사실·사과·약속을 추가하지 마세요.",
    hintPolicy: "on",
    reportFocus: ["맥락 민감성", "E형 함정(请您+명령)", "판단–산출 전이"],
  },
  advanced: {
    level: "advanced",
    label: "고급 · HSK 6",
    candidateIds: ["cand_b", "cand_c", "cand_f", "cand_g"],
    judgmentAxis: "politeness",
    axisPrompt:
      "네 표현 모두 문법적으로 맞습니다. 이 상황에서의 관계적 효과를 기준으로 평가하세요.",
    scale: SCALE_5,
    showNeedsAdjust: true,
    showConfidence: true,
    reasonTags: [
      "상대의 선택권을 제한함",
      "관계를 지나치게 멀게 만듦",
      "진정성이 부족해 보임",
      "신뢰를 떨어뜨릴 수 있음",
      "책임·약속을 과도하게 떠맡음",
    ],
    reasonRequired: true,
    csType: "channel",
    csLabel: "CS-3 · 채널 변경 (이메일 → 위챗)",
    csSituation: CS_CHANNEL,
    production: "real_message",
    productionPrompt:
      "위 brief와 사용 가능한 사실만으로 실제 보낼 이메일을 완성하세요. brief에 없는 사실·약속은 쓸 수 없습니다.",
    hintPolicy: "off",
    reportFocus: ["brief·사실 근거", "관계 관리", "무단 확약"],
  },
};

// ── Mock feedback data (step 3) ──

/** Class distribution: candidateId → % choosing it as Best. */
export const MOCK_CLASS_BEST: Record<string, number> = {
  cand_a: 8,
  cand_b: 34,
  cand_c: 29,
  cand_d: 2,
  cand_e: 6,
  cand_f: 17,
  cand_g: 12,
};

/** Expert reference range (not a single answer). */
export const MOCK_EXPERT_RANGE: Record<string, string> = {
  cand_a: "친한 사이의 구두 대화에는 가능하나, 첫 거래 이메일에는 직설적",
  cand_b: "첫 거래 이메일의 안전한 선택. 상대에게 거절할 여지를 줌",
  cand_c: "낯선 대기업 상대에 적합. 친한 거래처에는 차갑게 들릴 수 있음",
  cand_d: "상급자가 하급자에게 강요하는 느낌. 이 상황에서는 부적절",
  cand_e: "请您이 있어도 본질은 명령문. 협상 상황에는 부적절",
  cand_f: "친하고 동급인 상대에게 가장 적합. 첫 거래에는 다소 가벼움",
  cand_g: "격식은 맞으나 상대의 선택권을 좁힘",
};

export const MOCK_OPPOSING_REASONS: { stance: string; text: string }[] = [
  {
    stance: "C를 고른 이유",
    text: "첫 거래이고 회사 대 회사의 금전 문제라 가장 공식적인 표현이 안전하다고 봤습니다.",
  },
  {
    stance: "B를 고른 이유",
    text: "C는 지나치게 멀게 느껴집니다. B가 공손하면서도 상대가 답하기 편합니다.",
  },
];

/** Mock report rows: 3 rubric axes + sub-diagnostic tags. */
export const MOCK_REPORT = {
  headline: "처음 만나는 상대에게 표현이 조금 단단해집니다.",
  evidence: "이번 과제에서 Best로 고른 표현이 학급 다수(B)보다 직접적인 쪽이었습니다.",
  classContext: "학급의 34%가 B를, 29%가 C를 골랐습니다.",
  strategy: "요청에는 상대가 거절할 여지를 남기는 표현(不知道是否方便…)을 먼저 떠올려 보세요.",
  next: "다음 연습: 같은 요청을 친한 동급 담당자에게 (CS-2)",
  rubrics: [
    {
      axis: "의미충실성",
      verdict: "보존",
      tags: [] as string[],
      note: "원문의 세 정보 단위가 모두 유지되었습니다.",
    },
    {
      axis: "화용적절성",
      verdict: "조정 필요",
      tags: ["공손성 조절", "P·D·R 민감성"],
      note: "첫 거래 상대에게는 선택권을 남기는 표현이 더 안전합니다.",
    },
    {
      axis: "목표어구현도",
      verdict: "양호",
      tags: [],
      note: "문법과 어휘 결합에 문제가 없습니다.",
    },
  ],
};

/** Internal 6-event log (spec §3) — shown in the dev panel only. */
export const EVENT_SEQUENCE = [
  "context_viewed",
  "judgment_submitted",
  "context_switch_submitted",
  "feedback_viewed",
  "production_submitted",
  "report_viewed",
] as const;
export type MissionEvent = (typeof EVENT_SEQUENCE)[number];
