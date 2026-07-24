// 배치 생성 계획기 — "무엇을 몇 개 만들지"를 먼저 계산한다.
//
// 왜 계획을 분리하는가:
// 화행 9 × 수준 3만 순회하면 135개가 쌓여도 도메인·산업·통역 분포는 생성기가
// 주는 대로가 된다. 그러면 교강사가 "직장 · 무역" 필터를 눌렀을 때 0건이 나온다.
// **필터가 존재하는 것과 눌렀을 때 콘텐츠가 나오는 것은 별개다.**
// 따라서 분포를 결과에 맡기지 않고 계획 단계에서 할당량으로 못박는다.
//
// 편성 단위 = 9과목 (수준 3 × 도메인 3). 과목 하나가 15주 중 12 일반주를 쓰고
// 주당 3개면 36개가 이상적이나, 7/26 시연 목표는 중급 3과목을 두텁게 하고
// 입문·고급은 구조가 도는 것만 보이는 배분이다.

import {
  type ChannelUI,
  type Domain,
  type IndustrySector,
  type LearnerLevel,
  type PdrBurden,
  type PdrDistance,
  type PdrPower,
  type SpeechActUI,
} from "@/lib/pragma/enums";
import {
  SCENARIO_TOPICS,
  type ScenarioTopic,
  type ThemeCode,
} from "@/lib/pragma/scenarioTopics";

/** 생성 1건의 조건. AdminGenerator의 폼 한 벌과 같은 축을 갖는다. */
export interface BatchCell {
  speech_act_ui: SpeechActUI;
  level: LearnerLevel;
  domain: Domain;
  channel: ChannelUI;
  /** domain === "work" 일 때만 채운다 (스키마 제약과 동일) */
  industry: IndustrySector | null;
  pdr_power: PdrPower;
  pdr_distance: PdrDistance;
  pdr_burden: PdrBurden;
  /** 편성층 메타 (계약 v1.3 §2b) — 코어 생성 시 행 태그로 저장 */
  theme_code: ThemeCode;
  topic_code: string;
  /** 생성 프롬프트에 넣을 장면 시드 (topic 카탈로그에서) */
  situation_seed_ko: string;
  /** 한 셀에서 뽑을 개수 — 개요 N개 → 전부 상세화 */
  count: number;
}

/**
 * (화행·도메인)에 맞는 topic을 고른다. 계약 §2b: 생성 입력이 곧 태그(태깅 비용 0).
 * 우선 = 화행·도메인 둘 다 맞는 topic / 폴백 = 도메인만 맞는 topic(장면 시드는 act와 무관하게 재사용 가능).
 */
function selectTopic(act: SpeechActUI, domain: Domain, seq: number): ScenarioTopic {
  const actMatch = SCENARIO_TOPICS.filter(
    (t) => t.allowedDomains.includes(domain) && (!t.allowedSpeechActs || t.allowedSpeechActs.includes(act)),
  );
  const pool = actMatch.length ? actMatch : SCENARIO_TOPICS.filter((t) => t.allowedDomains.includes(domain));
  return (pool.length ? pool : SCENARIO_TOPICS)[seq % Math.max(1, pool.length || SCENARIO_TOPICS.length)];
}

export interface BatchQuota {
  /** 수준별 · 화행당 **번역** 생성 개수 */
  perLevel: Record<LearnerLevel, number>;
  /**
   * 통역 비율 0~1. 통역 개수 = `max(1, round(번역개수 × 비율))`.
   * ⚠️ 계약 v1.5 0-h·57: 모드는 주변 분포가 아니라 **명시적 쿼터 축**이다.
   * max(1,…) 바닥이 모든 (화행×수준) 셀에 통역 1개 이상을 보장 → 화행9×수준3×모드2=54셀
   * 커버리지(perLevel≥1인 수준). 500 본 배치는 셀당 ≥3을 목표로 값을 올린다(summarizePlan이 검산).
   */
  interpretingRatio: number;
}

/**
 * 기본 할당량 — 데모 스케일.
 * 중급(HSK5)이 9월 실증 코호트이자 시연 주력이라 두텁게 잡는다.
 * 입문·고급은 "필터가 작동한다"를 보이는 최소치.
 * 500 본 배치는 이 값을 올려 54셀 셀당 ≥3을 채운다.
 */
export const DEFAULT_QUOTA: BatchQuota = {
  perLevel: {
    intermediate: 3, // 화행9 × (번역3 + 통역1) = 36
    beginner_intermediate: 1, // 화행9 × (번역1 + 통역1) = 18
    advanced: 1, // 18
  },
  interpretingRatio: 0.3, // 교수님 지시에 "통역"이 명시됨 — 바닥(≥1)을 보장한다
};

/** 통역 개수 = 번역개수 기준 비율, 단 셀 공백 방지를 위해 최소 1(0-h·57). */
export function interpretingCount(translationCount: number, ratio: number): number {
  if (translationCount <= 0) return 0;
  return Math.max(1, Math.round(translationCount * ratio));
}

const SPEECH_ACTS: SpeechActUI[] = [
  "request", "refusal", "apology", "thanks", "proposal",
  "agreement", "opposition", "compliment", "complaint",
];
const LEVELS: LearnerLevel[] = ["beginner_intermediate", "intermediate", "advanced"];
const DOMAINS: Domain[] = ["daily", "school", "work"];

const TRANSLATION_CHANNELS: ChannelUI[] = ["messenger", "email"];
const INTERPRETING_CHANNELS: ChannelUI[] = ["facetoface", "phone"];

const INDUSTRIES: IndustrySector[] = [
  "trade_distribution", "IT_platform", "manufacturing", "tourism_hospitality",
  "education_research", "public_international_affairs", "culture_content_media",
];

// P·D·R 회전 — 같은 셀에서 여러 개를 뽑을 때 조건이 겹치지 않게 한다.
// 부담(R)은 저·중·고를 고루 돌려 15주 배치의 부담도 곡선에 재료를 준다.
const PDR_ROTATION: { p: PdrPower; d: PdrDistance; r: PdrBurden }[] = [
  { p: "equal", d: "acquaintance", r: "mid" },
  { p: "higher", d: "formal", r: "high" },
  { p: "equal", d: "close", r: "low" },
  { p: "higher", d: "acquaintance", r: "mid" },
  { p: "lower", d: "acquaintance", r: "low" },
  { p: "higher", d: "formal", r: "mid" },
];

/**
 * 할당량으로부터 셀 목록을 만든다. 순수 함수 — 같은 입력이면 같은 계획.
 *
 * 도메인은 계획에 못박지만 산업은 work 도메인 안에서만 회전시킨다
 * (스키마 CHECK: industry는 domain='work'가 아니면 null).
 */
export function buildBatchPlan(quota: BatchQuota = DEFAULT_QUOTA): BatchCell[] {
  const cells: BatchCell[] = [];
  let seq = 0; // 전역 순번 — 도메인·산업·P·D·R을 결정론적으로 회전시키는 커서

  for (const level of LEVELS) {
    const nTrans = quota.perLevel[level];
    if (nTrans <= 0) continue;
    const nInterp = interpretingCount(nTrans, quota.interpretingRatio);

    for (const speech_act_ui of SPEECH_ACTS) {
      // 모드 = 1차 쿼터 축(0-h·57). 각 (화행×수준)에서 번역·통역을 각각 보장 생성한다.
      // 도메인·theme·산업·P/D/R·채널서브타입 = 2차 회전(seq 커서).
      const modeSlots: { channels: ChannelUI[]; count: number }[] = [
        { channels: TRANSLATION_CHANNELS, count: nTrans },
        { channels: INTERPRETING_CHANNELS, count: nInterp },
      ];
      for (const slot of modeSlots) {
        for (let i = 0; i < slot.count; i += 1) {
          const domain = DOMAINS[seq % DOMAINS.length];
          const channel = slot.channels[seq % slot.channels.length];
          const pdr = PDR_ROTATION[seq % PDR_ROTATION.length];
          const topic = selectTopic(speech_act_ui, domain, seq);

          cells.push({
            speech_act_ui,
            level,
            domain,
            channel,
            industry: domain === "work" ? INDUSTRIES[seq % INDUSTRIES.length] : null,
            pdr_power: pdr.p,
            pdr_distance: pdr.d,
            pdr_burden: pdr.r,
            theme_code: topic.themeCode,
            topic_code: topic.code,
            situation_seed_ko: topic.situationSeedKo,
            count: 1,
          });
          seq += 1;
        }
      }
    }
  }

  return cells;
}

/** 계획을 실행 전에 눈으로 검산하기 위한 분포 요약. */
export interface PlanSummary {
  total: number;
  byLevel: Record<string, number>;
  byDomain: Record<string, number>;
  byIndustry: Record<string, number>;
  bySpeechAct: Record<string, number>;
  byTheme: Record<string, number>;
  translation: number;
  interpreting: number;
  /** 화행 × 수준 27칸 중 비어 있는 칸 — 0이어야 코퍼스 브라우저가 채워진다 */
  emptyActLevelCells: string[];
  /**
   * 화행9 × 수준3 × 모드2 = 54셀 감사(계약 0-h·57). perLevel>0인 수준만 대상으로 센다
   * (perLevel=0 수준은 의도된 제외 — 빈 셀로 세지 않는다).
   */
  emptyActLevelModeCells: string[];
  /** 대상 54셀 중 개수가 가장 적은 셀의 값 — 500 배치 목표는 이 값 ≥3 */
  minActLevelModeCount: number;
  /** 셀당 3개 미만인 셀 목록(대상 수준 한정) — 500 배치 전 검산용 */
  underMinCells: string[];
}

export function summarizePlan(cells: BatchCell[]): PlanSummary {
  const bump = (rec: Record<string, number>, key: string, by = 1) => {
    rec[key] = (rec[key] ?? 0) + by;
  };
  const byLevel: Record<string, number> = {};
  const byDomain: Record<string, number> = {};
  const byIndustry: Record<string, number> = {};
  const bySpeechAct: Record<string, number> = {};
  const byTheme: Record<string, number> = {};
  const actLevel = new Set<string>();
  const actLevelModeCount: Record<string, number> = {};
  const levelsPresent = new Set<string>();
  let translation = 0;
  let interpreting = 0;

  const modeOf = (c: BatchCell) =>
    INTERPRETING_CHANNELS.includes(c.channel) ? "stt_interpreting" : "translation";

  for (const c of cells) {
    bump(byLevel, c.level, c.count);
    bump(byDomain, c.domain, c.count);
    bump(bySpeechAct, c.speech_act_ui, c.count);
    bump(byTheme, c.theme_code, c.count);
    if (c.industry) bump(byIndustry, c.industry, c.count);
    if (modeOf(c) === "stt_interpreting") interpreting += c.count;
    else translation += c.count;
    actLevel.add(`${c.speech_act_ui}|${c.level}`);
    levelsPresent.add(c.level);
    bump(actLevelModeCount, `${c.speech_act_ui}|${c.level}|${modeOf(c)}`, c.count);
  }

  const emptyActLevelCells: string[] = [];
  for (const act of SPEECH_ACTS) {
    for (const level of LEVELS) {
      if (!actLevel.has(`${act}|${level}`)) emptyActLevelCells.push(`${act}·${level}`);
    }
  }

  // 54셀 감사 — 계획에 등장한 수준만 대상(perLevel=0 수준은 의도된 제외).
  const MODES = ["translation", "stt_interpreting"] as const;
  const emptyActLevelModeCells: string[] = [];
  const underMinCells: string[] = [];
  let minActLevelModeCount = Infinity;
  for (const level of LEVELS) {
    if (!levelsPresent.has(level)) continue;
    for (const act of SPEECH_ACTS) {
      for (const mode of MODES) {
        const n = actLevelModeCount[`${act}|${level}|${mode}`] ?? 0;
        const label = `${act}·${level}·${mode === "translation" ? "번역" : "통역"}`;
        if (n === 0) emptyActLevelModeCells.push(label);
        if (n < 3) underMinCells.push(label);
        if (n < minActLevelModeCount) minActLevelModeCount = n;
      }
    }
  }
  if (!Number.isFinite(minActLevelModeCount)) minActLevelModeCount = 0;

  return {
    total: cells.reduce((n, c) => n + c.count, 0),
    byLevel, byDomain, byIndustry, bySpeechAct, byTheme,
    translation, interpreting, emptyActLevelCells,
    emptyActLevelModeCells, minActLevelModeCount, underMinCells,
  };
}
