// 화용 초점(target_feature) 카탈로그 — 코드 정본. AI 임의 생성 금지.
//
// 생성계약 v1.3 §2. 축·대역은 화행 공통이 아니라 "화용 초점별"이다(A1):
// 요청의 대역(too_direct/within_band/too_indirect)과 감사의 대역
// (insufficient/within_band/excessive)은 서로 다른 자로 잰다. 문항·피드백은
// 모두 이 카탈로그의 band code를 쓴다(R1·R13).
//
// learner_label·closing_principle_ko는 AI가 생성하지 않고 이 파일에서 복사한다(R14).
//
// v1.3 시드 = 골든 미션 3개(요청·거절·감사 × 중급)에 필요한 3종 + 공손성 보조축.
// 나머지 6화행은 배치 생성 전에 같은 구조로 추가한다.

import type { SpeechActUI } from "@/lib/pragma/enums";
import { realizationResourceLabelsForFeature } from "@/lib/pragma/realizationPack";

/** 판정 대역 하나. 배열 순서 = 척도 순서(과소→적정→과잉). */
export interface BandDef {
  code: string;
  label_ko: string;
}

export interface TargetFeature {
  /** 안정 식별자 — 문항·행에 저장(R13). 예: "request_mitigation_optionality" */
  code: string;
  /** 카탈로그 버전 — 문항에 함께 저장(R13). 정의가 바뀌면 올린다. */
  version: string;
  speech_act: SpeechActUI;
  /** 학습자 화면 "이번 주 핵심" — AI 생성 금지, 여기서 복사(R14) */
  learner_label: string;
  /** 이 초점이 무엇이고 무엇이 아닌지 — 생성 프롬프트에 주입 */
  operational_definition: string;
  /** 판정 축 — 화행·초점별로 다르다(A1). 순서 = 척도 순서 */
  band_schema: BandDef[];
  /** within_band에 해당하는 코드(정답 대역의 중심). 규칙검사 R2가 참조 */
  within_band_code: string;
  /** 이 초점을 실현하는 장치 — 프롬프트가 산출 정합에 사용 */
  relevant_resources: string[];
  /** 이 초점이 아닌 것 — 혼입 방지(예: 격식체 어휘 선택은 직접성 축이 아님) */
  excluded_confounds: string[];
  /** 완료 화면 핵심 한 줄 — AI 생성 금지, 여기서 복사(R14) */
  closing_principle_ko: string;
  /** judge3 반례가 깨야 할 "소박한 규칙"(A1 일반화) */
  counter_rule_note: string;
  // ── zh_ko(중→한) 방향 변형 (계약 0-l·86, 선택 — 없으면 zh_ko 승격 불가) ──
  // 구인 동일(상황 P·D·R 화용 적절성), 산출 장치만 한국어. version·band·within·
  // learner_label·closing은 방향 공용이라 여기엔 없다(비파괴 확장, version 불변).
  operational_definition_zh_ko?: string;
  relevant_resources_zh_ko?: string[];
  excluded_confounds_zh_ko?: string[];
  counter_rule_note_zh_ko?: string;
}

// ── 요청 · 완화와 선택권 ──────────────────────────────────────────────
const REQUEST_MITIGATION_OPTIONALITY: TargetFeature = {
  code: "request_mitigation_optionality",
  version: "1.0",
  speech_act: "request",
  learner_label: "완화와 선택권",
  operational_definition:
    "요청이 상대에게 남기는 '거절할 여지'를 조절하는 초점. 능원동사·의문형·조건절(能不能·可以…吗·如果方便的话)로 부담을 낮추고 상대에게 선택권을 남기는가, 아니면 명령형(把…发过来)으로 여지를 없애는가를 본다. " +
    "격식체 어휘 선택(尊敬的·恳请)이나 호칭 문제는 이 초점이 아니다 — 그것은 공손성 축이다.",
  band_schema: [
    { code: "too_direct", label_ko: "너무 직접적 (선택권을 남기지 않음)" },
    { code: "within_band", label_ko: "알맞음" },
    { code: "too_indirect", label_ko: "지나치게 우회적 (요청이 흐려짐)" },
  ],
  within_band_code: "within_band",
  relevant_resources: realizationResourceLabelsForFeature("request_mitigation_optionality"),
  excluded_confounds: [
    "격식체 어휘 선택 (尊敬的·恳请) — 공손성 축",
    "호칭 (您 vs 你) — 공손성 축",
    "문장 길이 자체",
  ],
  closing_principle_ko:
    "요청은 상대에게 거절할 여지를 얼마나 남기느냐로 무게가 정해집니다. 친밀·저부담이면 직접형도 알맞고, 초면·고부담이면 선택권을 남기는 표현이 어울립니다.",
  counter_rule_note:
    "\"직접적이면 나쁘다\" — 반례: 친한 사이의 낮은 부담 요청에서는 직접형(把报告发我)이 오히려 자연스럽고 적절하다.",
  operational_definition_zh_ko:
    "요청이 상대에게 남기는 '거절할 여지'를 한국어 산출에서 조절하는 초점. 의문형 완화(-아/어 주실 수 있을까요·-아/어도 될까요), 조건절 포석(혹시 괜찮으시면·시간 되시면), 가능성 완충(혹시·-ㄹ지 모르겠지만)으로 부담을 낮추고 선택권을 남기는가, 아니면 명령·단정형(-해 주세요·-하세요, 단독 사용)으로 여지를 없애는가를 본다. " +
    "높임 등급 선택(합쇼체/해요체·-님 호칭)은 이 초점이 아니다 — 공손성 축이다.",
  relevant_resources_zh_ko: [
    "의문형 완화 (-아/어 주실 수 있을까요·-아/어도 될까요·-면 안 될까요)",
    "조건절 포석 (혹시 괜찮으시면·시간 되시면·바쁘지 않으시면)",
    "가능성 완충 (혹시·어쩌면·-ㄹ 수 있을지)",
    "부담 예고 (번거로우시겠지만·부탁 하나 드려도 될까요·죄송한데)",
  ],
  excluded_confounds_zh_ko: [
    "높임 등급·경어 선택 (합쇼체/해요체·-님/-씨 호칭) — 공손성 축",
    "문장 길이 자체",
  ],
  counter_rule_note_zh_ko:
    "\"직접적이면 나쁘다\" — 반례: 친한 동기 사이의 낮은 부담 요청에서는 직접형(\"그 파일 좀 보내 줘\")이 완곡한 장문보다 자연스럽고 적절하다.",
};

// ── 거절 · 완충과 대안 ────────────────────────────────────────────────
const REFUSAL_SOFTENING: TargetFeature = {
  code: "refusal_softening",
  version: "1.0",
  speech_act: "refusal",
  learner_label: "완충과 대안",
  operational_definition:
    "거절의 직접적 부정(不行·不可以)을 완충 장치로 얼마나 감싸는가를 보는 초점. 이유 제시·사과·부분 수용·대안 제시(可以…但是·恐怕·下次)의 유무와 양을 본다. " +
    "완충이 전혀 없어 무뚝뚝한가(too_blunt), 알맞은가(within_band), 완충이 과해 오히려 장황·모호한가(over_elaborate)를 잰다. " +
    "유발 화행(초대·제안·요청)에 따라 어울리는 자원이 다르지만, 그것은 고정 규칙이 아니라 선택적 자원이다.",
  band_schema: [
    { code: "too_blunt", label_ko: "너무 단칼 (완충 없음)" },
    { code: "within_band", label_ko: "알맞음" },
    { code: "over_elaborate", label_ko: "지나치게 장황 (거절이 흐려짐)" },
  ],
  within_band_code: "within_band",
  relevant_resources: realizationResourceLabelsForFeature("refusal_softening"),
  excluded_confounds: [
    "격식체 어휘 선택 — 공손성 축",
    "거절의 명제 자체(무엇을 거절하는가)는 불변항",
    "문장 길이 자체",
  ],
  closing_principle_ko:
    "거절은 완충 장치의 양으로 무게가 정해집니다. 완충이 전혀 없으면 무뚝뚝하게 들리고, 지나치게 많으면 거절인지 아닌지 흐려집니다. 길수록 공손한 것이 아닙니다.",
  counter_rule_note:
    "\"거절은 길수록 공손하다\" — 반례: 친한 사이에서는 간결한 거절(今天不行，改天吧)이 장황한 거절보다 자연스럽고 적절하다.",
  operational_definition_zh_ko:
    "거절의 직접적 부정(\"안 돼요·못 해요\")을 한국어 완충 장치로 얼마나 감싸는가를 보는 초점. 유보 표현(-ㄹ 것 같아요·좀 어려울 것 같아요), 사과·유감(죄송하지만·아쉽지만), 이유 제시, 대안·미래 약속(다음에는 꼭·대신 -면 어떨까요)의 유무와 양을 본다. " +
    "완충이 전혀 없어 무뚝뚝한가(too_blunt), 알맞은가(within_band), 과해서 거절인지 흐려지는가(over_elaborate).",
  relevant_resources_zh_ko: [
    "유보·완화 표현 (좀 어려울 것 같아요·-기는 힘들 것 같아요·아무래도 -겠는데요)",
    "사과·유감 (죄송하지만·아쉽지만·미안한데)",
    "이유 제시 (-아/어서·그날은 선약이 있어서)",
    "대안·미래 약속 (다음에는 꼭·대신 -면 어떨까요·요일을 바꾸면 어때요)",
    "부분 수용 후 전환 (그건 좋은데·-는 되는데 -는 어려워요)",
  ],
  excluded_confounds_zh_ko: [
    "높임 등급·경어 선택 — 공손성 축",
    "거절의 명제 자체(무엇을 거절하는가)는 불변항",
    "문장 길이 자체",
  ],
  counter_rule_note_zh_ko:
    "\"거절은 길수록 공손하다\" — 반례: 친한 사이에서는 간결한 거절(\"오늘은 안 되겠다, 다음에 보자\")이 사과·이유·대안을 겹겹이 쌓은 장황한 거절보다 자연스럽고 적절하다.",
};

// ── 감사 · 강도 조절 ──────────────────────────────────────────────────
const GRATITUDE_CALIBRATION: TargetFeature = {
  code: "gratitude_calibration",
  version: "1.0",
  speech_act: "thanks",
  learner_label: "강도 조절",
  operational_definition:
    "받은 호의의 크기에 감사의 강도를 맞추는 초점. 호의가 작은데 과장된 감사(太感谢您了·真是不知道怎么感谢)를 쏟으면 오히려 거리감을 만들고, 큰 도움에 성의 없는 감사(谢谢)만 하면 부족하게 들린다. " +
    "감사 표현의 강도·반복·부연이 호의의 크기에 비례하는가를 본다.",
  band_schema: [
    { code: "insufficient", label_ko: "부족함 (호의에 비해 약함)" },
    { code: "within_band", label_ko: "알맞음" },
    { code: "excessive", label_ko: "과함 (거리감을 만듦)" },
  ],
  within_band_code: "within_band",
  relevant_resources: realizationResourceLabelsForFeature("gratitude_calibration"),
  excluded_confounds: [
    "호칭·격식 — 공손성 축",
    "감사의 대상(무엇에 감사하는가)은 불변항",
  ],
  closing_principle_ko:
    "감사는 받은 호의의 크기에 강도를 맞출 때 자연스럽습니다. 작은 호의에 과한 감사는 정중함이 아니라 거리감을 만들고, 큰 도움에 성의 없는 감사는 부족하게 들립니다.",
  counter_rule_note:
    "\"감사는 강할수록 좋다\" — 반례: 가벼운 호의(펜을 빌려줌)에는 간단한 감사(谢谢)가 과장된 감사보다 자연스럽고 적절하다. " +
    "감사 과잉이 거리감을 만든다는 것은 요구분석의 실제 사례다(Dai 2023: \"Thanking too much can be alienating\").",
  operational_definition_zh_ko:
    "받은 호의의 크기에 한국어 감사 표현의 강도를 맞추는 초점. 강도 사다리(고마워 → 고마워요/감사합니다 → 정말 감사드립니다 → 뭐라고 감사드려야 할지 모르겠습니다)에서의 위치, 부연·구체화(덕분에 -았/었어요), 보답 언급의 유무·양이 호의의 크기에 비례하는가를 본다. " +
    "작은 호의에 과장된 감사는 거리감을 만들고, 큰 도움에 성의 없는 감사는 부족하게 들린다.",
  relevant_resources_zh_ko: [
    "강도 부사·서법 (정말·너무·진심으로 감사드립니다)",
    "부연·구체화 (덕분에 일이 잘 풀렸어요·큰 도움이 됐어요)",
    "보답 의향 (다음에 꼭 밥 살게·신세 갚을게요)",
    "가벼운 호의엔 간단한 감사 (고마워요·감사합니다)",
  ],
  excluded_confounds_zh_ko: [
    "호칭·높임 등급 — 공손성 축",
    "감사의 대상(무엇에 감사하는가)은 불변항",
  ],
  counter_rule_note_zh_ko:
    "\"감사는 강할수록 좋다\" — 반례: 가벼운 호의(펜을 빌려줌)에는 \"고마워요\" 한 마디가 과장된 감사(\"정말 뭐라 감사드려야 할지…\")보다 자연스럽고 적절하다.",
};

// ── 공손성 (보조축) — v1.3 미사용 ─────────────────────────────────────
// 계약 0-b·19: axis_feature = unit.target_feature 고정. 공손성 혼용 금지.
// 공손성이 '중심 초점'인 단원에서만 이 코드를 unit.target_feature로 쓴다.
const POLITENESS: TargetFeature = {
  code: "politeness",
  version: "1.0",
  speech_act: "request", // placeholder — 공손성 중심 단원 정의 시 확정
  learner_label: "공손성",
  operational_definition:
    "호칭·대인 배려의 격식이 상황에 맞는가를 보는 축. 무례한가·알맞은가·지나치게 공손한가. " +
    "v1.3에서는 문항 축으로 쓰지 않는다(단일 초점 원칙). 공손성 중심 단원에서만 중심 초점으로 사용.",
  band_schema: [
    { code: "impolite", label_ko: "무례함" },
    { code: "within_band", label_ko: "알맞음" },
    { code: "overpolite", label_ko: "지나치게 공손함" },
  ],
  within_band_code: "within_band",
  relevant_resources: ["호칭 (您/你)", "인사·안부", "격식 표지"],
  excluded_confounds: ["요청의 직접성 — 별도 축", "거절의 완충 — 별도 축"],
  closing_principle_ko: "공손함은 상황에 맞을 때 자연스럽습니다.",
  counter_rule_note: "\"공손할수록 좋다\" — 반례: 친한 사이의 과잉 격식은 거리감을 만든다.",
};

/** 코드 → 화용 초점. AI가 아니라 이 맵이 정본이다. */
export const TARGET_FEATURES: Record<string, TargetFeature> = {
  [REQUEST_MITIGATION_OPTIONALITY.code]: REQUEST_MITIGATION_OPTIONALITY,
  [REFUSAL_SOFTENING.code]: REFUSAL_SOFTENING,
  [GRATITUDE_CALIBRATION.code]: GRATITUDE_CALIBRATION,
  [POLITENESS.code]: POLITENESS,
};

/** 화행 → 그 화행의 기본 화용 초점 코드(골든 미션·승격 기본값). */
export const DEFAULT_FEATURE_BY_ACT: Partial<Record<SpeechActUI, string>> = {
  request: REQUEST_MITIGATION_OPTIONALITY.code,
  refusal: REFUSAL_SOFTENING.code,
  thanks: GRATITUDE_CALIBRATION.code,
};

export function getTargetFeature(code: string): TargetFeature | undefined {
  return TARGET_FEATURES[code];
}

/** 카탈로그에 존재하고 band code가 그 초점의 band_schema에 있는지(R1·R13). */
export function isBandCodeValid(featureCode: string, bandCode: string): boolean {
  const f = TARGET_FEATURES[featureCode];
  if (!f) return false;
  return f.band_schema.some((b) => b.code === bandCode);
}

/** scale4 — 전 화행 공통 전반 적절성 척도(초점 band와 별개, 계약 §2). */
export const SCALE4_CODES = [
  "very_appropriate",
  "somewhat_appropriate",
  "somewhat_inappropriate",
  "very_inappropriate",
] as const;
export type Scale4Code = (typeof SCALE4_CODES)[number];
export const SCALE4_LABELS: Record<Scale4Code, string> = {
  very_appropriate: "매우 적절",
  somewhat_appropriate: "다소 적절",
  somewhat_inappropriate: "다소 부적절",
  very_inappropriate: "매우 부적절",
};
