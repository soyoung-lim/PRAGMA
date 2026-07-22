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
  /** 한 셀에서 뽑을 개수 — 개요 N개 → 전부 상세화 */
  count: number;
}

export interface BatchQuota {
  /** 수준별 · (화행 × 도메인) 조합당 생성 개수 */
  perLevel: Record<LearnerLevel, number>;
  /** 통역(대면·전화) 비율 0~1. 나머지는 번역(이메일·메신저) */
  interpretingRatio: number;
}

/**
 * 기본 할당량 — 합계 약 135개.
 * 중급(HSK5)이 9월 실증 코호트이자 시연 주력이라 두텁게 잡는다.
 * 입문·고급은 "필터가 작동한다"를 보이는 최소치.
 */
export const DEFAULT_QUOTA: BatchQuota = {
  perLevel: {
    intermediate: 3, // 9화행 × 3도메인 × 3 = 81
    beginner_intermediate: 1, // 27
    advanced: 1, // 27
  },
  interpretingRatio: 0.3, // 교수님 지시에 "통역"이 명시됨 — 바닥을 보장한다
};

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
  let seq = 0; // 전역 순번 — 채널·산업·P·D·R을 결정론적으로 회전시키는 커서

  for (const level of LEVELS) {
    const perCell = quota.perLevel[level];
    if (perCell <= 0) continue;

    for (const domain of DOMAINS) {
      for (const speech_act_ui of SPEECH_ACTS) {
        for (let i = 0; i < perCell; i += 1) {
          // 통역 비율을 전역 순번으로 배분한다. 셀 단위로 나누면
          // perCell=1인 수준에서 통역이 통째로 빠지거나 몰린다.
          const wantInterpreting = seq % 10 < Math.round(quota.interpretingRatio * 10);
          const pool = wantInterpreting ? INTERPRETING_CHANNELS : TRANSLATION_CHANNELS;
          const channel = pool[seq % pool.length];

          const pdr = PDR_ROTATION[seq % PDR_ROTATION.length];

          cells.push({
            speech_act_ui,
            level,
            domain,
            channel,
            industry: domain === "work" ? INDUSTRIES[seq % INDUSTRIES.length] : null,
            pdr_power: pdr.p,
            pdr_distance: pdr.d,
            pdr_burden: pdr.r,
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
  translation: number;
  interpreting: number;
  /** 화행 × 수준 27칸 중 비어 있는 칸 — 0이어야 코퍼스 브라우저가 채워진다 */
  emptyActLevelCells: string[];
}

export function summarizePlan(cells: BatchCell[]): PlanSummary {
  const bump = (rec: Record<string, number>, key: string, by = 1) => {
    rec[key] = (rec[key] ?? 0) + by;
  };
  const byLevel: Record<string, number> = {};
  const byDomain: Record<string, number> = {};
  const byIndustry: Record<string, number> = {};
  const bySpeechAct: Record<string, number> = {};
  const actLevel = new Set<string>();
  let translation = 0;
  let interpreting = 0;

  for (const c of cells) {
    bump(byLevel, c.level, c.count);
    bump(byDomain, c.domain, c.count);
    bump(bySpeechAct, c.speech_act_ui, c.count);
    if (c.industry) bump(byIndustry, c.industry, c.count);
    if (INTERPRETING_CHANNELS.includes(c.channel)) interpreting += c.count;
    else translation += c.count;
    actLevel.add(`${c.speech_act_ui}|${c.level}`);
  }

  const emptyActLevelCells: string[] = [];
  for (const act of SPEECH_ACTS) {
    for (const level of LEVELS) {
      if (!actLevel.has(`${act}|${level}`)) emptyActLevelCells.push(`${act}·${level}`);
    }
  }

  return {
    total: cells.reduce((n, c) => n + c.count, 0),
    byLevel, byDomain, byIndustry, bySpeechAct,
    translation, interpreting, emptyActLevelCells,
  };
}
