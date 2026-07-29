// 규칙검사 R1~R24 — 결정론·API 0회. 생성계약 v1.5 §8 + 양방향(0-l·85).
//
// 순수 함수. 코드가 검사할 수 있는 것은 필드·선택지 수·중복·길이 편차·형식·
// 코드값 정합뿐이다(관리자구조md §3-①). 의미 보존·자연성·화행 구현은 검사 불가 →
// AI 점검·인간 검수의 몫.
//
// 코어 서브셋(§8) = R1c·R8·R9·R10·R15·R16·R17·R19·R25·R26(+R22 warning).
//
// 양방향(0-l·84): 입력은 v1 또는 v2 JSON 모두 허용 — normalizeCore/normalizeMission이
// v2 형태(중립 필드명 + direction)로 통일한 뒤 검사한다. R10은 데이터의 direction으로
// source/target 언어를 스왑한다. R9는 중국·한국 국가 일반화를 양방향 공통으로 잡는다.

import { getTargetFeature, TARGET_FEATURES } from "@/lib/pragma/targetFeatures";
import {
  normalizeMission,
  type MissionV4,
  type MissionRuntime,
  MPJ_TYPE_ORDER_V2,
  MPJ_TYPE_ORDER_V3,
  MPJ_TYPE_ORDER_V4,
} from "@/lib/pragma/missionSchema";
import { normalizeCore, type ScenarioCoreV2 } from "@/lib/pragma/coreSchema";
import {
  isThemeDomainValid,
  getScenarioTopic,
  type ThemeCode,
} from "@/lib/pragma/scenarioTopics";
import {
  DIRECTION_LANGS,
  DEFAULT_DIRECTION,
  type Domain,
  type LanguageDirection,
  type LearnerLevel,
  type SpeechActUI,
} from "@/lib/pragma/enums";

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
  /** 요청 방향(0-l·85). 생략 시 데이터의 direction을 그대로 신뢰. 지정 시 데이터와 일치 검사. */
  direction?: LanguageDirection;
  /** 신규 생성 경로에서 서버 주입 context_spec을 강제한다. legacy 읽기는 생략한다. */
  require_context_spec?: boolean;
}

// ── 문자 범위 ─────────────────────────────────────────────────────────
const HANGUL = /[가-힣ᄀ-ᇿ㄰-㆏]/;
const CJK = /[一-鿿㐀-䶿]/;
const hasHangul = (s: string) => HANGUL.test(s);
const hasCjk = (s: string) => CJK.test(s);
/** 중국어 문장에 한글이 섞이지 않았는가(고유명사 예외는 관대하게 — 한글 '단어'만 잡음). */
const looksChinese = (s: string) => hasCjk(s) && !HANGUL.test(s);
const looksKorean = (s: string) => hasHangul(s);

// 국가 단위 일반화 패턴(R9) — 해설·note 필드 한정. 중국·한국 양방향 공통(0-l·85).
const NATIONALIZE =
  /(중국인(들)?은|중국에서는|중국\s*문화에서는|중국어\s*화자는|일반적으로\s*중국|한국인(들)?은|한국에서는|한국\s*문화에서는|한국어\s*화자는|일반적으로\s*한국)/;

// R16의 구조값(mode↔source_modality)은 서버가 채우므로 서로 맞는 값만으로도 통과할 수 있다.
// 아래는 situation_ko가 그 구조값과 정면으로 반대되는 수행 장면을 *명시*한 경우만 잡는다.
// 담화체·격식 추정은 하지 않는다. 즉시 반응 여부만으로도 판정하지 않는다.
const EXPLICIT_NOT_WRITTEN_SCENE =
  /(?:글|서면|문서|기록)(?:로|으로|에|을)?[^.!?\n]{0,24}(?:남기|적|쓰|작성|보내|전달)[^.!?\n]{0,4}(?:지\s*않|아니)/;
const EXPLICIT_SPOKEN_SCENE =
  /(?:직접\s*(?:만나[^.!?\n]{0,16})?|말로|구두로|대면(?:으로|에서)?|전화(?:로|에서)?|통화(?:로|에서)?)[^.!?\n]{0,28}(?:말하|묻|전하|알리|설명하|칭찬하|사과하|요청하|의견을\s*나누)|(?:말하|묻|대화하)(?:는|고\s*있는)\s*(?:자리|상황)/;
const EXPLICIT_SPOKEN_AVOIDANCE =
  /(?:직접\s*(?:만나[^.!?\n]{0,16})?|말로|구두로|대면(?:으로|에서)?|전화(?:로|에서)?|통화(?:로|에서)?)[^.!?\n]{0,32}(?:어렵|어색|부담|피하|대신|지\s*않|아니)/;
const EXPLICIT_WRITTEN_SCENE =
  /(?:이메일|메일|메신저|문자|채팅)(?:로|에|에서|를\s*통해)?[^.!?\n]{0,30}(?:작성하|쓰|적|보내|전송하|남기)|(?:글|서면|문서|기록)(?:로|으로|에|을)?[^.!?\n]{0,25}(?:작성하|쓰|적|보내|전달하|제출하|남기)/;

// R26은 의미 판정기가 아니라 명백한 "산업 라벨만 있고 실제 단서는 없음"을 막는 하한선이다.
// 범용어(회사·프로젝트·제품·고객·행사)는 단독 증거로 쓰지 않는다. 구체성의 최종 판정은
// core_quality v4와 인간 검수가 맡는다.
const INDUSTRY_EVIDENCE: Record<string, RegExp> = {
  culture_content_media:
    /엔터테인먼트|미디어|방송|영상|음원|공연|촬영|편집|콘텐츠\s*제작|배급|스트리밍/iu,
  manufacturing:
    /뷰티|화장품|스킨케어|메이크업|패션|의류|브랜드\s*(?:상품|매장)|온라인\s*몰|커머스|판매\s*채널/iu,
  trade_distribution:
    /제조|생산\s*라인|공장|무역|수출|수입|통관|물류|선적|납품|공급망|발주/iu,
  IT_platform:
    /IT|테크|플랫폼|소프트웨어|애플리케이션|앱|서버|데이터베이스|개발|배포|API|알고리즘/iu,
  public_international_affairs:
    /바이오|의료|헬스케어|병원|환자|의약|약품|임상|진료|건강\s*관리|검사\s*결과/iu,
  tourism_hospitality:
    /관광|여행|호텔|숙박|항공|투어|MICE|컨벤션|전시회|관광객|방문객|객실|예약/iu,
  education_research:
    /공공|행정|정책|교육|학교|대학|수업|학생|교수|연구|학술|논문|교육기관|연구기관/iu,
};

const explicitlyRequiresSpokenScene = (situation: string) =>
  situation
    .split(/[.!?\n]+/)
    .some(
      (sentence) =>
        EXPLICIT_SPOKEN_SCENE.test(sentence) &&
        !EXPLICIT_SPOKEN_AVOIDANCE.test(sentence),
    );

const add = (v: RuleViolation[], id: string, level: RuleLevel, message: string) =>
  v.push({ id, level, message });

// ── 방향 인식 언어 검사 헬퍼(0-l·85) ───────────────────────────────────
const LANG_KO: Record<"ko" | "zh", string> = { ko: "한국어", zh: "중국어" };

/** source(원문)가 방향의 source 언어인가 — hard fail. */
function checkSourceLang(v: RuleViolation[], dir: LanguageDirection, text: string, label: string) {
  const lang = DIRECTION_LANGS[dir].source;
  const ok = lang === "ko" ? looksKorean(text) : looksChinese(text);
  if (!ok) add(v, "R10", "fail", `${label}: ${LANG_KO[lang]} 원문이 아님`);
}

/** 주 판정문(target)이 방향의 target 언어인가 — hard fail. */
function checkTargetLangHard(v: RuleViolation[], dir: LanguageDirection, text: string, label: string) {
  const lang = DIRECTION_LANGS[dir].target;
  const ok = lang === "zh" ? hasCjk(text) : hasHangul(text);
  if (!ok) add(v, "R10", "fail", `${label}: ${LANG_KO[lang]}가 아님`);
}

/** 후보·교정 목록이 방향의 target 언어인가 — warning(한국어 산출의 한자 혼입 포함, 0-l·85). */
function checkTargetLangSoft(v: RuleViolation[], dir: LanguageDirection, id: number, texts: string[]) {
  const lang = DIRECTION_LANGS[dir].target;
  for (const t of texts) {
    if (!t) continue;
    if (lang === "zh") {
      if (!looksChinese(t)) add(v, "R10", "warning", `문항 ${id}: 후보 "${t.slice(0, 20)}"에 한글 혼입 또는 중국어 아님`);
    } else {
      if (!hasHangul(t)) add(v, "R10", "warning", `문항 ${id}: 후보 "${t.slice(0, 20)}"에 한국어 없음`);
      else if (hasCjk(t)) add(v, "R10", "warning", `문항 ${id}: 후보 "${t.slice(0, 20)}"에 한자 혼입(한국어 산출)`);
    }
  }
}

/** 선행 발화(대화 상대)가 방향의 target 언어인가 — hard fail. */
function checkPrecedingLang(v: RuleViolation[], dir: LanguageDirection, text: string | null | undefined, label: string) {
  if (!text) return;
  const lang = DIRECTION_LANGS[dir].target;
  const ok = lang === "zh" ? hasCjk(text) : hasHangul(text);
  if (!ok) add(v, "R10", "fail", `${label}: 선행 발화가 ${LANG_KO[lang]}가 아님`);
}

/** 데이터 direction과 요청 방향(ctx) 일치(지정 시). */
function checkDirectionMatch(v: RuleViolation[], dataDir: LanguageDirection, ctx: CheckContext) {
  if (ctx.direction && ctx.direction !== dataDir) {
    add(v, "R10", "fail", `데이터 방향(${dataDir}) ≠ 요청 방향(${ctx.direction})`);
  }
}

// ══════════════════════════════════════════════════════════════════════
// 코어 검사 (R1c 포함 서브셋)
// ══════════════════════════════════════════════════════════════════════
export function checkCore(coreInput: unknown, ctx: CheckContext): RuleResult {
  const v: RuleViolation[] = [];
  const parsed = normalizeCore(coreInput);
  if (!parsed.ok) {
    add(v, "R1c", "fail", `코어 스키마 위반: ${parsed.error.issues[0]?.message ?? "형식 오류"}`);
    return finalize(v);
  }
  const core = parsed.data;
  checkDirectionMatch(v, core.direction, ctx);
  if (ctx.require_context_spec && !core.context_spec) {
    add(v, "R25", "fail", "신규 코어에 서버 주입 context_spec이 없음");
  }

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
  core: Pick<ScenarioCoreV2, "direction" | "source_text" | "preceding_turn"> & {
    situation_ko?: string;
    relation_ko?: string;
  },
  ctx: CheckContext,
) {
  const dir = core.direction ?? DEFAULT_DIRECTION;
  // R8 거절·응답류인데 preceding_turn 없음
  if (isResponseAct(ctx.speech_act) && !core.preceding_turn) {
    add(v, "R8", "fail", `${ctx.speech_act}는 인접쌍 둘째 짝 — preceding_turn 필수`);
  }
  // R10 source·선행발화 방향 언어
  checkSourceLang(v, dir, core.source_text, "source_text");
  checkPrecedingLang(v, dir, core.preceding_turn, "코어");
  // R16 mode↔source_modality
  if (ctx.mode === "stt_interpreting" && ctx.source_modality !== "spoken") {
    add(v, "R16", "fail", "통역(stt_interpreting)은 source_modality='spoken'이어야 함");
  }
  if (ctx.mode === "translation" && ctx.source_modality !== "written") {
    add(v, "R16", "fail", "번역은 source_modality='written'이어야 함");
  }
  const situation = core.situation_ko?.trim() ?? "";
  if (
    ctx.mode === "translation" &&
    (EXPLICIT_NOT_WRITTEN_SCENE.test(situation) ||
      explicitlyRequiresSpokenScene(situation))
  ) {
    add(v, "R16", "fail", `번역 셀인데 situation_ko가 구두 수행을 명시함: "${situation.slice(0, 60)}"`);
  }
  if (
    ctx.mode === "stt_interpreting" &&
    EXPLICIT_WRITTEN_SCENE.test(situation) &&
    !EXPLICIT_NOT_WRITTEN_SCENE.test(situation)
  ) {
    add(v, "R16", "fail", `통역 셀인데 situation_ko가 서면 수행을 명시함: "${situation.slice(0, 60)}"`);
  }
  // R17 산업은 work에서만
  if (ctx.industry && ctx.domain !== "work") {
    add(v, "R17", "fail", `industry는 domain='work'에서만 (현재 ${ctx.domain})`);
  }
  // R26 직장 산업이 지정되었지만 실제 장면·원문에 분야 고유 단서가 전혀 없음
  if (ctx.industry && ctx.domain === "work") {
    const evidence = INDUSTRY_EVIDENCE[ctx.industry];
    const text = [
      core.situation_ko ?? "",
      core.relation_ko ?? "",
      core.source_text ?? "",
      core.preceding_turn ?? "",
    ].join(" ");
    if (!evidence || !evidence.test(text)) {
      add(
        v,
        "R26",
        "fail",
        `지정 산업 '${ctx.industry}'을 보여 주는 구체적 업무·대상·어휘가 없음`,
      );
    }
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
  coreInput?: unknown,
): RuleResult {
  const v: RuleViolation[] = [];
  const parsed = normalizeMission(missionInput);
  if (!parsed.ok) {
    add(v, "R1", "fail", `스키마 위반: ${parsed.error.issues[0]?.path?.join(".")} ${parsed.error.issues[0]?.message ?? ""}`);
    return finalize(v);
  }
  const m = parsed.data;
  const dir = m.direction;
  checkDirectionMatch(v, dir, ctx);
  const feature = getTargetFeature(m.unit.target_feature);

  // ── R1 유형 순서·axis_feature·band code 존재 ──
  const typesInOrder = m.mpj_items.map((it) => it.type);
  const expectedTypeOrder =
    m.schema_version === "mission_v4"
      ? MPJ_TYPE_ORDER_V4
      : m.schema_version === "mission_v3"
        ? MPJ_TYPE_ORDER_V3
        : MPJ_TYPE_ORDER_V2;
  if (typesInOrder.join(",") !== expectedTypeOrder.join(",")) {
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
        if (m.schema_version === "mission_v4" && "reference_scale_code" in it) {
          const accepted = new Set(it.accepted_scale_codes);
          const isAppropriatePair =
            accepted.has("very_appropriate") &&
            accepted.has("somewhat_appropriate");
          const isInappropriatePair =
            accepted.has("somewhat_inappropriate") &&
            accepted.has("very_inappropriate");
          if (
            it.accepted_scale_codes.length !== 2 ||
            (!isAppropriatePair && !isInappropriatePair)
          ) {
            add(v, "R7", "fail", `문항 ${it.id}: v4 Scale4 accepted는 같은 적절성 방향의 정확히 두 응답이어야 함`);
          }
          if (!accepted.has(it.reference_scale_code)) {
            add(v, "R7", "fail", `문항 ${it.id}: reference_scale_code가 accepted 방향에 포함되지 않음`);
          }
          if (!isAppropriatePair) {
            add(v, "R7", "warning", `문항 ${it.id}: 첫인상 문항이 적절한 반례가 아님 — "직접적이면 항상 나쁨" 편향 차단 여부를 눈검사`);
          }
        }
        checkTargetHighlights(v, it.id, it.target, it.highlights);
        break;
      }
      case "judge3": {
        // R2 within_band 포함(반례 문항)
        if (!it.accepted_band_codes.includes(withinCode)) {
          add(v, "R2", "fail", `문항 ${it.id}: judge3 accepted에 within_band(${withinCode}) 없음 — 반례 문항 규칙`);
        }
        checkTargetHighlights(v, it.id, it.target, it.highlights);
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
        if (m.schema_version === "mission_v4" && !samePdrBand(it.pdr, m.production_task.pdr)) {
          add(v, "R3", "fail", `문항 ${it.id}: v4 판단+교정은 DCT와 같은 앵커 PDR이어야 함`);
        }
        checkTargetLangSoft(v, dir, it.id, it.corrections.map((c) => c.text));
        checkTargetHighlights(v, it.id, it.target, it.highlights);
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
        checkTargetHighlights(v, it.id, it.target, it.highlights);
        break;
      }
      case "reason": {
        const ids = new Set(it.reasons.map((r) => r.id));
        if (!ids.has(it.accepted_reason_id)) {
          add(v, "R4", "fail", `문항 ${it.id}: accepted_reason_id가 reasons에 없는 id 참조`);
        }
        const primary = it.reasons.filter((r) => r.kind === "primary");
        const misconception = it.reasons.filter((r) => r.kind === "pragmatic_misconception");
        const other = it.reasons.filter((r) => r.kind === "meaning_grammar_context");
        if (primary.length !== 1 || misconception.length !== 1 || other.length !== 1) {
          add(v, "R4", "fail", `문항 ${it.id}: 이유 역할은 주원인·화용 오개념·의미/문법/맥락 오답이 각 1개여야 함`);
        }
        if (primary[0]?.id !== it.accepted_reason_id) {
          add(v, "R4", "fail", `문항 ${it.id}: accepted_reason_id는 primary 이유여야 함`);
        }
        if (!inappropriate(it.problem_band_code)) {
          add(v, "R18", "fail", `문항 ${it.id}: reason problem_band_code가 적정 대역임`);
        }
        if (!samePdrBand(it.pdr, m.production_task.pdr)) {
          add(v, "R4", "fail", `문항 ${it.id}: v4 이유 문항은 DCT와 같은 앵커 PDR이어야 함`);
        }
        checkTargetHighlights(v, it.id, it.target, it.highlights);
        break;
      }
      case "multi_judge": {
        // R5 길이 통제 강화판
        checkMultiJudgeLength(v, it.id, it.candidates, withinCode);
        if (m.schema_version === "mission_v4") {
          const lowCode = feature?.band_schema[0]?.code;
          const highCode = feature?.band_schema[feature.band_schema.length - 1]?.code;
          const counts = new Map<string, number>();
          for (const candidate of it.candidates) {
            const code = candidate.accepted_band_codes[0];
            counts.set(code, (counts.get(code) ?? 0) + 1);
          }
          if (
            !lowCode ||
            !highCode ||
            counts.get(lowCode) !== 2 ||
            counts.get(withinCode) !== 2 ||
            counts.get(highCode) !== 1
          ) {
            add(v, "R5", "fail", `문항 ${it.id}: v4 MultiJudge는 과소 2·적정 2·과잉 1이어야 함`);
          }
          if (pdrDifferenceCount(it.pdr, m.production_task.pdr) !== 1) {
            add(v, "R5", "fail", `문항 ${it.id}: v4 MultiJudge는 앵커 PDR에서 한 축만 바꾼 대비 상황이어야 함`);
          }
        }
        checkTargetLangSoft(v, dir, it.id, it.candidates.map((c) => c.text));
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
    if (!it.recommended_example?.trim()) {
      add(v, "R11", "fail", `문항 ${it.id}: recommended_example 없음`);
    }
  }

  // ── R12 세트 accepted 분포 전부 동일 방향(warning) ──
  checkSetDistribution(v, m, withinCode);
  if (m.schema_version === "mission_v4") checkV4ContextPlan(v, m as MissionV4);

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

  // ── R10 source=방향 source 언어·target/candidate=방향 target 언어 ──
  for (const it of m.mpj_items) {
    checkSourceLang(v, dir, it.source, `문항 ${it.id} source`);
    if ("target" in it && it.target) {
      checkTargetLangHard(v, dir, it.target, `문항 ${it.id} target`);
    }
    checkPrecedingLang(v, dir, it.preceding_turn, `문항 ${it.id}`);
  }
  checkSourceLang(v, dir, m.production_task.source_text, "production_task.source_text");

  // ── R8 v4 전 문항 또는 거절·응답류 preceding_turn ──
  if (m.schema_version === "mission_v4" || isResponseAct(ctx.speech_act)) {
    for (const it of m.mpj_items) {
      if (!it.preceding_turn) {
        add(
          v,
          "R8",
          "fail",
          `문항 ${it.id}: ${m.schema_version === "mission_v4" ? "v4 관계 맥락" : ctx.speech_act}은 preceding_turn 필수`,
        );
      }
    }
  }
  if (isResponseAct(ctx.speech_act)) {
    if (!m.production_task.preceding_turn) {
      add(v, "R8", "fail", "production_task: 거절·응답류는 preceding_turn 필수");
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
  if (coreInput != null) {
    const nc = normalizeCore(coreInput);
    if (nc.ok) checkInheritance(v, m, nc.data);
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
function checkProvenance(v: RuleViolation[], m: MissionRuntime) {
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

function collectBandCodes(it: MissionRuntime["mpj_items"][number]): string[] {
  switch (it.type) {
    case "judge3":
    case "fix_choice":
    case "reason_conf":
      return it.accepted_band_codes;
    case "reason":
      return [it.problem_band_code];
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
  // R6 highlights ⊂ target
  for (const h of highlights) {
    if (h && !target.includes(h)) {
      add(v, "R6", "fail", `문항 ${id}: highlight "${h}"가 target에 없음`);
    }
  }
}

// R5 multi_judge 길이 통제 강화판
function checkMultiJudgeLength(
  v: RuleViolation[],
  id: number,
  candidates: { text?: string; accepted_band_codes?: string[] }[],
  withinCode: string,
) {
  const lens = candidates.map((c) => [...(c.text ?? "")].length);
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
        add(v, "R5", "fail", `문항 ${id}: multi_judge에서 부적절안과 적정안이 길이만으로 완전히 분리됨`);
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
  return codes.some((c) =>
    /(too_direct|too_blunt|too_pressuring|too_confrontational|under_acknowledged|under_calibrated|under_engaged|under_specified|insufficient|impolite)/.test(c),
  );
}
function isOverBand(codes: string[]): boolean {
  return codes.some((c) =>
    /(too_indirect|too_tentative|too_ambiguous|too_obscured|over_elaborate|overextended|overreaching|over_attributed|excessive|overpolite)/.test(c),
  );
}

// strict:false 환경의 zod 추론은 필드를 optional로 준다 — 파라미터 타입도 느슨하게.
function samePdrBand(
  a: { p?: string; d?: string; r?: string },
  b: { p?: string; d?: string; r?: string },
): boolean {
  return a.p === b.p && a.d === b.d && a.r === b.r;
}

function pdrDifferenceCount(
  a: { p?: string; d?: string; r?: string },
  b: { p?: string; d?: string; r?: string },
): number {
  return Number(a.p !== b.p) + Number(a.d !== b.d) + Number(a.r !== b.r);
}

function checkV4ContextPlan(v: RuleViolation[], m: MissionV4) {
  const production = m.production_task.situation_ko.trim();
  const situations = m.mpj_items.map((it) => it.situation_ko.trim());
  if (new Set(situations).size !== situations.length) {
    add(v, "R27", "fail", "v4 MPJ 상황이 서로 중복됨 — 앵커 PDR 안에서도 장면은 달라야 함");
  }
  if (situations.some((s) => s === production)) {
    add(v, "R27", "fail", "v4 MPJ 상황이 DCT 상황을 그대로 복제함 — 새 장면의 근접 전이가 아님");
  }
  for (const it of m.mpj_items) {
    const sentenceMarks = (it.situation_ko.match(/[.!?。！？]/g) ?? []).length;
    if (it.situation_ko.trim().length < 45 || sentenceMarks < 2) {
      add(v, "R27", "warning", `문항 ${it.id}: 상황문이 짧아 P/D/R 근거가 충분히 보이지 않을 수 있음`);
    }
    const allowed =
      m.production_task.mode === "interpreting"
        ? it.channel === "facetoface" || it.channel === "phone"
        : it.channel === "email" || it.channel === "messenger";
    if (!allowed) {
      add(v, "R28", "fail", `문항 ${it.id}: channel(${it.channel})이 ${m.production_task.mode} 수행 방식과 맞지 않음`);
    }
  }
}

function checkSetDistribution(v: RuleViolation[], m: MissionRuntime, withinCode: string) {
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

function checkNationalization(v: RuleViolation[], m: MissionRuntime) {
  const fields: string[] = [];
  for (const it of m.mpj_items) {
    fields.push(it.explanation_ko);
    if (it.type === "fix_choice") fields.push(...it.corrections.map((c) => c.note_ko));
    if (it.type === "reason") fields.push(...it.reasons.map((r) => r.text_ko));
    if (it.type === "multi_judge") fields.push(...it.candidates.map((c) => c.note_ko));
  }
  for (const f of fields) {
    if (NATIONALIZE.test(f)) {
      add(v, "R9", "fail", `국가 단위 일반화: "${f.slice(0, 30)}…"`);
    }
  }
}

function checkInternalDuplicates(v: RuleViolation[], m: MissionRuntime) {
  const targets = m.mpj_items
    .map((it) => ("target" in it ? it.target : ""))
    .filter(Boolean);
  const seen = new Set<string>();
  for (const t of targets) {
    if (seen.has(t)) add(v, "R19", "warning", `target 완전 중복: "${t.slice(0, 20)}…"`);
    seen.add(t);
  }
}

function checkRecommendedConsistency(v: RuleViolation[], m: MissionRuntime, withinCode: string) {
  for (const it of m.mpj_items) {
    if (it.type === "fix_choice") {
      // 권장안이 valid 교정 중 하나와 동일하면 이상적(모순 아님). 부적절 target과 동일하면 warning
      if (it.recommended_example === it.target) {
        add(v, "R21", "warning", `문항 ${it.id}: recommended_example가 부적절 target과 동일`);
      }
    }
  }
}

function checkInheritance(v: RuleViolation[], m: MissionRuntime, core: ScenarioCoreV2) {
  const pt = m.production_task;
  if (pt.source_text !== core.source_text) {
    add(v, "R23", "fail", "production_task.source_text가 코어를 계승하지 않음");
  }
  // channel 폐기(2026-07-25): production_task.channel ↔ core.channel 계승 검사 제거.
  if (!samePdrBand(pt.pdr, core.pdr)) {
    add(v, "R23", "fail", "production_task.pdr가 코어를 계승하지 않음");
  }
  if (pt.source_modality !== core.source_modality) {
    add(v, "R23", "fail", `production_task.source_modality(${pt.source_modality}) ≠ 코어(${core.source_modality})`);
  }
  if (m.direction !== core.direction) {
    add(v, "R23", "fail", `미션 방향(${m.direction}) ≠ 코어 방향(${core.direction})`);
  }
  const missionFacts = pt.usable_facts ?? [];
  const coreFacts = core.usable_facts ?? [];
  if (
    missionFacts.length !== coreFacts.length ||
    missionFacts.some((fact, index) => fact !== coreFacts[index])
  ) {
    add(v, "R23", "fail", "production_task.usable_facts가 코어의 서버 승인 사실 목록을 계승하지 않음");
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
