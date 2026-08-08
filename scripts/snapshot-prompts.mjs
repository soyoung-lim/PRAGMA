// 프롬프트 스냅샷 생성기 — 배포되는 edge 소스에서 "모델에 실제로 가는 문장"을 뽑아
// src/lib/pragma/promptSnapshot.generated.ts 로 굳힌다. 관리자 화면은 이 파일만 읽는다.
//
// 왜 손으로 옮겨 적지 않는가:
//   손으로 복사한 문서는 코드가 바뀌는 순간 조용히 거짓이 된다(question-designer 전례).
//   그래서 npm run build 때마다(prebuild) 원본에서 자동 재생성한다 — 화면이 낡을 수 없다.
//
// 왜 값 자리에 센티넬을 쓰는가:
//   화행·수준·P/D/R는 호출마다 달라지는 입력이고, 이미 scenarios 행 컬럼에 저장된다.
//   여기서 보여줘야 하는 것은 '고정된 지시문'이므로 값 자리는 PROBE_* 로 표시한다.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EDGE = "supabase/functions/generate-scenario/index.ts";
const OUT = resolve(ROOT, "src/lib/pragma/promptSnapshot.generated.ts");

const src = readFileSync(resolve(ROOT, EDGE), "utf8");
const canonicalText = (text) => text.replace(/\r\n?/g, "\n");

// edge 소스를 그대로 실행해 빌더 함수를 얻는다(복사본이 아니라 원본이어야 의미가 있다).
globalThis.Deno = { serve: () => {}, env: { get: () => "SNAPSHOT" } };
const EXPOSE = `
;globalThis.__S = {
  buildCoreSystemPrompt, buildCoreUserPrompt, corePromptSnapshotHash, CORE_PROBE_BASE,
  buildCoreSourceRepairPrompt, buildCoreOutputRepairPrompt,
  buildMissionSystemPrompt, buildMissionUserPrompt, buildFeedbackSystemPrompt, buildQualitySystemPrompt,
  buildCoreQualitySystemPrompt,
  buildAuthenticSystemPrompt,
  PRIMARY_MODEL, FALLBACK_MODEL, CORE_TEMPERATURE, CORE_RESPONSE_FORMAT,
  CORE_LENGTH_POLICY_VERSION, CORE_LENGTH_RANGES,
};`;
// Edge가 _shared 모듈을 import해도 실행 가능하도록 로컬 의존성까지 한 번에 묶는다.
// EXPOSE를 진입 소스 안에 붙여야 번들 IIFE 내부 심볼을 안전하게 꺼낼 수 있다.
const executable = buildSync({
  stdin: {
    contents: src + EXPOSE,
    resolveDir: dirname(resolve(ROOT, EDGE)),
    sourcefile: "index.ts",
    loader: "ts",
  },
  bundle: true,
  write: false,
  platform: "neutral",
  format: "iife",
  target: "es2022",
}).outputFiles[0].text;
(0, eval)(executable);
const S = globalThis.__S;

const sha = (s) => createHash("sha256").update(s, "utf8").digest("hex");
const git = (cmd, fallback) => {
  try { return execSync(cmd, { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); }
  catch { return fallback; }
};

// 미션 프롬프트는 화용 초점 카탈로그를 입력으로 받는다 — 지시문만 보이도록 센티넬을 넣는다.
const PROBE_FEATURE = {
  code: "PROBE_FEATURE", version: "PROBE_VER", learner_label: "PROBE_LABEL",
  operational_definition: "PROBE_DEFINITION",
  band_schema: [{ code: "PROBE_BAND_LOW", label_ko: "PROBE_BAND_LOW_KO" },
                { code: "within_band", label_ko: "PROBE_BAND_OK_KO" },
                { code: "PROBE_BAND_HIGH", label_ko: "PROBE_BAND_HIGH_KO" }],
  within_band_code: "within_band",
  relevant_resources: ["PROBE_RESOURCE"], excluded_confounds: ["PROBE_CONFOUND"],
  closing_principle_ko: "PROBE_CLOSING", counter_rule_note: "PROBE_COUNTER_RULE",
};

const entry = (key, label, group, note, text) => ({ key, label, group, note, sha256: sha(text), text });

const prompts = [
  entry("core.system.ko_zh", "코어 생성 · 지시문 (한→중)", "core",
    "500개 뱅크를 만드는 프롬프트. 상황·원문만 생성한다.", S.buildCoreSystemPrompt("ko_zh")),
  entry("core.system.zh_ko", "코어 생성 · 지시문 (중→한)", "core",
    "중→한 스모크용. 같은 구조, 원문·산출 언어만 반대.", S.buildCoreSystemPrompt("zh_ko")),
  entry("core.user.written", "코어 생성 · 요청서 (번역)", "core",
    "직장·산업 셀 조건이 들어가는 자리. PROBE_* 는 호출마다 바뀌는 값.",
    S.buildCoreUserPrompt({
      ...S.CORE_PROBE_BASE,
      direction: "ko_zh",
      source_modality: "written",
      is_response_act: false,
      industry: "PROBE_INDUSTRY",
      func: "PROBE_FUNCTION",
    })),
  entry("core.user.spoken", "코어 생성 · 요청서 (통역)", "core",
    "통역 셀은 구두 담화체 지시가 추가된다.",
    S.buildCoreUserPrompt({ ...S.CORE_PROBE_BASE, direction: "ko_zh", source_modality: "spoken", is_response_act: false })),
  entry("core.user.spoken.zh_ko.response_act", "코어 생성 · 요청서 (중→한 응답 통역)", "core",
    "중국어 화자 A와 한국어 화자 B 사이의 교차 언어 인접쌍과 통역 개입을 고정한다.",
    S.buildCoreUserPrompt({ ...S.CORE_PROBE_BASE, direction: "zh_ko", source_modality: "spoken", is_response_act: true })),
  entry("core.user.response_act", "코어 생성 · 요청서 (거절·반대 등 인접쌍)", "core",
    "선행 발화(preceding_turn)를 반드시 채우게 하는 분기.",
    S.buildCoreUserPrompt({ ...S.CORE_PROBE_BASE, direction: "ko_zh", source_modality: "written", is_response_act: true })),
  entry("core.user.source_repair", "코어 생성 · 원문 분량 1회 교정", "core",
    "R29 글자 수·문장 경계가 어긋났을 때 기존 사실을 보존하며 전체 JSON을 한 번 교정한다.",
    S.buildCoreSourceRepairPrompt({
      originalUserPrompt: "PROBE_USER_PROMPT",
      previousOutput: { source_text: "PROBE_SOURCE_TEXT", focal_segments: [] },
      sourceLanguage: "zh",
      lengthHintKo: "유효 글자 30~45자",
      measuredSentenceCount: 1,
      measuredEffectiveCharCount: 999,
      effectiveCharRange: { min: 30, max: 45 },
    })),
  entry("core.user.preceding_turn_repair", "코어 생성 · 선행 발화 언어 1회 교정", "core",
    "응답 화행의 선행 발화가 target 언어가 아닐 때 명제와 역할을 보존하며 전체 JSON을 한 번 교정한다.",
    S.buildCoreOutputRepairPrompt({
      originalUserPrompt: "PROBE_USER_PROMPT",
      previousOutput: {
        source_text: "PROBE_SOURCE_TEXT",
        preceding_turn: "PROBE_PRECEDING_TURN",
        focal_segments: [],
      },
      sourceLanguage: "zh",
      lengthHintKo: "유효 글자 PROBE_MIN~PROBE_MAX자",
      effectiveCharRange: { min: 30, max: 45 },
      sourceIssue: null,
      precedingTurnIssue: {
        code: "wrong_language",
        expectedLanguage: "ko",
        message: "PROBE_PRECEDING_TURN_LANGUAGE_ERROR",
      },
    })),
  entry("core.user.bilingual_scene_repair", "코어 생성 · 이중언어 통역 장면 1회 교정", "core",
    "통역 상황문의 원발화자·학습자 통역사·청자 역할 중첩을 제거한다.",
    S.buildCoreOutputRepairPrompt({
      originalUserPrompt: "PROBE_USER_PROMPT",
      previousOutput: {
        situation_ko: "PROBE_SITUATION",
        source_text: "PROBE_SOURCE_TEXT",
        preceding_turn: null,
        focal_segments: [],
      },
      sourceLanguage: "zh",
      lengthHintKo: "유효 글자 PROBE_MIN~PROBE_MAX자",
      effectiveCharRange: { min: 30, max: 45 },
      sourceIssue: null,
      precedingTurnIssue: null,
      bilingualSceneIssue: {
        sourceLanguage: "zh",
        targetLanguage: "ko",
        missing: ["source_speaker", "target_speaker", "interpreting"],
        message: "PROBE_BILINGUAL_SCENE_ERROR",
      },
    })),
  entry("mission.system", "미션 승격 · 지시문 (번역)", "mission",
    "코어를 MPJ 4문항 + 산출 과제로 승격시킬 때의 지시문.",
    S.buildMissionSystemPrompt(PROBE_FEATURE, false, false, "ko_zh")),
  entry("mission.system.spoken", "미션 승격 · 지시문 (통역)", "mission",
    "구두 산출 미션용 분기.", S.buildMissionSystemPrompt(PROBE_FEATURE, false, true, "ko_zh")),
  entry("mission.user.retry", "미션 승격 · 실패 출력 직접 교정 요청서", "mission",
    "R5·R27 실패 시 직전 실제 문장을 함께 전달해 실패 위치만 직접 고치게 한다.",
    S.buildMissionUserPrompt({
      direction: "ko_zh",
      speech_act_ko: "PROBE_ACT",
      level_ko: "PROBE_LEVEL",
      level_policy_ko: "PROBE_LEVEL_POLICY",
      feature: PROBE_FEATURE,
      core: {
        situation_ko: "PROBE_SITUATION",
        relation_ko: "PROBE_RELATION",
        source_text_ko: "PROBE_SOURCE_TEXT",
        preceding_turn_zh: null,
        pdr: { p: "equal", d: "acquaintance", r: "mid" },
        source_modality: "spoken",
      },
      error_pattern_hints_ko: [],
      is_response_act: false,
      failure_notes: "- R5: PROBE_FAILURE_WITH_LENGTHS",
      previous_mission: {
        mpj_items: [{
          type: "multi_judge",
          candidates: [
            { text: "PROBE_FAILED_CANDIDATE", accepted_band_codes: ["PROBE_BAND_LOW"] },
          ],
        }],
        production_task: {
          reference_alternatives: [{ text: "PROBE_REFERENCE" }],
          vocabulary_hints: [],
        },
      },
    })),
  entry("core.user.learner_scene_repair", "코어 생성 · 학생용 평가 기준 노출 1회 교정", "core",
    "상황 사실은 보존하고 정중성·완화·선택권 같은 답 방향 단서만 제거한다.",
    S.buildCoreOutputRepairPrompt({
      originalUserPrompt: "PROBE_USER_PROMPT",
      previousOutput: {
        situation_ko: "PROBE_SITUATION_WITH_EVALUATION_CUE",
        source_text: "PROBE_SOURCE_TEXT",
        preceding_turn: null,
        focal_segments: [],
      },
      sourceLanguage: "zh",
      lengthHintKo: "유효 글자 PROBE_MIN~PROBE_MAX자",
      effectiveCharRange: { min: 30, max: 45 },
      sourceIssue: null,
      precedingTurnIssue: null,
      bilingualSceneIssue: null,
      learnerSceneIssue: {
        code: "evaluation_criteria",
        message: "PROBE_LEARNER_SCENE_EVALUATION_ERROR",
      },
    })),
  entry("quality.system", "검증② · AI 품질점검 지시문", "review",
    "생성과 분리된 모델이 미션을 비평한다(계약 0-n·94).",
    S.buildQualitySystemPrompt("ko_zh", "PROBE_ACT")),
  entry("core_quality.system", "코어 축 준수 비평 · 지시문", "review",
    "화행·P/D/R·사건 대응·통역 역할 분리·학생용 장면 누출을 생성 모델과 분리해 감사한다.",
    S.buildCoreQualitySystemPrompt("ko_zh")),
  entry("feedback.system", "학습자 피드백 · 지시문 (번역)", "runtime",
    "학습자 산출 1건을 의미·문법·화용 3층으로 진단(점수 없음).",
    S.buildFeedbackSystemPrompt("ko_zh", false)),
  entry("feedback.system.spoken", "학습자 피드백 · 지시문 (통역)", "runtime",
    "통역 산출용 분기.", S.buildFeedbackSystemPrompt("ko_zh", true)),
  entry("authentic.system", "실제 자료 분석 · 지시문", "authoring",
    "관리자가 넣은 실제 중국어/한국어 자료의 화용 활용 후보를 제안.",
    S.buildAuthenticSystemPrompt()),
];

const coreSurfaceHash = await S.corePromptSnapshotHash();
const snapshot = {
  generated_at: new Date().toISOString(),
  git_commit: git("git rev-parse --short HEAD", "unknown"),
  git_dirty: git("git status --porcelain -- " + EDGE, "") !== "",
  edge_source: EDGE,
  edge_source_sha256: sha(canonicalText(src)),
  core_surface_hash: coreSurfaceHash,
  generation_config: {
    model: S.PRIMARY_MODEL, model_fallback: S.FALLBACK_MODEL,
    temperature: S.CORE_TEMPERATURE, response_format: S.CORE_RESPONSE_FORMAT,
  },
  source_length_policy: {
    version: S.CORE_LENGTH_POLICY_VERSION,
    unit: "effective_chars",
    ranges: S.CORE_LENGTH_RANGES,
  },
  prompts,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `// 자동 생성 파일 — 직접 수정하지 마세요.
// 생성: npm run prompts:snapshot (build 시 자동 실행)
// 출처: ${EDGE}
//
// 이 파일은 '저장소 정본'이다. 배포본과 같은지는 core_surface_hash를
// 배포 응답 meta.prompt_snapshot_hash / DB scenarios.prompt_snapshot_hash와
// 대조해서 확인한다(관리자 화면이 자동으로 대조한다).
export type PromptSnapshotEntry = {
  key: string; label: string; group: string; note: string; sha256: string; text: string;
};
export type PromptSnapshot = {
  generated_at: string; git_commit: string; git_dirty: boolean;
  edge_source: string; edge_source_sha256: string; core_surface_hash: string;
  generation_config: { model: string; model_fallback: string | null; temperature: number; response_format: string };
  source_length_policy: { version: string; unit: "effective_chars"; ranges: Record<string, Record<string, { min: number; max: number }>> };
  prompts: PromptSnapshotEntry[];
};
export const PROMPT_SNAPSHOT: PromptSnapshot = ${JSON.stringify(snapshot, null, 2)} as const;
`, "utf8");

console.log(`prompt snapshot: ${prompts.length}종 · core_surface_hash=${coreSurfaceHash.slice(0, 12)}… · commit=${snapshot.git_commit}${snapshot.git_dirty ? " (미커밋 변경 있음)" : ""}`);
