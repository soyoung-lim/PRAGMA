// 규칙검사 R1~R24 — 결정론·API 0회. 생성계약 v1.5 §8.
//
// 순수 함수. 코드가 검사할 수 있는 것은 필드·선택지 수·중복·길이 편차·형식·
// 코드값 정합뿐이다(관리자구조md §3-①). 의미 보존·자연성·화행 구현은 검사 불가 →
// AI 점검·인간 검수의 몫.
//
// 코어 서브셋(§8) = R1c·R8·R9·R10·R15·R16·R17·R19(+R22 warning).

import { getTargetFeature, TARGET_FEATURES } from "@/lib/pragma/targetFeatures";
import { parseMission, type MissionV1, MPJ_TYPE_ORDER } from "@/lib/pragma/missionSchema";
import { parseCore, type ScenarioCoreV1 } from "@/lib/pragma/coreSchema";
import {
  isThemeDomainValid,
  getScenarioTopic,
  type ThemeCode,
} from "@/lib/pragma/scenarioTopics";
import type { Domain, LearnerLevel, SpeechActUI } from "@/lib/pragma/enums";

export type RuleLevel = "fail" | "warning";
export interface RuleViolation {
  id: string;
  level: RuleLevel;
  message: string;
}
export interface RuleResult {
  ok: boolean; // fail이 하나도 없으면 true(warning은 통과)
  result: "pass" | "warning" | "fail";
  violations: RuleViolation[];
}

/** 검사 맥락 — 요청한 셀 조건과 카탈로그. */
export interface CheckContext {
  speech_act: SpeechActUI;
  level: LearnerLevel;
  domain: Domain;
  theme_code: ThemeCode;
  topic_code: string;
  industry?: string | null;
  mode: "translation" | "stt_interpreting";
  source_modality: "written" | "spoken";
  /** 승격 입력의 계획 화용 초점(주차/코어 화행의 카탈로그 기본 초점 — v1.5 0-h·55). R24 검사용. */
  planned_target_feature?: string;
}

// ── 문자 범위 ─────────────────────────────────────────────────────────
const HANGUL = /[가-힣ᄀ-ᇿ㄰-㆏]/;
const CJK = /[一-鿿㐀-䶿]/;
const hasHangul = (s: string) => HANGUL.test(s);
const hasCjk = (s: string) => CJK.test(s);
/** 중국어 문장에 한글이 섞이지 않았는가(고유명사 예외는 관대하게 — 한글 '단어'만 잡음). */
const looksChinese = (s: string) => hasCjk(s) && !HANGUL.test(s);
const looksKorean = (s: string) => hasHangul(s);

// 국가 단위 일반화 패턴(R9) — 해설·note 필드 한정.
const NATIONALIZE = /(중국인(들)?은|중국에서는|중국\s*문화에서는|중국어\s*화자는|일반적으로\s*중국)/;

const add = (v: RuleViolation[], id: string, level: RuleLevel, message: string) =>
  v.push({ id, level, message });

// ══════════════════════════════════════════════════════════════════════
// 코어 검사 (R1c 포함 서브셋)
// ══════════════════════════════════════════════════════════════════════
export function checkCore(coreInput: unknown, ctx: CheckContext): RuleResult {
  const v: RuleViolation[] = [];
  const parsed = parseCore(coreInput);
  if (!parsed.ok) {
    add(v, "R1c", "fail", `코어 스키마 위반: ${parsed.error.issues[0]?.message ?? "형식 오류"}`);
    return finalize(v);
  }
  const core = parsed.data;

  // theme↔domain 허용 매핑(R1c 확장)
  if (!isThemeDomainValid(ctx.theme_code, ctx.domain)) {
    add(v, "R1c", "fail", `theme '${ctx.theme_code}'는 domain '${ctx.domain}'를 허용하지 않음`);
  }
  // topic 카탈로그 존재 + theme·domain 정합
  const topic = getScenarioTopic(ctx.topic_code);
  if (!topic) {
    add(v, "R1c", "fail", `topic_code '${ctx.topic_code}'가 카탈로그에 없음`);
  } else {
    if (topic.themeCode !== ctx.theme_code) {
      add(v, "R1c", "fail", `topic '${ctx.topic_code}'의 theme(${topic.themeCode}) ≠ 행 theme(${ctx.theme_code})`);
    }
    if (!topic.allowedDomains.includes(ctx.domain)) {
      add(v, "R1c", "fail", `topic '${ctx.topic_code}'는 domain '${ctx.domain}'를 허용하지 않음`);
    }
  }

  checkCoreCommon(v, core, ctx);
  return finalize(v);
}

// 코어·미션 production_task 공통 서브셋(R8·R9·R10·R16·R17)
function checkCoreCommon(
  v: RuleViolation[],
  core: Pick<ScenarioCoreV1, "source_text_ko" | "preceding_turn_zh" | "channel"> & {
    situation_ko?: string;
    relation_ko?: string;
  },
  ctx: CheckContext,
) {
  // R8 거절·응답류인데 preceding_turn 없음
  if (isResponseAct(ctx.speech_act) && !core.preceding_turn_zh) {
    add(v, "R8", "fail", `${ctx.speech_act}는 인접쌍 둘째 짝 — preceding_turn_zh 필수`);
  }
  // R10 source=한국어
  if (!looksKorean(core.source_text_ko)) {
    add(v, "R10", "fail", "source_text_ko에 한국어가 없음");
  }
  if (core.preceding_turn_zh && !hasCjk(core.preceding_turn_zh)) {
    add(v, "R10", "fail", "preceding_turn_zh가 중국어가 아님");
  }
  // R16 mode↔source_modality
  if (ctx.mode === "stt_interpreting" && ctx.source_modality !== "spoken") {
    add(v, "R16", "fail", "통역(stt_interpreting)은 source_modality='spoken'이어야 함");
  }
  if (ctx.mode === "translation" && ctx.source_modality !== "written") {
    add(v, "R16", "fail", "번역은 source_modality='written'이어야 함");
  }
  // R17 산업은 work에서만
  if (ctx.industry && ctx.domain !== "work") {
    add(v, "R17", "fail", `industry는 domain='work'에서만 (현재 ${ctx.domain})`);
  }
  // R9 국가 단위 일반화 (해설/note 성격 필드)
  for (const field of [core.situation_ko, core.relation_ko]) {
    if (field && NATIONALIZE.test(field)) {
      add(v, "R9", "fail", `국가 단위 일반화 표현: "${field.slice(0, 30)}…"`);
    }
  }
}

// ══════════════════════════════════════════════════════════════════════
// 미션 검사 (R1~R24 전체)
// ══════════════════════════════════════════════════════════════════════
export function checkMission(
  missionInput: unknown,
  ctx: CheckContext,
  core?: ScenarioCoreV1,
): RuleResult {
  const v: RuleViolation[] = [];
  const parsed = parseMission(missionInput);
  if (!parsed.ok) {
    add(v, "R1", "fail", `스키마 위반: ${parsed.error.issues[0]?.path?.join(".")} ${parsed.error.issues[0]?.message ?? ""}`);
    return finalize(v);
  }
  const m = parsed.data;
  const feature = getTargetFeature(m.unit.target_feature);

  // ── R1 유형 순서·axis_feature·band code 존재 ──
  const typesInOrder = m.mpj_items.map((it) => it.type);
  if (typesInOrder.join(",") !== MPJ_TYPE_ORDER.join(",")) {
    add(v, "R1", "fail", `유형 순서 위반: ${typesInOrder.join("→")}`);
  }
  if (!feature) {
    add(v, "R13", "fail", `target_feature '${m.unit.target_feature}'가 카탈로그에 없음`);
  }
  for (const it of m.mpj_items) {
    if (it.axis_feature !== m.unit.target_feature) {
      add(v, "R1", "fail", `문항 ${it.id}: axis_feature(${it.axis_feature}) ≠ unit.target_feature(${m.unit.target_feature})`);
    }
    // band code가 카탈로그에 존재하는지
    if (feature) {
      const codes = collectBandCodes(it);
      for (const c of codes) {
        const inFeature = feature.band_schema.some((b) => b.code === c);
        if (!inFeature) {
          add(v, "R1", "fail", `문항 ${it.id}: band code '${c}'가 '${feature.code}' band_schema에 없음`);
        }
      }
    }
  }

  const withinCode = feature?.within_band_code ?? "within_band";
  const inappropriate = (code: string) => code !== withinCode;

  // ── 유형별 규칙 ──
  for (const it of m.mpj_items) {
    switch (it.type) {
      case "scale4": {
        // R7 accepted가 척도의 연속 구간
        if (!isContiguousScale(it.accepted_scale_codes)) {
          add(v, "R7", "fail", `문항 ${it.id}: scale4 accepted가 연속 구간이 아님 (${it.accepted_scale_codes.join(",")})`);
        }
        checkTargetHighlights(v, it.id, it.target_zh, it.highlights_zh);
        break;
      }
      case "judge3": {
        // R2 within_band 포함(반례 문항)
        if (!it.accepted_band_codes.includes(withinCode)) {
          add(v, "R2", "fail", `문항 ${it.id}: judge3 accepted에 within_band(${withinCode}) 없음 — 반례 문항 규칙`);
        }
        checkTargetHighlights(v, it.id, it.target_zh, it.highlights_zh);
        break;
      }
      case "fix_choice": {
        // R3 valid 정확히 2
        const validCount = it.corrections.filter((c) => c.is_valid).length;
        if (validCount !== 2) {
          add(v, "R3", "fail", `문항 ${it.id}: fix_choice valid=${validCount} (정확히 2여야 함)`);
        }
        // R18 accepted = 부적절 계열
        if (it.accepted_band_codes.some((c) => !inappropriate(c))) {
          add(v, "R18", "fail", `문항 ${it.id}: fix_choice accepted에 적정 대역 포함 — 부적절 계열이어야 함`);
        }
        checkChinese(v, it.id, it.corrections.map((c) => c.zh));
        checkTargetHighlights(v, it.id, it.target_zh, it.highlights_zh);
        break;
      }
      case "reason_conf": {
        // R4 accepted_reason_ids가 존재하는 reason id
        const ids = new Set(it.reasons.map((r) => r.id));
        if (it.accepted_reason_ids.some((id) => !ids.has(id))) {
          add(v, "R4", "fail", `문항 ${it.id}: accepted_reason_ids가 reasons에 없는 id 참조`);
        }
        // R4 pdr = production_task와 같은 조건대(난이도 브리지)
        if (!samePdrBand(it.pdr, m.production_task.pdr)) {
          add(v, "R4", "warning", `문항 ${it.id}: reason_conf pdr이 production_task와 다른 조건대(난이도 브리지 권장)`);
        }
        // R18 accepted = 부적절 계열
        if (it.accepted_band_codes.some((c) => !inappropriate(c))) {
          add(v, "R18", "fail", `문항 ${it.id}: reason_conf accepted에 적정 대역 포함 — 부적절 계열이어야 함`);
        }
        checkTargetHighlights(v, it.id, it.target_zh, it.highlights_zh);
        break;
      }
      case "multi_judge": {
        // R5 길이 통제 강화판
        checkMultiJudgeLength(v, it.id, it.candidates, withinCode);
        checkChinese(v, it.id, it.candidates.map((c) => c.zh));
        break;
      }
    }
  }

  // ── R11 reference_alternatives 1~2 · recommended_example 전 문항 ──
  const altCount = m.production_task.reference_alternatives.length;
  if (altCount < 1 || altCount > 2) {
    add(v, "R11", "fail", `reference_alternatives는 1~2개 (현재 ${altCount})`);
  }
  for (const it of m.mpj_items) {
    if (!it.recommended_example_zh?.trim()) {
      add(v, "R11", "fail", `문항 ${it.id}: recommended_example_zh 없음`);
    }
  }

  // ── R12 세트 accepted 분포 전부 동일 방향(warning) ──
  checkSetDistribution(v, m, withinCode);

  // ── R13/R14 카탈로그 복사 검증 ──
  if (feature) {
    if (m.unit.target_feature_version !== feature.version) {
      add(v, "R13", "fail", `target_feature_version(${m.unit.target_feature_version}) ≠ 카탈로그(${feature.version})`);
    }
    if (m.unit.learner_label !== feature.learner_label) {
      add(v, "R14", "fail", `learner_label이 카탈로그 값과 다름 (AI 생성 의심)`);
    }
    if (m.unit.closing_ko !== feature.closing_principle_ko) {
      add(v, "R14", "fail", `closing_ko가 카탈로그 값과 다름 (AI 생성 의심)`);
    }
    // R15 카탈로그의 speech_act와 요청 화행 일치
    if (feature.speech_act !== ctx.speech_act) {
      add(v, "R15", "fail", `카탈로그 화행(${feature.speech_act}) ≠ 요청 화행(${ctx.speech_act})`);
    }
  }

  // ── R9 국가 일반화 (해설·note 필드 전수) ──
  checkNationalization(v, m);

  // ── R10 source=한국어·target/candidate=중국어 ──
  for (const it of m.mpj_items) {
    if (!looksKorean(it.source_ko)) {
      add(v, "R10", "fail", `문항 ${it.id}: source_ko에 한국어 없음`);
    }
    if ("target_zh" in it && it.target_zh && !hasCjk(it.target_zh)) {
      add(v, "R10", "fail", `문항 ${it.id}: target_zh가 중국어가 아님`);
    }
    if (it.preceding_turn_zh && !hasCjk(it.preceding_turn_zh)) {
      add(v, "R10", "fail", `문항 ${it.id}: preceding_turn_zh가 중국어가 아님`);
    }
  }
  if (!looksKorean(m.production_task.source_text_ko)) {
    add(v, "R10", "fail", "production_task.source_text_ko에 한국어 없음");
  }

  // ── R8 거절·응답류 preceding_turn ──
  if (isResponseAct(ctx.speech_act)) {
    for (const it of m.mpj_items) {
      if (!it.preceding_turn_zh) {
        add(v, "R8", "fail", `문항 ${it.id}: ${ctx.speech_act}는 preceding_turn_zh 필수`);
      }
    }
    if (!m.production_task.preceding_turn_zh) {
      add(v, "R8", "fail", "production_task: 거절·응답류는 preceding_turn_zh 필수");
    }
  }

  // ── R16 mode↔source_modality ──
  if (ctx.mode === "stt_interpreting" && m.production_task.mode !== "interpreting") {
    add(v, "R16", "fail", "통역 셀인데 production_task.mode ≠ interpreting");
  }
  if (m.production_task.mode === "interpreting" && m.production_task.source_modality !== "spoken") {
    add(v, "R16", "fail", "interpreting인데 source_modality ≠ spoken");
  }

  // ── R19 세트 내 source/candidate 완전 중복(warning) ──
  checkInternalDuplicates(v, m);

  // ── R21 recommended_example가 해당 문항 판정과 모순되지 않음(warning) ──
  checkRecommendedConsistency(v, m, withinCode);

  // ── R20 mission_content.provenance 존재·필수값(v1.5 0-h·56) ──
  checkProvenance(v, m);

  // ── R23 미션 production_task가 코어 계승 ──
  if (core) {
    checkInheritance(v, m, core);
  }

  // ── R24 승격 입력 계획 초점 = unit.target_feature(v1.5 0-h·55) ──
  if (ctx.planned_target_feature && m.unit.target_feature !== ctx.planned_target_feature) {
    add(
      v,
      "R24",
      "fail",
      `unit.target_feature(${m.unit.target_feature}) ≠ 계획 초점(${ctx.planned_target_feature})`,
    );
  }

  return finalize(v);
}

// R20 — 미션 provenance 객체 존재 + 필수값(prompt_snapshot_hash는 선택).
function checkProvenance(v: RuleViolation[], m: MissionV1) {
  const p = m.provenance;
  if (!p) {
    add(v, "R20", "fail", "mission_content.provenance 객체가 없음");
    return;
  }
  const required: [keyof typeof p, string][] = [
    ["model", "model"],
    ["prompt_version", "prompt_version"],
    ["mission_content_hash", "mission_content_hash"],
    ["generated_at", "generated_at"],
  ];
  for (const [key, label] of required) {
    if (!p[key]) add(v, "R20", "fail", `provenance.${label} 누락`);
  }
  if (!(typeof p.generation_attempt === "number" && p.generation_attempt >= 1)) {
    add(v, "R20", "fail", "provenance.generation_attempt는 1 이상 정수");
  }
}

// ── 헬퍼 ──────────────────────────────────────────────────────────────
function isResponseAct(act: SpeechActUI): boolean {
  return act === "refusal" || act === "opposition";
}

function collectBandCodes(it: MissionV1["mpj_items"][number]): string[] {
  switch (it.type) {
    case "judge3":
    case "fix_choice":
    case "reason_conf":
      return it.accepted_band_codes;
    case "multi_judge":
      return it.candidates.flatMap((c) => c.accepted_band_codes);
    default:
      return []; // scale4는 scale code (band 아님)
  }
}

const SCALE4_ORDER = [
  "very_appropriate",
  "somewhat_appropriate",
  "somewhat_inappropriate",
  "very_inappropriate",
];
function isContiguousScale(codes: string[]): boolean {
  const idx = codes.map((c) => SCALE4_ORDER.indexOf(c)).filter((i) => i >= 0).sort((a, b) => a - b);
  if (idx.length !== codes.length) return false; // 미지 코드
  for (let i = 1; i < idx.length; i++) if (idx[i] !== idx[i - 1] + 1) return false;
  return true;
}

function checkTargetHighlights(v: RuleViolation[], id: number, target: string, highlights: string[]) {
  // R6 highlights_zh ⊂ target_zh
  for (const h of highlights) {
    if (h && !target.includes(h)) {
      add(v, "R6", "fail", `문항 ${id}: highlight "${h}"가 target_zh에 없음`);
    }
  }
}

function checkChinese(v: RuleViolation[], id: number, texts: string[]) {
  for (const t of texts) {
    if (t && !looksChinese(t)) {
      add(v, "R10", "warning", `문항 ${id}: 후보 "${t.slice(0, 20)}"에 한글 혼입 또는 중국어 아님`);
    }
  }
}

// R5 multi_judge 길이 통제 강화판
function checkMultiJudgeLength(
  v: RuleViolation[],
  id: number,
  candidates: { zh?: string; accepted_band_codes?: string[] }[],
  withinCode: string,
) {
  const lens = candidates.map((c) => [...(c.zh ?? "")].length);
  const codesOf = (c: { accepted_band_codes?: string[] }) => c.accepted_band_codes ?? [];
  const isUnder = (c: { accepted_band_codes?: string[] }) =>
    codesOf(c).every((b) => b !== withinCode) && isUnderBand(codesOf(c));
  const isOver = (c: { accepted_band_codes?: string[] }) =>
    codesOf(c).every((b) => b !== withinCode) && isOverBand(codesOf(c));
  const isOk = (c: { accepted_band_codes?: string[] }) => codesOf(c).includes(withinCode);

  // 완전 단조 (길이순 정렬이 정답 패턴과 일치) → fail
  const paired = candidates.map((c, i) => ({ len: lens[i], ok: isOk(c) }));
  const sorted = [...paired].sort((a, b) => a.len - b.len);
  const monotonic = sorted.every((p, i) => i === 0 || Number(p.ok) >= Number(sorted[i - 1].ok));
  const reverseMonotonic = sorted.every((p, i) => i === 0 || Number(p.ok) <= Number(sorted[i - 1].ok));
  if (monotonic || reverseMonotonic) {
    // 길이만으로 ok/부적절이 갈리면 "짧은/긴 걸 고르면 됨"을 학습
    const okLens = paired.filter((p) => p.ok).map((p) => p.len);
    const badLens = paired.filter((p) => !p.ok).map((p) => p.len);
    if (okLens.length && badLens.length) {
      const okMin = Math.min(...okLens), okMax = Math.max(...okLens);
      const separable = badLens.every((l) => l < okMin) || badLens.every((l) => l > okMax);
      if (separable) {
        add(v, "R5", "fail", `문항 ${id}: multi_judge 길이가 정답을 가름 — 과소안이 최단·최장 양쪽에 있어야 함`);
      }
    }
  }

  // over가 유일 최장문 → warning (v1.4 증거 기반 강등, §11)
  // 자연 언어에서 강도-길이 상관이 강해 hard fail은 자연성을 해친다. 소프트 단서는
  // 인간 눈검사로 넘기고, 진짜 무효(완전 단조=길이순이 정답키)만 위에서 fail 처리한다.
  const overIdx = candidates.map((c, i) => (isOver(c) ? i : -1)).filter((i) => i >= 0);
  const maxLen = Math.max(...lens);
  const maxCount = lens.filter((l) => l === maxLen).length;
  if (overIdx.length === 1 && lens[overIdx[0]] === maxLen && maxCount === 1) {
    add(v, "R5", "warning", `문항 ${id}: 과잉안이 유일한 최장문 — 길이 단서 가능(눈검사)`);
  }

  // under 전부가 최단 그룹 → warning (v1.4 증거 기반 강등)
  const minLen = Math.min(...lens);
  const underIdx = candidates.map((c, i) => (isUnder(c) ? i : -1)).filter((i) => i >= 0);
  if (underIdx.length >= 1 && underIdx.every((i) => lens[i] === minLen)) {
    add(v, "R5", "warning", `문항 ${id}: 과소안이 전부 최단 — 길이 단서 가능(눈검사)`);
  }

  // 최장/최단 비율 > 3 → warning
  if (minLen > 0 && maxLen / minLen > 3) {
    add(v, "R5", "warning", `문항 ${id}: 최장/최단 길이 비율 ${(maxLen / minLen).toFixed(1)} > 3`);
  }
}

// band code 이름 규약으로 과소/과잉 판별(카탈로그 순서 대신 이름 패턴 — 근사)
function isUnderBand(codes: string[]): boolean {
  return codes.some((c) => /(too_direct|too_blunt|insufficient|impolite)/.test(c));
}
function isOverBand(codes: string[]): boolean {
  return codes.some((c) => /(too_indirect|over_elaborate|excessive|overpolite)/.test(c));
}

// strict:false 환경의 zod 추론은 필드를 optional로 준다 — 파라미터 타입도 느슨하게.
function samePdrBand(
  a: { p?: string; d?: string; r?: string },
  b: { p?: string; d?: string; r?: string },
): boolean {
  return a.p === b.p && a.d === b.d && a.r === b.r;
}

function checkSetDistribution(v: RuleViolation[], m: MissionV1, withinCode: string) {
  // 판정형 문항(judge3/fix_choice/reason_conf/multi)의 accepted가 전부 같은 방향이면 warning
  const dirs = new Set<string>();
  for (const it of m.mpj_items) {
    const codes = collectBandCodes(it);
    for (const c of codes) {
      if (c === withinCode) dirs.add("within");
      else if (isUnderBand([c])) dirs.add("under");
      else if (isOverBand([c])) dirs.add("over");
    }
  }
  if (dirs.size <= 1 && dirs.size > 0) {
    add(v, "R12", "warning", `세트 accepted 분포가 전부 동일 방향(${[...dirs].join(",")}) — 정답 예측 가능`);
  }
  // within_band 정답 문항 ≥1 (거짓 규칙 차단) — judge3가 R2로 보장하지만 세트 차원 재확인
  const hasWithin = m.mpj_items.some((it) => collectBandCodes(it).includes(withinCode));
  if (!hasWithin) {
    add(v, "R12", "warning", `세트에 within_band 정답 문항이 없음 — "부적절이 정답" 편향 위험`);
  }
}

function checkNationalization(v: RuleViolation[], m: MissionV1) {
  const fields: string[] = [];
  for (const it of m.mpj_items) {
    fields.push(it.explanation_ko);
    if (it.type === "fix_choice") fields.push(...it.corrections.map((c) => c.note_ko));
    if (it.type === "multi_judge") fields.push(...it.candidates.map((c) => c.note_ko));
  }
  for (const f of fields) {
    if (NATIONALIZE.test(f)) {
      add(v, "R9", "fail", `국가 단위 일반화: "${f.slice(0, 30)}…"`);
    }
  }
}

function checkInternalDuplicates(v: RuleViolation[], m: MissionV1) {
  const targets = m.mpj_items
    .map((it) => ("target_zh" in it ? it.target_zh : ""))
    .filter(Boolean);
  const seen = new Set<string>();
  for (const t of targets) {
    if (seen.has(t)) add(v, "R19", "warning", `target_zh 완전 중복: "${t.slice(0, 20)}…"`);
    seen.add(t);
  }
}

function checkRecommendedConsistency(v: RuleViolation[], m: MissionV1, withinCode: string) {
  for (const it of m.mpj_items) {
    if (it.type === "fix_choice") {
      // 권장안이 valid 교정 중 하나와 동일하면 이상적(모순 아님). 부적절 target과 동일하면 warning
      if (it.recommended_example_zh === it.target_zh) {
        add(v, "R21", "warning", `문항 ${it.id}: recommended_example가 부적절 target과 동일`);
      }
    }
  }
}

function checkInheritance(v: RuleViolation[], m: MissionV1, core: ScenarioCoreV1) {
  const pt = m.production_task;
  if (pt.source_text_ko !== core.source_text_ko) {
    add(v, "R23", "fail", "production_task.source_text_ko가 코어를 계승하지 않음");
  }
  if (pt.channel !== core.channel) {
    add(v, "R23", "fail", `production_task.channel(${pt.channel}) ≠ 코어(${core.channel})`);
  }
  if (!samePdrBand(pt.pdr, core.pdr)) {
    add(v, "R23", "fail", "production_task.pdr가 코어를 계승하지 않음");
  }
  if (pt.source_modality !== core.source_modality) {
    add(v, "R23", "fail", `production_task.source_modality(${pt.source_modality}) ≠ 코어(${core.source_modality})`);
  }
}

function finalize(v: RuleViolation[]): RuleResult {
  const hasFail = v.some((x) => x.level === "fail");
  const hasWarn = v.some((x) => x.level === "warning");
  return {
    ok: !hasFail,
    result: hasFail ? "fail" : hasWarn ? "warning" : "pass",
    violations: v,
  };
}

/** 카탈로그 자체 무결성(부팅 시 1회 — R13/R14가 참조하는 값이 존재하는지). */
export function assertCatalogIntegrity(): string[] {
  const problems: string[] = [];
  for (const [code, f] of Object.entries(TARGET_FEATURES)) {
    if (!f.band_schema.some((b) => b.code === f.within_band_code)) {
      problems.push(`${code}: within_band_code '${f.within_band_code}'가 band_schema에 없음`);
    }
  }
  return problems;
}
