// 규칙검사 R1~R32 — 결정론·API 0회. 생성계약 v1.5 §8 + 양방향(0-l·85).
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
  type MissionV5,
  type MissionRuntime,
  MPJ_TYPE_ORDER_V2,
  MPJ_TYPE_ORDER_V3,
  MPJ_TYPE_ORDER_V4,
  MPJ_TYPE_ORDER_V6,
} from "@/lib/pragma/missionSchema";
import {
  ITEM_LINEAGE_MAX_BATCH_SIZE,
  ITEM_LINEAGE_MAX_UNATTRIBUTED_RATIO,
  validateItemLineage,
} from "@/lib/pragma/itemLineage";
import { buildMissionLineageScope } from "@/lib/pragma/missionLineage";
import {
  CURRENT_ITEM_LINEAGE_PROMPT_VERSION,
  CURRENT_MISSION_PROMPT_VERSIONS,
} from "../../../supabase/functions/_shared/contentRelease";
import {
  normalizeCore,
  type ScenarioCoreRuntime,
  type FocalSegment,
} from "@/lib/pragma/coreSchema";
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
import {
  CORE_LENGTH_POLICY_VERSION,
  coreLengthHintKo as sharedCoreLengthHintKo,
  coreLengthRange,
  countCoreEffectiveChars,
} from "../../../supabase/functions/_shared/coreLengthPolicy";
import {
  CORE_SOURCE_SENTENCE_MAX,
  CORE_SOURCE_SENTENCE_MIN,
  coreBilingualSceneIssue,
  coreBilingualSceneWarning,
  coreLearnerSceneIssue,
  countCoreSourceSentences,
} from "../../../supabase/functions/_shared/coreSourceRepair";

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
// 2026-07-31: 495 본배치에서 통역 셀 4건이 오탐으로 버려져 부정 표현 처리를 넓혔다.
// ①"남기지는 않습니다"처럼 보조사가 끼는 경우 ②"남기려는 목적은 아닙니다"처럼 부정어가
// 멀리 있는 경우 ③"남지 않으며"처럼 어간이 줄어드는 경우를 모두 잡는다.
// 부정 형태마다 붙는 거리가 다르다. `-지 않`은 동사에 직접 붙으므로 거리를 0으로 묶고
// (안 그러면 "글로 남기며 … 기대하지 않는다"의 부정을 남기에 잘못 붙인다),
// "-려는 목적은 아닙니다"류만 거리를 허용한다.
const EXPLICIT_NOT_WRITTEN_SCENE =
  /(?:글|서면|문서|기록)(?:로|으로|에|을)?[^.!?\n]{0,24}(?:(?:남기|남|적|쓰|작성|보내|전달)(?:지|진)\s*(?:는|도|만|가)?\s*않|(?:남기|적|쓰|작성|보내|전달)[^.!?\n]{0,12}(?:아니|아닙|아님))/;
// `직접`은 발화 외 동사도 수식한다("직접 수행할 수 있는 … 요청하며" — 495 배치 오탐).
// 발화 동사와의 거리를 좁혀 수식 대상이 발화일 때만 구두 장면으로 본다.
const EXPLICIT_SPOKEN_SCENE =
  /(?:직접\s*(?:만나[^.!?\n]{0,16})?|말로|구두로|대면(?:으로|에서)?|전화(?:로|에서)?|통화(?:로|에서)?)[^.!?\n]{0,12}(?:말하|묻|전하|알리|설명하|칭찬하|사과하|요청하|의견을\s*나누)|(?:말하|묻|대화하)(?:는|고\s*있는)\s*(?:자리|상황)/;
const EXPLICIT_SPOKEN_AVOIDANCE =
  /(?:직접\s*(?:만나[^.!?\n]{0,16})?|말로|구두로|대면(?:으로|에서)?|전화(?:로|에서)?|통화(?:로|에서)?)[^.!?\n]{0,32}(?:어렵|어색|부담|피하|대신|지\s*않|아니)/;
// `적`을 단독 대안으로 두면 "자발적·공식적·즉각적"의 접미사에 걸린다(495 배치 오탐).
// 쓰기 동사로 쓰인 형태만 인정한다.
// 어간으로 둔다 — "작성하"로 쓰면 "작성한다"를 놓친다(하+ㄴ다 축약).
const WRITE_VERB = "작성|전송|제출|보내|남기|쓰|적어|적는|적을|적힌";
const EXPLICIT_WRITTEN_SCENE = new RegExp(
  `(?:이메일|메일|메신저|문자|채팅)(?:로|에|에서|를\\s*통해)?[^.!?\\n]{0,30}(?:${WRITE_VERB})` +
    `|(?:글|서면|문서|기록)(?:로|으로|에|을)?[^.!?\\n]{0,25}(?:${WRITE_VERB}|전달하)`,
);

// R26은 의미 판정기가 아니라 명백한 "산업 라벨만 있고 실제 단서는 없음"을 막는 하한선이다.
// 범용어(회사·프로젝트·제품·고객·행사)는 단독 증거로 쓰지 않는다. 구체성의 최종 판정은
// core_quality v4와 인간 검수가 맡는다.
const INDUSTRY_EVIDENCE: Record<string, RegExp> = {
  culture_content_media:
    /엔터테인먼트|미디어|방송|영상|음원|공연|촬영|편집|콘텐츠\s*제작|배급|스트리밍|드라마|웹툰|시나리오|각본|서사\s*구조|예능|시놉시스|출연자|캐스팅|시청률|프로그램\s*(?:제작|편성)/iu,
  manufacturing:
    /뷰티|화장품|스킨케어|메이크업|패션|의류|브랜드\s*(?:상품|매장)|온라인\s*몰|커머스|판매\s*채널/iu,
  trade_distribution:
    /제조|생산\s*라인|공장|무역|수출|수입|통관|물류|선적|납품|공급망|발주/iu,
  IT_platform:
    /IT|테크|플랫폼|소프트웨어|애플리케이션|앱|서버|데이터베이스|개발|배포|API|알고리즘/iu,
  public_international_affairs:
    /바이오|의료|헬스케어|병원|환자|의약|약품|임상|진료|건강\s*관리|검사\s*결과/iu,
  tourism_hospitality:
    /관광|여행|호텔|숙박|항공|투어|MICE|마이스|컨벤션|전시회|박람회|관광객|방문객|객실|예약/iu,
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

// ── R29 미니 담화형 원문 + focal segments (DEC-20260730-01) ────────────
// 중국어 쉼표 연결 장문과 한국어 문장 경계의 비대칭을 피하기 위해 분량 하드 경계는
// 공백·문장부호 제외 유효 글자 수로 판정한다. 2~4문장은 담화 형태를 유도하는 warning이다.
// focal_segments는 head 정확히 1 + support 0~2이고, 각 text는 source_text의
// 정확한 부분문자열이어야 한다 — 저장·화면 강조·피드백이 같은 문자열을 본다.
export const coreLengthHintKo = sharedCoreLengthHintKo;
export const countSentences = countCoreSourceSentences;
export { CORE_LENGTH_POLICY_VERSION, countCoreEffectiveChars };

function checkFocalDiscourse(
  v: RuleViolation[],
  sourceText: string,
  segments: FocalSegment[] | undefined,
  label: string,
  ctx: CheckContext,
) {
  const sentenceCount = countSentences(sourceText);
  if (sentenceCount < CORE_SOURCE_SENTENCE_MIN || sentenceCount > CORE_SOURCE_SENTENCE_MAX) {
    add(
      v,
      "R29",
      "warning",
      `${label}: 미니 담화는 종결부호 기준 ${CORE_SOURCE_SENTENCE_MIN}~${CORE_SOURCE_SENTENCE_MAX}문장 권장(실측 ${sentenceCount}문장)`,
    );
  }
  const effectiveChars = countCoreEffectiveChars(sourceText);
  const range = coreLengthRange(ctx.level, ctx.mode);
  if (effectiveChars < range.min || effectiveChars > range.max) {
    add(
      v,
      "R29",
      "fail",
      `${label}: ${CORE_LENGTH_POLICY_VERSION} 기준 유효 글자 ${range.min}~${range.max}자여야 함(공백·문장부호 제외 실측 ${effectiveChars}자)`,
    );
  }

  if (!segments || segments.length === 0) {
    add(v, "R29", "fail", `${label}: focal_segments가 없음(화용 집중 구간 미지정)`);
    return;
  }
  const heads = segments.filter((s) => s.role === "head");
  if (heads.length !== 1) {
    add(v, "R29", "fail", `${label}: focal_segments의 head는 정확히 1개여야 함(실제 ${heads.length}개)`);
  }
  if (segments.length - heads.length > 2) {
    add(v, "R29", "fail", `${label}: support 구간은 최대 2개(실제 ${segments.length - heads.length}개)`);
  }
  for (const seg of segments) {
    if (!sourceText.includes(seg.text)) {
      add(v, "R29", "fail", `${label}: focal segment가 원문의 부분문자열이 아님 — "${seg.text.slice(0, 30)}"`);
    }
  }
  const seen = new Set<string>();
  for (const seg of segments) {
    if (seen.has(seg.text)) {
      add(v, "R29", "warning", `${label}: focal segment 중복 — "${seg.text.slice(0, 30)}"`);
    }
    seen.add(seg.text);
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
  if (
    ctx.require_context_spec &&
    ctx.mode === "stt_interpreting" &&
    (!core.context_spec?.interpreter_role_contract ||
      core.context_spec.interpreter_role_contract.source_speaker !== "A" ||
      core.context_spec.interpreter_role_contract.target_addressee !== "B" ||
      core.context_spec.interpreter_role_contract.learner_interpreter !== "C" ||
      core.context_spec.interpreter_role_contract.pdr_relation !== "A_to_B")
  ) {
    add(v, "R25", "fail", "신규 통역 코어의 context_spec에 A/B/C 및 P·D·R=A↔B 역할 계약이 없음");
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

  // R29 — scenario_core_v3(미니 담화형)만 대상. legacy v1·v2 단문 코어는 면제.
  if (core.focal_segments !== undefined) {
    checkFocalDiscourse(v, core.source_text, core.focal_segments, "코어 source_text", ctx);
  }
  return finalize(v);
}

// 코어·미션 production_task 공통 서브셋(R8·R9·R10·R16·R17)
function checkCoreCommon(
  v: RuleViolation[],
  core: Pick<ScenarioCoreRuntime, "direction" | "source_text" | "preceding_turn"> & {
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
  const bilingualSceneIssue = coreBilingualSceneIssue(
    situation,
    DIRECTION_LANGS[dir].source,
    DIRECTION_LANGS[dir].target,
    ctx.mode === "stt_interpreting",
    core.relation_ko,
  );
  if (bilingualSceneIssue) {
    add(v, "R16", "fail", `통역 셀인데 이중언어 화자·통역 개입 장면이 불명확함: ${bilingualSceneIssue.message}`);
  }
  const bilingualSceneWarning = coreBilingualSceneWarning(
    situation,
    ctx.mode === "stt_interpreting",
  );
  if (bilingualSceneWarning) {
    add(v, "R16", "warning", `통역 역할 확인 필요: ${bilingualSceneWarning.message}`);
  }
  const learnerSceneIssue = coreLearnerSceneIssue(situation);
  if (learnerSceneIssue) {
    add(v, "R30", "fail", `학생용 situation_ko에 답안 평가 기준이 노출됨: ${learnerSceneIssue.message}`);
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

  // mission_v5는 MPJ 4문항 구성·순서·판정이 v4와 완전히 동일하다(DEC-20260730-01).
  // 변경점은 DCT 원문뿐이므로 아래 v4 계약 검사는 v5에도 그대로 적용한다.
  const isV4Contract = m.schema_version === "mission_v4" || m.schema_version === "mission_v5";

  // ── R1 유형 순서·axis_feature·band code 존재 ──
  const typesInOrder = m.mpj_items.map((it) => it.type);
  const expectedTypeOrder = m.schema_version === "mission_v6"
    ? MPJ_TYPE_ORDER_V6
    : isV4Contract
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
        if ((isV4Contract || m.schema_version === "mission_v6") && "reference_scale_code" in it) {
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
            add(v, "R7", "fail", `문항 ${it.id}: Scale4 accepted는 같은 적절성 방향의 정확히 두 응답이어야 함`);
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
        if ((isV4Contract || m.schema_version === "mission_v6") && !samePdrBand(it.pdr, m.production_task.pdr)) {
          add(v, "R3", "fail", `문항 ${it.id}: 판단+교정은 DCT와 같은 앵커 PDR이어야 함`);
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
      case "fix_review": {
        const passing = it.corrections.filter((correction) => correction.verdict === "pass");
        const rejected = it.corrections.filter((correction) => correction.verdict === "reject");
        const correctionIds = new Set(it.corrections.map((correction) => correction.id));
        const reasonIds = new Set(it.failure_reasons.map((reason) => reason.id));
        const acceptedReason = it.failure_reasons.find((reason) => reason.id === it.accepted_failure_reason_id);
        const failureTypes = new Set(it.failure_reasons.map((reason) => reason.failure_type));
        if (passing.length !== 2 || rejected.length !== 1 || correctionIds.size !== 3) {
          add(v, "R4", "fail", `문항 ${it.id}: FixReview는 통과 2개·탈락 1개여야 함`);
        }
        if (new Set(passing.map((correction) => correction.strategy_code)).size !== 2) {
          add(v, "R4", "fail", `문항 ${it.id}: 통과 교정본 두 개의 전략이 서로 다르지 않음`);
        }
        if (
          !acceptedReason ||
          !reasonIds.has(it.accepted_failure_reason_id) ||
          failureTypes.size !== 3 ||
          !rejected[0]?.failure_type ||
          acceptedReason.failure_type !== rejected[0].failure_type
        ) {
          add(v, "R4", "fail", `문항 ${it.id}: FixReview의 단일 핵심 실패 원인이 명확하지 않음`);
        }
        if (!samePdrBand(it.pdr, m.production_task.pdr)) {
          add(v, "R4", "fail", `문항 ${it.id}: FixReview PDR이 DCT 기준 PDR과 다름`);
        }
        checkTargetLangSoft(v, dir, it.id, it.corrections.map((correction) => correction.text));
        checkTargetHighlights(v, it.id, it.target, it.highlights);
        checkRoleLengthCue(
          v,
          "R4",
          it.id,
          it.corrections.map((correction) => ({ text: correction.text, role: correction.verdict })),
          "FixReview",
        );
        break;
      }
      case "multi_judge": {
        // R5 길이 통제 강화판
        checkMultiJudgeLength(v, it.id, it.candidates, withinCode);
        if (m.schema_version === "mission_v6") {
          const current = it as typeof it & {
            pdr_contrast_axis: "p" | "d" | "r";
            candidates: Array<{
              text: string;
              band_role: "under" | "within" | "over";
              accepted_band_codes: string[];
            }>;
          };
          const roles = current.candidates.map((candidate) => candidate.band_role);
          const counts = {
            under: roles.filter((role) => role === "under").length,
            within: roles.filter((role) => role === "within").length,
            over: roles.filter((role) => role === "over").length,
          };
          if (counts.under !== 1 || counts.within !== 1 || counts.over !== 1) {
            add(v, "R5", "fail", `문항 ${it.id}: MultiJudge 역할 분포가 과소1·적정1·과잉1이 아님`);
          }
          const featureCodes = feature?.band_schema.map((band) => band.code) ?? [];
          const expectedByRole = {
            under: featureCodes[0],
            within: withinCode,
            over: featureCodes[featureCodes.length - 1],
          };
          for (const candidate of current.candidates) {
            if (candidate.accepted_band_codes[0] !== expectedByRole[candidate.band_role]) {
              add(v, "R5", "fail", `문항 ${it.id}: ${candidate.band_role} 후보의 band code가 역할과 불일치`);
            }
          }
          const changedAxes = (["p", "d", "r"] as const).filter(
            (axis) => current.pdr[axis] !== m.production_task.pdr[axis],
          );
          if (changedAxes.length !== 1 || changedAxes[0] !== current.pdr_contrast_axis) {
            add(v, "R5", "fail", `문항 ${it.id}: 기준 PDR에서 정확히 한 축만 바뀌지 않음`);
          }
        } else if (isV4Contract) {
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
  if (isV4Contract) checkV4ContextPlan(v, m as MissionV4 | MissionV5);

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
  if (isV4Contract || isResponseAct(ctx.speech_act)) {
    for (const it of m.mpj_items) {
      if (!it.preceding_turn) {
        add(
          v,
          "R8",
          "fail",
          `문항 ${it.id}: ${isV4Contract ? "v4 관계 맥락" : ctx.speech_act}은 preceding_turn 필수`,
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

  // ── mission_v6 최종 계약: P·D·R 계획, 후보 역할, DCT 지원 정책 ──
  if (m.schema_version === "mission_v6") {
    const [scale, fixChoice, fixReview] = m.mpj_items;
    if (samePdrBand(scale.pdr, m.production_task.pdr)) {
      add(v, "R25", "fail", "MPJ1은 단순 규칙을 깨는 대조 상황이어야 하므로 기준 PDR과 같을 수 없음");
    }
    if (
      fixChoice.situation_ko === m.production_task.situation_ko ||
      fixChoice.source === m.production_task.source_text ||
      fixReview.situation_ko === m.production_task.situation_ko ||
      fixReview.source === m.production_task.source_text
    ) {
      add(v, "R25", "fail", "MPJ2·MPJ3와 DCT는 같은 PDR의 서로 다른 사건이어야 함");
    }

    if (fixChoice.type === "fix_choice") {
      const roles = new Set(fixChoice.corrections.map((correction) => correction.role));
      const valid = fixChoice.corrections.filter((correction) => correction.is_valid);
      const validStrategies = new Set(valid.map((correction) => correction.strategy_code));
      if (
        roles.size !== 4 ||
        valid.length !== 2 ||
        validStrategies.size !== 2 ||
        valid.some((correction) => !["valid_a", "valid_b"].includes(correction.role)) ||
        fixChoice.corrections.some((correction) =>
          ["valid_a", "valid_b"].includes(correction.role) !== correction.is_valid
        )
      ) {
        add(v, "R3", "fail", "FixChoice는 서로 다른 적절 전략 2개·미수리 1개·과잉수리 1개여야 함");
      }
      checkRoleLengthCue(
        v,
        "R3",
        fixChoice.id,
        fixChoice.corrections.map((correction) => ({
          text: correction.text,
          role: correction.is_valid ? "valid" : "invalid",
        })),
        "FixChoice",
      );
    }

    if (fixChoice.type === "fix_choice" && fixReview.type === "fix_review") {
      const rejectedFailureType = fixReview.corrections.find(
        (correction) => correction.verdict === "reject",
      )?.failure_type;
      if (rejectedFailureType === "under_repair" || rejectedFailureType === "over_repair") {
        add(
          v,
          "R30",
          "fail",
          "MPJ3 탈락본은 MPJ2 오답의 미수리·과잉수리 실패 유형을 반복하지 않아야 함",
        );
      }
    }

    const pt = m.production_task;
    if (pt.mode === "translation" && (pt.vocabulary_hints?.length ?? 0) > 2) {
      add(v, "R16", "fail", "번역 DCT의 내용 어휘 힌트는 최대 2개");
    }
    if (pt.mode === "interpreting") {
      if ((pt.vocabulary_hints?.length ?? 0) > 0) {
        add(v, "R16", "fail", "통역 DCT에는 어휘 힌트를 제공하지 않음");
      }
      if (pt.replay_limit !== 2) {
        add(v, "R16", "fail", "통역 DCT replay_limit는 정확히 2여야 함");
      }
    }
  }

  // ── R23 미션 production_task가 코어 계승 ──
  if (coreInput != null) {
    const nc = normalizeCore(coreInput);
    if (nc.ok) checkInheritance(v, m, nc.data);
  }

  // ── R29 mission_v5 미니 담화형 DCT + focal segments ──
  if (m.schema_version === "mission_v5") {
    checkFocalDiscourse(
      v,
      m.production_task.source_text,
      m.production_task.focal_segments,
      "production_task.source_text",
      ctx,
    );
    // 참고 산출안이 담화 전체가 아니라 중심 화행만 옮긴 경우를 잡는다. 학습자가
    // 이것을 정답 분량으로 오해하면 부분 번역을 학습하게 된다(2026-07-30 실화면
    // 발견). 목표어 압축을 허용하되 명백히 짧은 것만 warning으로 표시한다.
    const srcLen = [...m.production_task.source_text].length;
    for (const alt of m.production_task.reference_alternatives) {
      const altLen = [...alt.text].length;
      if (srcLen > 0 && altLen < srcLen * 0.45) {
        add(
          v,
          "R29",
          "warning",
          `reference_alternatives가 담화 전체를 옮기지 않은 것으로 보임(원문 ${srcLen}자 대비 ${altLen}자): "${alt.text.slice(0, 24)}"`,
        );
      }
    }
  }

  // R31 — 현재 생성 계약의 mission_v6는 문항별 모델 귀속을 완전하게 생성해야 저장할 수 있다.
  // 귀속은 전문가 승인 전 pending claim이며, 구조·scope·근거 합집합만 자동 판정한다.
  if (
    m.schema_version === "mission_v6" &&
    m.provenance?.prompt_version === CURRENT_MISSION_PROMPT_VERSIONS[0]
  ) {
    const lineageScope = buildMissionLineageScope({
      direction: m.direction,
      speechAct: ctx.speech_act,
      targetFeature: m.unit.target_feature,
    });
    for (const issue of validateItemLineage(m, lineageScope)) {
      add(v, "R31", "fail", `${issue.target_path ? `${issue.target_path}: ` : ""}${issue.message}`);
    }
    if (lineageScope.coverage_status === "covered" && m.item_lineage) {
      const lineage = m.item_lineage;
      const attribution = lineage.attribution_provenance;
      const coverage = lineage.coverage_summary;
      if (lineage.claim_status !== "model_attribution_pending_review") {
        add(v, "R31", "fail", "현재 mission_v6 item_lineage는 전문가 검토 전 pending 상태여야 함");
      }
      if (!coverage) {
        add(v, "R31", "fail", "item_lineage.coverage_summary 누락");
      } else if (coverage.unattributed_count / coverage.total_count > ITEM_LINEAGE_MAX_UNATTRIBUTED_RATIO) {
        add(v, "R31", "fail", `model_unattributed 비율 20% 초과 (${coverage.unattributed_count}/${coverage.total_count})`);
      } else if (coverage.unattributed_count > 0) {
        add(v, "R32", "warning", `전문가가 우선 확인할 model_unattributed claim ${coverage.unattributed_count}개`);
      }
      if (
        !attribution ||
        attribution.prompt_version !== CURRENT_ITEM_LINEAGE_PROMPT_VERSION ||
        !attribution.provider ||
        !attribution.prompt_instance_hash ||
        !attribution.batch_count ||
        !attribution.calls ||
        attribution.calls.length !== attribution.batch_count ||
        attribution.calls.some((call, index) =>
          call.batch_index !== index + 1 ||
          call.target_count < 1 ||
          call.target_count > ITEM_LINEAGE_MAX_BATCH_SIZE ||
          call.attempts < 1
        ) ||
        (coverage && attribution.calls.reduce((sum, call) => sum + call.target_count, 0) !== coverage.total_count)
      ) {
        add(v, "R31", "fail", "item_lineage attribution provenance가 현재 mission_v6 생성계약과 다름");
      }
    }
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
  if (m.schema_version === "mission_v6" && p.prompt_version === CURRENT_MISSION_PROMPT_VERSIONS[0]) {
    if (!p.provider) add(v, "R20", "fail", "현재 mission_v6 provenance.provider 누락");
    if (!p.prompt_instance_hash) add(v, "R20", "fail", "현재 mission_v6 provenance.prompt_instance_hash 누락");
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
    case "fix_review":
      return [];
    case "multi_judge":
      return it.candidates.flatMap((c) => c.accepted_band_codes);
    default:
      return []; // scale4는 scale code (band 아님)
  }
}

function checkRoleLengthCue(
  v: RuleViolation[],
  ruleId: "R3" | "R4" | "R5",
  id: number,
  options: Array<{ text: string; role: string }>,
  label: string,
) {
  if (options.length < 3) return;
  const rows = options.map((option) => ({ ...option, length: [...option.text].length }));
  const roles = [...new Set(rows.map((row) => row.role))];
  const min = Math.min(...rows.map((row) => row.length));
  const max = Math.max(...rows.map((row) => row.length));
  for (const role of roles) {
    const current = rows.filter((row) => row.role === role);
    const other = rows.filter((row) => row.role !== role);
    if (!current.length || !other.length) continue;
    const uniquelyExtreme =
      (current.length === 1 && (current[0].length === min || current[0].length === max)) ||
      current.every((row) => row.length < Math.min(...other.map((entry) => entry.length))) ||
      current.every((row) => row.length > Math.max(...other.map((entry) => entry.length)));
    if (uniquelyExtreme) {
      add(v, ruleId, "fail", `문항 ${id}: ${label} 선택지 길이가 '${role}' 역할의 정답 단서가 됨`);
      return;
    }
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
        const separation = badLens.every((l) => l < okMin)
          ? "부적절안이 모두 적정안보다 짧음"
          : "부적절안이 모두 적정안보다 김";
        const candidateLengths = candidates
          .map((candidate, index) => {
            const bands = codesOf(candidate).join("|") || "대역 없음";
            return `후보 ${index + 1}[${bands}]=${lens[index]}자`;
          })
          .join(", ");
        add(
          v,
          "R5",
          "fail",
          `문항 ${id}: multi_judge에서 부적절안과 적정안이 길이만으로 완전히 분리됨` +
            ` (${separation}; ${candidateLengths}). 재생성 시 각 후보의 초점 자원과 대역은 유지하고,` +
            ` 새 사실을 더하지 않는 중립적 연결·부연 또는 문장 압축으로 적정안과 부적절안의 길이 범위를 겹치게 하세요`,
        );
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

function checkV4ContextPlan(v: RuleViolation[], m: MissionV4 | MissionV5) {
  const production = m.production_task.situation_ko.trim();
  const situations = m.mpj_items.map((it) => it.situation_ko.trim());
  const situationIndexes = new Map<string, number[]>();
  situations.forEach((situation, index) => {
    const indexes = situationIndexes.get(situation) ?? [];
    indexes.push(index + 1);
    situationIndexes.set(situation, indexes);
  });
  for (const [situation, indexes] of situationIndexes) {
    if (indexes.length < 2) continue;
    add(
      v,
      "R27",
      "fail",
      `v4 MPJ 문항 ${indexes.join("·")}의 situation_ko가 완전히 중복됨: ` +
        `"${situation.slice(0, 90)}${situation.length > 90 ? "…" : ""}". ` +
        "앵커 PDR은 유지하되 인물의 구체적 용건·대상·사건을 서로 다르게 다시 만드세요",
    );
  }
  situations.forEach((situation, index) => {
    if (situation !== production) return;
    add(
      v,
      "R27",
      "fail",
      `v4 MPJ 문항 ${index + 1}의 situation_ko가 DCT 상황을 그대로 복제함: ` +
        `"${situation.slice(0, 90)}${situation.length > 90 ? "…" : ""}". ` +
        "같은 앵커 PDR을 유지하면서도 DCT와 다른 인물의 구체적 용건·대상·사건으로 다시 만드세요",
    );
  });
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
    if (it.type === "fix_review") {
      fields.push(...it.corrections.map((c) => c.note_ko));
      fields.push(...it.failure_reasons.map((reason) => reason.text_ko));
      fields.push(it.repair_principle_ko);
    }
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

function checkInheritance(v: RuleViolation[], m: MissionRuntime, core: ScenarioCoreRuntime) {
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
