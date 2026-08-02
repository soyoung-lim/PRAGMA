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
  buildCoreSourceRepairPrompt,
  buildMissionSystemPrompt, buildFeedbackSystemPrompt, buildQualitySystemPrompt,
  buildCoreQualitySystemPrompt,
  buildAuthenticSystemPrompt,
  PRIMARY_MODEL, FALLBACK_MODEL, CORE_TEMPERATURE, CORE_RESPONSE_FORMAT,
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
    })),
  entry("core.user.spoken", "코어 생성 · 요청서 (통역)", "core",
    "통역 셀은 구두 담화체 지시가 추가된다.",
    S.buildCoreUserPrompt({ ...S.CORE_PROBE_BASE, direction: "ko_zh", source_modality: "spoken", is_response_act: false })),
  entry("core.user.response_act", "코어 생성 · 요청서 (거절·반대 등 인접쌍)", "core",
    "선행 발화(preceding_turn)를 반드시 채우게 하는 분기.",
    S.buildCoreUserPrompt({ ...S.CORE_PROBE_BASE, direction: "ko_zh", source_modality: "written", is_response_act: true })),
  entry("core.user.sentence_repair", "코어 생성 · 문장 경계 1회 교정", "core",
    "R29 문장 수만 실패했을 때 기존 사실을 보존하며 전체 JSON을 한 번 교정한다.",
    S.buildCoreSourceRepairPrompt({
      originalUserPrompt: "PROBE_USER_PROMPT",
      previousOutput: { source_text: "PROBE_SOURCE_TEXT", focal_segments: [] },
      sourceLanguage: "zh",
      lengthHintKo: "PROBE_LEN",
      measuredSentenceCount: 1,
    })),
  entry("mission.system", "미션 승격 · 지시문 (번역)", "mission",
    "코어를 MPJ 4문항 + 산출 과제로 승격시킬 때의 지시문.",
    S.buildMissionSystemPrompt(PROBE_FEATURE, false, false, "ko_zh")),
  entry("mission.system.spoken", "미션 승격 · 지시문 (통역)", "mission",
    "구두 산출 미션용 분기.", S.buildMissionSystemPrompt(PROBE_FEATURE, false, true, "ko_zh")),
  entry("quality.system", "검증② · AI 품질점검 지시문", "review",
    "생성과 분리된 모델이 미션을 비평한다(계약 0-n·94).",
    S.buildQualitySystemPrompt("ko_zh", "PROBE_ACT")),
  entry("core_quality.system", "코어 축 준수 비평 · 지시문", "review",
    "화행·P/D/R·도메인·산업·모드·역할권한·topic·인접쌍을 생성 모델과 분리해 감사한다.",
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
  generation_config: { model: string; model_fallback: string; temperature: number; response_format: string };
  prompts: PromptSnapshotEntry[];
};
export const PROMPT_SNAPSHOT: PromptSnapshot = ${JSON.stringify(snapshot, null, 2)} as const;
`, "utf8");

console.log(`prompt snapshot: ${prompts.length}종 · core_surface_hash=${coreSurfaceHash.slice(0, 12)}… · commit=${snapshot.git_commit}${snapshot.git_dirty ? " (미커밋 변경 있음)" : ""}`);
