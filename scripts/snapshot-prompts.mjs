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
const PACK_SOURCE = "src/lib/pragma/realizationPack.ts";
const PACK_OUT = resolve(ROOT, "src/lib/pragma/packReleaseManifest.generated.ts");
const MANIFEST_SCRIPT = "scripts/snapshot-prompts.mjs";
const MANIFEST_HELPER = "src/lib/pragma/packReleaseManifest.ts";

const src = readFileSync(resolve(ROOT, EDGE), "utf8");
const canonicalText = (text) => text.replace(/\r\n?/g, "\n");

// edge 소스를 그대로 실행해 빌더 함수를 얻는다(복사본이 아니라 원본이어야 의미가 있다).
globalThis.Deno = { serve: () => {}, env: { get: () => "SNAPSHOT" } };
const EXPOSE = `
;globalThis.__S = {
  buildCoreSystemPrompt, buildCoreUserPrompt, corePromptSnapshotHash, CORE_PROBE_BASE,
  buildMissionSystemPrompt, buildMissionUserPrompt, buildItemLineageSystemPrompt, buildFeedbackSystemPrompt, buildQualitySystemPrompt,
  buildCoreQualitySystemPrompt,
  buildAuthenticSystemPrompt,
  PRIMARY_MODEL, FALLBACK_MODEL, CORE_TEMPERATURE, CORE_RESPONSE_FORMAT,
  PROVIDER, MISSION_PRIMARY, MISSION_DEFAULT_TEMPERATURE, MISSION_RETRY_TEMPERATURE,
  MISSION_PROMPT_VERSION, ITEM_LINEAGE_PROMPT_VERSION, ITEM_LINEAGE_MAX_COMPLETION_TOKENS,
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
  lineage_scope: {
    coverage_status: "covered",
    realization_pack_id: "PROBE_PACK",
    realization_pack_version: "PROBE_PACK_VER",
    rules: [{ rule_id: "PROBE_RULE", label_ko: "PROBE_RULE_LABEL", evidence_ids: ["PROBE_EVIDENCE"] }],
    risks: [{ risk_id: "PROBE_RISK", description_ko: "PROBE_RISK_DESCRIPTION", evidence_ids: ["PROBE_EVIDENCE"] }],
    evidence: [{ evidence_id: "PROBE_EVIDENCE", claim_scope_ko: "PROBE_EVIDENCE_SCOPE" }],
  },
};
const probeMissionBody = (direction, sourceModality, isResponseAct) => ({
  direction,
  speech_act_ko: "PROBE_SPEECH_ACT",
  level_ko: "PROBE_LEVEL",
  level_policy_ko: "PROBE_LEVEL_POLICY",
  feature: PROBE_FEATURE,
  core: {
    situation_ko: "PROBE_SITUATION",
    relation_ko: "PROBE_RELATION",
    source_text_ko: "PROBE_SOURCE_TEXT",
    preceding_turn_zh: isResponseAct ? "PROBE_PRECEDING_TURN" : null,
    pdr: { p: "equal", d: "acquaintance", r: "mid" },
    source_modality: sourceModality,
  },
  error_pattern_hints_ko: ["PROBE_ERROR_HINT"],
  is_response_act: isResponseAct,
});

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
  entry("mission.system", "미션 승격 · 지시문 (번역)", "mission",
    "코어를 MPJ 5문항 + 산출 과제로 승격시킬 때의 지시문.",
    S.buildMissionSystemPrompt(PROBE_FEATURE, false, false, "ko_zh")),
  entry("mission.system.spoken", "미션 승격 · 지시문 (통역)", "mission",
    "구두 산출 미션용 분기.", S.buildMissionSystemPrompt(PROBE_FEATURE, false, true, "ko_zh")),
  entry("item_lineage.system", "문항 lineage · 별도 분류 지시문", "review",
    "생성된 목표어 문장을 versioned rule/risk에 연결하되 pending claim으로만 기록한다.",
    S.buildItemLineageSystemPrompt(PROBE_FEATURE.lineage_scope)),
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
  // tracked snapshot은 같은 commit에서 재생성해도 byte-identical해야 한다.
  // 벽시계가 아니라 source commit 시각을 사용한다.
  generated_at: git("git show -s --format=%cI HEAD", new Date(0).toISOString()),
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

// Realization Pack은 DB manifest에 사람이 임의 해시를 입력하지 않도록 별도 release
// draft를 생성한다. 해시 표면·정규화 규약은 브라우저 검증 코드와 같은 모듈을 실행한다.
const packSrc = readFileSync(resolve(ROOT, PACK_SOURCE), "utf8");
const packExecutable = buildSync({
  stdin: {
    contents: `
      import { KO_ZH_CORE_REALIZATION_PACK } from "../src/lib/pragma/realizationPack.ts";
      import {
        PACK_CANONICALIZATION_VERSION,
        buildPackArtifactSurface,
        buildPackEvidenceSurface,
        canonicalJson,
      } from "../src/lib/pragma/packReleaseManifest.ts";
      globalThis.__PRAGMA_PACK_HELPERS = {
        pack: KO_ZH_CORE_REALIZATION_PACK,
        PACK_CANONICALIZATION_VERSION,
        buildPackArtifactSurface,
        buildPackEvidenceSurface,
        canonicalJson,
      };
    `,
    resolveDir: dirname(resolve(ROOT, MANIFEST_SCRIPT)),
    sourcefile: "pack-manifest-entry.ts",
    loader: "ts",
  },
  absWorkingDir: ROOT,
  bundle: true,
  write: false,
  platform: "neutral",
  format: "iife",
  target: "es2022",
}).outputFiles[0].text;
(0, eval)(packExecutable);
const H = globalThis.__PRAGMA_PACK_HELPERS;
const pack = H.pack;

// pack 자체는 별도 artifact/evidence hash가 포착한다. 이 표면은 pack을 실제로
// 소비하는 mission·item-lineage prompt template와 실행 계약만 고정한다.
const missionSystemVariants = [];
const missionUserVariants = [];
for (const direction of ["ko_zh", "zh_ko"]) {
  for (const isResponseAct of [false, true]) {
    for (const isSpoken of [false, true]) {
      const variant = `${direction}:${isResponseAct ? "response" : "initiative"}:${isSpoken ? "spoken" : "written"}`;
      missionSystemVariants.push({
        variant,
        prompt: S.buildMissionSystemPrompt(PROBE_FEATURE, isResponseAct, isSpoken, direction),
      });
      missionUserVariants.push({
        variant,
        prompt: S.buildMissionUserPrompt(probeMissionBody(direction, isSpoken ? "spoken" : "written", isResponseAct)),
      });
    }
  }
}
const packPromptSurface = {
  canonicalization_version: H.PACK_CANONICALIZATION_VERSION,
  surface_schema_version: "pragma_pack_prompt_surface_v1",
  mission: {
    provider: S.PROVIDER,
    primary_model: S.MISSION_PRIMARY,
    fallback_model: S.PRIMARY_MODEL,
    prompt_version: S.MISSION_PROMPT_VERSION,
    default_temperature: S.MISSION_DEFAULT_TEMPERATURE,
    retry_temperature: S.MISSION_RETRY_TEMPERATURE,
    response_format: { type: "json_object" },
    system_variants: missionSystemVariants,
    user_variants: missionUserVariants,
  },
  item_lineage: {
    provider: S.PROVIDER,
    primary_model: S.PRIMARY_MODEL,
    fallback_model: S.FALLBACK_MODEL,
    prompt_version: S.ITEM_LINEAGE_PROMPT_VERSION,
    temperature: 0,
    response_format: { type: "json_object" },
    max_completion_tokens: S.ITEM_LINEAGE_MAX_COMPLETION_TOKENS,
    system_prompt: S.buildItemLineageSystemPrompt(PROBE_FEATURE.lineage_scope),
    user_contract: {
      fields: ["batch_index", "expected_claim_count", "targets", "previous_issues"],
      target_batch_size: 5,
      maximum_attempts: 3,
    },
  },
};
const packPromptSurfaceHash = sha(H.canonicalJson(packPromptSurface));
snapshot.pack_prompt_surface_hash = packPromptSurfaceHash;
const packTrackedDirty = git(
  `git status --porcelain -- "${PACK_SOURCE}" "${EDGE}" "${MANIFEST_SCRIPT}" "${MANIFEST_HELPER}"`,
  "",
) !== "";
const packManifest = {
  schema_version: "pragma_pack_release_manifest_draft_v1",
  canonicalization_version: H.PACK_CANONICALIZATION_VERSION,
  pack_id: pack.pack_id,
  pack_version: pack.version,
  scope_speech_acts: pack.scope.speech_acts,
  artifact_hash: sha(H.canonicalJson(H.buildPackArtifactSurface(pack))),
  prompt_snapshot_hash: packPromptSurfaceHash,
  evidence_snapshot_hash: sha(H.canonicalJson(H.buildPackEvidenceSurface(pack))),
  source_commit_ref: git("git rev-parse HEAD", "unknown"),
  git_dirty: packTrackedDirty,
  source_paths: [PACK_SOURCE, EDGE, MANIFEST_SCRIPT, MANIFEST_HELPER],
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
  edge_source: string; edge_source_sha256: string; core_surface_hash: string; pack_prompt_surface_hash: string;
  generation_config: { model: string; model_fallback: string; temperature: number; response_format: string };
  prompts: PromptSnapshotEntry[];
};
export const PROMPT_SNAPSHOT: PromptSnapshot = ${JSON.stringify(snapshot, null, 2)} as const;
`, "utf8");

writeFileSync(PACK_OUT, `// 자동 생성 파일 — 직접 수정하지 마세요.
// 생성: npm run prompts:snapshot (build 시 자동 실행)
// 정본: ${PACK_SOURCE} + ${EDGE}
export type PackReleaseManifestDraft = {
  schema_version: "pragma_pack_release_manifest_draft_v1";
  canonicalization_version: "pragma_canonical_json_v1";
  pack_id: string;
  pack_version: string;
  scope_speech_acts: string[];
  artifact_hash: string;
  prompt_snapshot_hash: string;
  evidence_snapshot_hash: string;
  source_commit_ref: string;
  git_dirty: boolean;
  source_paths: string[];
};
export const PACK_RELEASE_MANIFEST_DRAFT: PackReleaseManifestDraft = ${JSON.stringify(packManifest, null, 2)} as const;
`, "utf8");

console.log(`prompt snapshot: ${prompts.length}종 · core_surface_hash=${coreSurfaceHash.slice(0, 12)}… · pack=${pack.pack_id}@${pack.version} ${packManifest.artifact_hash.slice(0, 12)}… · commit=${snapshot.git_commit}${snapshot.git_dirty || packTrackedDirty ? " (미커밋 변경 있음)" : ""}`);
