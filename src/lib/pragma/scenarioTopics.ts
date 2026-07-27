// 편성층 메타데이터 — theme_code(강좌 기획 단위) + topic 카탈로그(장면 시드).
// 생성계약 v1.3 §2b · 0-c·24~26. 코드 정본, AI 임의 생성 금지.
//
// 왜 domain과 별개인가:
// - domain(일상/학교/직장) = 연구·생성 통제축(난이도 정합·소재 방어·주차 골격 참조).
// - theme_code(8종) = 교강사·학생이 보는 "강좌 이름표"(초급 여행 중국어 등). domain을
//   대체하지 않는 교차 축이다. theme↔domain 허용 매핑을 코드로 못박아 모순 생성을 막는다.
// - topic_code = Dai 2023 기반 장면 시드의 형식화. 배치 생성이 시드에서 상황을 뽑으므로
//   "생성 입력이 곧 태그"(태깅 비용 0).
//
// ⚠️ 논문 서술 경계(0-c·24): theme·topic은 화용 판정 변인이 아니라 콘텐츠 검색·편성 및
//    상황 다양성 확보용 운영 메타데이터다. 새 화용 변인으로 설명하지 않는다.

import type { Domain, LearnerLevel, SpeechActUI } from "@/lib/pragma/enums";

// ── theme_code (8종 통제값) ───────────────────────────────────────────
export const THEME_CODES = [
  "campus_study",
  "daily_living",
  "travel_mobility",
  "relationship_social",
  "career_workplace",
  "commerce_customer",
  "digital_content",
  "international_exchange",
] as const;
export type ThemeCode = (typeof THEME_CODES)[number];

export const THEME_LABEL: Record<ThemeCode, string> = {
  campus_study: "대학생활·학업",
  daily_living: "일상생활",
  travel_mobility: "여행·이동",
  relationship_social: "친구·대인관계",
  career_workplace: "취업·직장",
  commerce_customer: "상거래·고객응대",
  digital_content: "콘텐츠·SNS·플랫폼",
  international_exchange: "유학·국제교류",
};

/** theme → 허용 domain. 코어 검사(R1c)가 참조 — 모순 생성 차단. */
export const THEME_ALLOWED_DOMAINS: Record<ThemeCode, Domain[]> = {
  campus_study: ["school"],
  daily_living: ["daily"],
  travel_mobility: ["daily"],
  relationship_social: ["daily"],
  career_workplace: ["work"],
  commerce_customer: ["daily", "work"], // 고객 입장=일상 / 응대 직원=직장
  digital_content: ["daily", "work"], // SNS 이용자=일상 / 크리에이터·마케터=직장
  international_exchange: ["school", "daily"],
};

// ── topic 카탈로그 (장면 시드) ────────────────────────────────────────
export interface ScenarioTopic {
  code: string;
  labelKo: string;
  themeCode: ThemeCode;
  /** 이 topic이 놓일 수 있는 domain (theme 허용 domain의 부분집합) */
  allowedDomains: Domain[];
  /** 이 topic에 어울리는 화행. 비우면 전 화행 허용 */
  allowedSpeechActs?: SpeechActUI[];
  /** 생성 프롬프트 주입용 장면 시드 (Dai 2023 기반 + 재설계) */
  situationSeedKo: string;
  sourceNote?: string;
}

// 정치·시사·정부 기관 소재는 배제(§7-1). 학부 수업 콘텐츠 적합성 우선.
export const SCENARIO_TOPICS: ScenarioTopic[] = [
  // ── campus_study (school) ──
  {
    code: "deadline_extension",
    labelKo: "과제 마감 연장 요청",
    themeCode: "campus_study",
    allowedDomains: ["school"],
    allowedSpeechActs: ["request", "apology"],
    situationSeedKo: "교수/조교에게 과제 제출 기한을 미뤄 달라고 부탁하는 상황",
    sourceNote: "Dai 2023 학업 상호작용",
  },
  {
    code: "office_hour_request",
    labelKo: "면담·질문 시간 요청",
    themeCode: "campus_study",
    allowedDomains: ["school"],
    allowedSpeechActs: ["request"],
    situationSeedKo: "교수에게 면담 시간을 잡아 달라고 요청하거나 수업 내용을 다시 묻는 상황",
  },
  {
    code: "group_work_coordination",
    labelKo: "조별 과제 역할 조율",
    themeCode: "campus_study",
    allowedDomains: ["school"],
    situationSeedKo: "조별 과제를 함께 수행하는 학생들 사이에서 생기는 상호작용 상황",
  },
  {
    code: "school_request_refusal",
    labelKo: "학교 과제 역할 거절",
    themeCode: "campus_study",
    allowedDomains: ["school"],
    allowedSpeechActs: ["refusal"],
    situationSeedKo: "학교 관계의 상대가 부탁한 과제 관련 역할을 맡지 않겠다고 알리는 상황",
  },
  {
    code: "school_activity_invitation",
    labelKo: "학교 활동 초대",
    themeCode: "campus_study",
    allowedDomains: ["school"],
    allowedSpeechActs: ["agreement"],
    situationSeedKo: "학교 관계의 상대에게 스터디·학과 행사·교내 활동에 함께 참여하자고 초대하는 상황",
  },
  {
    code: "school_viewpoint_opposition",
    labelKo: "학교 의견 반대",
    themeCode: "campus_study",
    allowedDomains: ["school"],
    allowedSpeechActs: ["opposition"],
    situationSeedKo: "학교 관계의 상대가 수업이나 조별과제에서 제시한 의견과 다른 견해를 밝히는 상황",
  },
  {
    code: "school_academic_compliment",
    labelKo: "학교 학업 칭찬",
    themeCode: "campus_study",
    allowedDomains: ["school"],
    allowedSpeechActs: ["compliment"],
    situationSeedKo: "학교 관계의 상대가 발표나 과제에서 보인 구체적인 강점을 칭찬하는 상황",
  },
  {
    code: "recommendation_letter_request",
    labelKo: "추천서 부탁",
    themeCode: "campus_study",
    allowedDomains: ["school"],
    allowedSpeechActs: ["request", "thanks"],
    situationSeedKo: "교수에게 유학·장학 추천서를 부탁하고 이후 감사를 전하는 상황",
  },

  // ── daily_living (daily) ──
  // 경계 규칙(계약 0-k·81⑤): 친구 "관계 유지"가 초점이면 relationship_social,
  // 이웃·상인 등 비인격적 관계의 생활 문제면 daily_living. (예: borrow_favor=이웃 계열 /
  // favor_thanks=친구 관계 계열)
  {
    code: "neighbor_noise",
    labelKo: "이웃 소음 문제",
    themeCode: "daily_living",
    allowedDomains: ["daily"],
    allowedSpeechActs: ["request", "complaint", "apology"],
    situationSeedKo: "이웃에게 소음을 줄여 달라고 부탁하거나 내 소음을 사과하는 상황",
  },
  {
    code: "borrow_favor",
    labelKo: "물건·도움 빌리기",
    themeCode: "daily_living",
    allowedDomains: ["daily"],
    allowedSpeechActs: ["request", "thanks"],
    situationSeedKo: "친구·이웃에게 물건을 빌리거나 작은 도움을 청하고 감사를 전하는 상황",
  },
  {
    code: "club_meetup_invite",
    labelKo: "동호회·모임 초대",
    themeCode: "daily_living",
    allowedDomains: ["daily"],
    allowedSpeechActs: ["agreement", "refusal"],
    situationSeedKo: "동호회 모임에 초대하거나 초대를 정중히 거절하는 상황",
  },

  // ── travel_mobility (daily) ──
  {
    code: "hotel_request",
    labelKo: "숙소 요청·문제 해결",
    themeCode: "travel_mobility",
    allowedDomains: ["daily"],
    allowedSpeechActs: ["request", "complaint"],
    situationSeedKo: "호텔·숙소에 방 변경이나 문제 해결을 요청하는 상황",
  },
  {
    code: "direction_help",
    labelKo: "길·교통 도움 요청",
    themeCode: "travel_mobility",
    allowedDomains: ["daily"],
    allowedSpeechActs: ["request", "thanks"],
    situationSeedKo: "낯선 사람에게 길·교통편을 묻고 도움에 감사하는 상황",
  },
  {
    code: "booking_change",
    labelKo: "예약 변경·취소",
    themeCode: "travel_mobility",
    allowedDomains: ["daily"],
    allowedSpeechActs: ["request", "apology"],
    situationSeedKo: "식당·투어 예약을 변경하거나 취소를 알리며 양해를 구하는 상황",
  },

  // ── relationship_social (daily) ──
  {
    code: "invitation_refusal",
    labelKo: "초대 거절",
    themeCode: "relationship_social",
    allowedDomains: ["daily"],
    allowedSpeechActs: ["refusal", "apology"],
    situationSeedKo: "친구의 식사·행사 초대를 사정상 거절하는 상황",
  },
  {
    code: "congratulation_gift",
    labelKo: "축하·선물 감사",
    themeCode: "relationship_social",
    allowedDomains: ["daily"],
    allowedSpeechActs: ["thanks", "compliment"],
    situationSeedKo: "친구의 선물·축하에 감사를 전하거나 상대를 칭찬하는 상황",
  },
  {
    code: "apology_lateness",
    labelKo: "약속 늦음 사과",
    themeCode: "relationship_social",
    allowedDomains: ["daily"],
    allowedSpeechActs: ["apology"],
    situationSeedKo: "약속에 늦거나 약속을 못 지켜 친구에게 사과하는 상황",
  },
  {
    code: "favor_thanks",
    labelKo: "도움에 대한 감사",
    themeCode: "relationship_social",
    allowedDomains: ["daily"],
    allowedSpeechActs: ["thanks"],
    situationSeedKo: "친구가 베푼 도움의 크기에 맞게 감사를 전하는 상황",
  },

  // ── career_workplace (work) ──
  {
    code: "schedule_change",
    labelKo: "회의·일정 변경",
    themeCode: "career_workplace",
    allowedDomains: ["work"],
    allowedSpeechActs: ["request", "apology", "proposal"],
    situationSeedKo: "상사·동료·거래처에 회의나 마감 일정 변경을 요청·통보하는 상황",
  },
  {
    code: "task_delegation_refusal",
    labelKo: "업무 요청 거절",
    themeCode: "career_workplace",
    allowedDomains: ["work"],
    allowedSpeechActs: ["refusal"],
    situationSeedKo: "동료·상사의 추가 업무 요청을 사정상 거절하는 상황",
  },
  {
    code: "delay_apology",
    labelKo: "납기·업무 지연 사과",
    themeCode: "career_workplace",
    allowedDomains: ["work"],
    allowedSpeechActs: ["apology"],
    situationSeedKo: "거래처·상사에게 납기·업무 지연을 사과하고 후속을 알리는 상황",
  },
  {
    code: "collaboration_proposal",
    labelKo: "협업·개선 제안",
    themeCode: "career_workplace",
    allowedDomains: ["work"],
    allowedSpeechActs: ["proposal", "opposition"],
    situationSeedKo: "동료·상사에게 협업 방식이나 업무 개선을 제안하는 상황",
  },
  // 시드 작성 규칙: P·D 관계와 수행 매체를 고정하지 않는다. 셀 축이 시드보다 우선하며,
  // 번역·통역 어느 모드에서도 같은 소재를 관계·장면에 맞게 재구성할 수 있어야 한다.
  {
    code: "work_support_thanks",
    labelKo: "업무 도움 감사",
    themeCode: "career_workplace",
    allowedDomains: ["work"],
    allowedSpeechActs: ["thanks"],
    situationSeedKo: "직장 관계의 상대가 업무 검토·협조·문제 해결에 도움을 준 뒤, 그 구체적인 기여에 감사를 전하는 상황",
  },
  {
    code: "work_activity_invitation",
    labelKo: "직장 공동 활동 초대",
    themeCode: "career_workplace",
    allowedDomains: ["work"],
    allowedSpeechActs: ["agreement"],
    situationSeedKo: "직장 관계의 상대에게 점심·직무 스터디·사내 행사 등 공동 활동에 함께 참여하자고 초대하는 상황",
  },
  {
    code: "work_process_complaint",
    labelKo: "업무 과정 불만",
    themeCode: "career_workplace",
    allowedDomains: ["work"],
    allowedSpeechActs: ["complaint"],
    situationSeedKo: "직장 관계의 상대에게 반복된 일정 변경·업무 전달 누락·품질 문제로 겪은 어려움을 알리는 상황",
  },

  // ── commerce_customer (daily | work) ──
  {
    code: "refund_request",
    labelKo: "환불·교환 요청",
    themeCode: "commerce_customer",
    allowedDomains: ["daily"],
    allowedSpeechActs: ["request", "complaint"],
    situationSeedKo: "구매한 상품의 환불·교환을 판매자에게 요청하는 상황(고객 입장)",
  },
  {
    code: "complaint_response",
    labelKo: "고객 불만 응대",
    themeCode: "commerce_customer",
    allowedDomains: ["work"],
    allowedSpeechActs: ["apology", "proposal"],
    situationSeedKo: "고객의 불만에 사과하고 해결책을 제시하는 상황(응대 직원 입장)",
  },
  {
    code: "price_negotiation",
    labelKo: "가격·조건 문의",
    themeCode: "commerce_customer",
    allowedDomains: ["daily", "work"],
    allowedSpeechActs: ["request", "proposal"],
    situationSeedKo: "판매자·거래처에 가격이나 조건을 문의·조정하는 상황",
  },

  // ── digital_content (daily | work) ──
  // ⚠️ 정의 축소(계약 0-k·81③): 콘텐츠 제작·게시·커뮤니티 운영·크리에이터 협업만.
  //    "메신저·단체방을 썼다"는 매체 사실만으로 digital에 분류하지 않는다(매체 = channel 축).
  {
    code: "collab_dm_request",
    labelKo: "협업 DM 제안",
    themeCode: "digital_content",
    allowedDomains: ["work"],
    allowedSpeechActs: ["proposal", "request"],
    situationSeedKo: "크리에이터·브랜드 담당자에게 협업을 제안하는 메시지 상황",
  },
  {
    code: "comment_feedback_disagreement",
    labelKo: "피드백·이견 표현",
    themeCode: "digital_content",
    allowedDomains: ["daily", "work"],
    allowedSpeechActs: ["opposition", "compliment"],
    situationSeedKo: "온라인에서 상대의 콘텐츠·의견에 정중히 이견을 밝히거나 칭찬하는 상황",
  },
  {
    code: "content_reuse_permission",
    labelKo: "콘텐츠 사용 허락",
    themeCode: "digital_content",
    allowedDomains: ["daily", "work"],
    allowedSpeechActs: ["request", "refusal"],
    situationSeedKo: "다른 크리에이터에게 콘텐츠 2차 사용 허락을 요청하거나, 온 요청을 정중히 거절하는 상황",
  },
  // 구 group_chat_coordination(단체방 일정 조율)은 매체 기준 분류라 삭제 —
  // 목적 기준으로 2분할(계약 0-k·81③). campus 팀플 조율은 기존 group_work_coordination이 담당.
  {
    code: "work_team_chat_coordination",
    labelKo: "업무 단체방 조율",
    themeCode: "career_workplace",
    allowedDomains: ["work"],
    allowedSpeechActs: ["request", "proposal"],
    situationSeedKo: "업무 단체방에서 동료들과 일정·업무 분담·보고 순서를 조율하는 상황",
  },
  {
    code: "friend_group_plan_coordination",
    labelKo: "모임 약속 조율",
    themeCode: "relationship_social",
    allowedDomains: ["daily"],
    allowedSpeechActs: ["proposal", "refusal", "agreement"],
    situationSeedKo: "친구들 모임 날짜·장소를 조율하거나 변경을 제안·거절하는 상황",
  },

  // ── international_exchange (school | daily) ──
  {
    code: "exchange_program_inquiry",
    labelKo: "교환·유학 문의",
    themeCode: "international_exchange",
    allowedDomains: ["school"],
    allowedSpeechActs: ["request"],
    situationSeedKo: "교환학생·유학 담당자에게 절차·서류를 문의하는 상황",
  },
  {
    code: "host_family_thanks",
    labelKo: "호스트·도움 감사",
    themeCode: "international_exchange",
    allowedDomains: ["daily"],
    allowedSpeechActs: ["thanks"],
    situationSeedKo: "유학 중 호스트·현지 친구의 도움에 감사를 전하는 상황",
  },
  {
    code: "cultural_misunderstanding_apology",
    labelKo: "문화 차이 오해 사과",
    themeCode: "international_exchange",
    allowedDomains: ["daily", "school"],
    allowedSpeechActs: ["apology"],
    situationSeedKo: "문화 차이로 생긴 오해나 실수를 현지 상대에게 사과하는 상황",
  },
  // 보강 3종(계약 0-k·81④) — 국제교류 "프로그램 고유" 장면만. 비자·정부기관은 §7-1
  // 소재 배제와 충돌로 기각, 은행·통신은 daily 소속 원칙.
  {
    code: "buddy_program_arrangement",
    labelKo: "버디 프로그램 조율",
    themeCode: "international_exchange",
    allowedDomains: ["school", "daily"],
    allowedSpeechActs: ["request", "proposal", "thanks"],
    situationSeedKo: "배정된 버디(도우미 학생)와 첫 연락·만남 약속·활동 일정을 조율하는 상황",
  },
  {
    code: "exchange_housing_assignment",
    labelKo: "교환 기숙사 조정",
    themeCode: "international_exchange",
    allowedDomains: ["school"],
    allowedSpeechActs: ["request", "complaint"],
    situationSeedKo: "국제교류처가 배정한 기숙사 방·입실 일정의 문제를 알리고 조정을 요청하는 상황",
  },
  {
    code: "exchange_orientation_schedule",
    labelKo: "오리엔테이션 일정",
    themeCode: "international_exchange",
    allowedDomains: ["school"],
    allowedSpeechActs: ["request", "apology"],
    situationSeedKo: "교환학생 오리엔테이션 일정을 문의하거나 불참·지각에 대해 양해를 구하는 상황",
  },
  // 의료·생활서비스(계약 0-k·81⑤) — 여행·유학 실전 최빈 장면. primary theme = daily.
  {
    code: "hospital_pharmacy_visit",
    labelKo: "병원·약국 이용",
    themeCode: "daily_living",
    allowedDomains: ["daily"],
    allowedSpeechActs: ["request", "thanks"],
    situationSeedKo: "병원·약국에서 증상을 설명하고 예약 변경이나 복용 안내를 요청하는 상황",
  },
];

// ── 조회 헬퍼 ─────────────────────────────────────────────────────────
const TOPIC_BY_CODE: Record<string, ScenarioTopic> = Object.fromEntries(
  SCENARIO_TOPICS.map((t) => [t.code, t]),
);

export function getScenarioTopic(code: string): ScenarioTopic | undefined {
  return TOPIC_BY_CODE[code];
}

export function topicsForTheme(theme: ThemeCode): ScenarioTopic[] {
  return SCENARIO_TOPICS.filter((t) => t.themeCode === theme);
}

/** theme↔domain 허용 매핑 검사(R1c). */
export function isThemeDomainValid(theme: ThemeCode, domain: Domain): boolean {
  return THEME_ALLOWED_DOMAINS[theme]?.includes(domain) ?? false;
}

/** 배치 전 최소 요건(0-c·25): theme당 topic ≥3. */
export function assertTopicCoverage(): { ok: boolean; short: ThemeCode[] } {
  const short = THEME_CODES.filter((th) => topicsForTheme(th).length < 3);
  return { ok: short.length === 0, short };
}

// ── 15주 프리셋 (편성기 config — 스키마 아님, 0-c·26) ──────────────────
export interface CoursePreset {
  preset_code: string;
  label: string;
  target_level: LearnerLevel;
  included_themes: ThemeCode[];
  /** 화행 배분 가중치(합 임의 — 비율로 정규화). 비우면 균등 */
  speech_act_distribution?: Partial<Record<SpeechActUI, number>>;
  /** 통역 비율 0~1 (나머지 번역) */
  translation_interpreting_ratio: number;
  /**
   * 반복 원칙 1문장 — 편성표에 노출(0-g·47, RQ2 증명 장치).
   * 이 강좌가 어떤 화용 초점을 어떤 순서·비중으로 반복 노출하는지 한 문장으로 밝힌다.
   */
  repetition_principle: string;
}

export const COURSE_PRESETS: CoursePreset[] = [
  {
    preset_code: "campus_exchange",
    label: "캠퍼스·유학 중국어",
    target_level: "intermediate",
    included_themes: ["campus_study", "international_exchange"],
    speech_act_distribution: { request: 3, apology: 2, thanks: 2, refusal: 1 },
    translation_interpreting_ratio: 0.3,
    repetition_principle:
      "캠퍼스·유학 장면에서 요청을 축으로 감사·사과·거절을 3:2:2:1 비중으로 반복 노출하여 저부담→고부담 순으로 익힌다.",
  },
  {
    preset_code: "career_workplace",
    label: "취업·직장 협업 중국어",
    target_level: "intermediate",
    included_themes: ["career_workplace"],
    speech_act_distribution: { request: 2, refusal: 2, apology: 2, proposal: 2, opposition: 1 },
    translation_interpreting_ratio: 0.35,
    repetition_principle:
      "직장 협업 장면에서 요청·거절·사과·제안을 고르게 반복하고 반대·이견 표현을 학기 정점에 배치한다.",
  },
  {
    preset_code: "travel_living",
    label: "여행·생활 문제해결 중국어",
    target_level: "beginner_intermediate",
    included_themes: ["travel_mobility", "daily_living"],
    speech_act_distribution: { request: 3, thanks: 2, complaint: 1, apology: 1 },
    translation_interpreting_ratio: 0.4,
    repetition_principle:
      "여행·생활 문제해결 장면에서 요청을 중심으로 감사·불만·사과를 반복하며 통역 비중을 40%로 높인다.",
  },
  {
    preset_code: "digital_commerce",
    label: "디지털 콘텐츠·커머스 중국어",
    target_level: "intermediate",
    included_themes: ["digital_content", "commerce_customer"],
    speech_act_distribution: { proposal: 2, request: 2, opposition: 1, compliment: 1, complaint: 1 },
    translation_interpreting_ratio: 0.3,
    repetition_principle:
      "디지털 콘텐츠·커머스 장면에서 제안·요청을 축으로 이견·칭찬·불만을 반복 노출한다.",
  },
  {
    preset_code: "customer_service",
    label: "고객응대·갈등 조정 중국어",
    target_level: "advanced",
    included_themes: ["commerce_customer", "relationship_social"],
    speech_act_distribution: { apology: 3, proposal: 2, refusal: 1, complaint: 1 },
    translation_interpreting_ratio: 0.35,
    repetition_principle:
      "고객응대·갈등 조정 장면에서 사과·제안을 집중 반복하고 거절·불만으로 난도를 단계적으로 올린다.",
  },
];
