// 교차 벤더 검토 배치 — 생성계약 §5.4 (2026-08-07 확정)
//
// 무엇을 하는가:
//   이미 저장된 코어 행을 읽어, 같은 15축·같은 프롬프트로 **다른 벤더의 모델**이
//   독립 판정하게 한다. 목적은 검증이 아니라 결함 탐지다 — 단일 벤더 구조에서는
//   원리적으로 얻을 수 없는 독립 편향 프로파일을 하나 더 대는 것뿐이다.
//
// 왜 프롬프트를 손으로 옮겨 적지 않는가:
//   snapshot-prompts.mjs와 같은 이유다. 복사본은 코드가 바뀌는 순간 조용히 거짓이 된다.
//   여기서는 배포되는 edge 소스를 그대로 실행해 빌더 함수를 얻는다. 두 벤더가 받는
//   system/user 문자열은 **바이트 단위로 동일**하며, 그 해시를 결과에 기록한다.
//
// 무엇을 하지 않는가 (계약 §5.4):
//   - DB에 쓰지 않는다. 읽기 전용이다. 상태(generated/reviewed)를 바꾸지 않는다.
//   - 학습자 런타임에 호출을 늘리지 않는다. 관리자·연구자 측 오프라인 배치다.
//   - 두 판정이 갈려도 자동 조정하지 않는다. 불일치 목록을 사람에게 넘긴다.
//
// 실행:
//   node scripts/cross-vendor-review.mjs --run <generation_run_id> [옵션]
//
// 필요한 환경변수:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (코어 행 읽기 — 읽기만 한다)
//   ANTHROPIC_API_KEY                          (교차 벤더 쪽)
//   OPENAI_API_KEY                             (기준선 쪽. --no-baseline이면 불필요)

import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EDGE = "supabase/functions/generate-scenario/index.ts";

// ── 인자 ────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const arg = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : fallback;
};
const flag = (name) => argv.includes(`--${name}`);

const OPTS = {
  runId: arg("run"),
  limit: Number(arg("limit", "0")) || 0,
  concurrency: Math.max(1, Math.min(Number(arg("concurrency", "3")) || 3, 8)),
  model: arg("model", "claude-opus-5"),
  effort: arg("effort", null), // 미지정 = API 기본값(high)
  outDir: arg("out", "cross-vendor-review-out"),
  baseline: !flag("no-baseline"),
  dryRun: flag("dry-run"),
  resume: flag("resume"),
};

if (!OPTS.runId) {
  console.error(`
교차 벤더 검토 배치 (생성계약 §5.4)

  node scripts/cross-vendor-review.mjs --run <generation_run_id> [옵션]

옵션:
  --run <id>          대상 생성 run ID (필수). 동결 연구 세트의 run을 지정한다.
  --limit <n>         앞에서 n건만 (기본 0 = 전수)
  --concurrency <n>   동시 호출 수 (기본 3, 최대 8)
  --model <id>        교차 벤더 모델 (기본 claude-opus-5)
  --effort <level>    low|medium|high|xhigh|max (미지정 시 API 기본값)
  --out <dir>         결과 폴더 (기본 cross-vendor-review-out)
  --no-baseline       OpenAI 기준선 재호출 생략 (교차 벤더 판정만 수집)
  --resume            기존 results.jsonl에 있는 행은 건너뛴다
  --dry-run           행 조회와 프롬프트 조립까지만. 모델 호출 안 함.
`);
  process.exit(1);
}

// ── edge 소스에서 프롬프트 빌더를 그대로 꺼낸다 ─────────────────────────
const edgeSrc = readFileSync(resolve(ROOT, EDGE), "utf8");
globalThis.Deno = { serve: () => {}, env: { get: () => "CROSS_VENDOR_REVIEW" } };
const EXPOSE = `
;globalThis.__CV = {
  buildCoreQualitySystemPrompt, buildCoreQualityUserPrompt,
  CRITIC_PRIMARY_MODEL, CURRENT_CORE_QUALITY_PROMPT_VERSION,
};`;
const edgeBundle = buildSync({
  stdin: {
    contents: edgeSrc + EXPOSE,
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
(0, eval)(edgeBundle);
const EDGE_EXPORTS = globalThis.__CV;

// 토픽 카탈로그(seed 복원용)와 enum 라벨도 앱 소스에서 그대로 가져온다.
const appBundle = buildSync({
  stdin: {
    contents: `
      import { getScenarioTopic } from "./src/lib/pragma/scenarioTopics.ts";
      import { SPEECH_ACT_UI, DOMAIN, LEVEL } from "./src/lib/pragma/enums.ts";
      globalThis.__APP = { getScenarioTopic, SPEECH_ACT_UI, DOMAIN, LEVEL };
    `,
    resolveDir: ROOT,
    sourcefile: "cv-app-entry.ts",
    loader: "ts",
  },
  bundle: true,
  write: false,
  platform: "neutral",
  format: "iife",
  target: "es2022",
}).outputFiles[0].text;
(0, eval)(appBundle);
const APP = globalThis.__APP;

const sha = (s) => createHash("sha256").update(s, "utf8").digest("hex");
const git = (cmd, fallback) => {
  try {
    return execSync(cmd, { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return fallback;
  }
};

// ── 15축: 앱 정의를 그대로 쓴다(축이 다르면 두 판정을 비교할 수 없다) ────
const AXIS_CODES = [
  "speech_act", "power", "distance", "burden",
  "domain", "industry", "mode", "context_spec", "referents",
  "decision_authority", "topic_seed", "adjacency", "participant_roles",
  "scene_source_alignment", "learner_scene",
];
const RESPONSE_ACTS = new Set(["refusal", "opposition"]);
const VERDICTS = ["pass", "warning", "fail"];

const AXIS_OBJECT = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: VERDICTS },
    reason_ko: { type: "string" },
  },
  required: ["verdict", "reason_ko"],
  additionalProperties: false,
};
const REVIEW_SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: VERDICTS },
    summary_ko: { type: "string" },
    axes: {
      type: "object",
      properties: Object.fromEntries(AXIS_CODES.map((c) => [c, AXIS_OBJECT])),
      required: [...AXIS_CODES],
      additionalProperties: false,
    },
  },
  required: ["verdict", "summary_ko", "axes"],
  additionalProperties: false,
};

// edge와 동일한 정규화 — 누락 축은 warning으로 채우고, 축 판정이 총평보다
// 나쁘면 총평을 축 쪽으로 끌어올린다(모델이 총평을 후하게 주는 경향 차단).
function normalize(parsed) {
  const rawAxes = parsed?.axes && typeof parsed.axes === "object" ? parsed.axes : {};
  const axes = Object.fromEntries(
    AXIS_CODES.map((code) => {
      const raw = rawAxes[code] && typeof rawAxes[code] === "object" ? rawAxes[code] : {};
      const verdict = VERDICTS.includes(raw.verdict) ? raw.verdict : "warning";
      const reason =
        typeof raw.reason_ko === "string" && raw.reason_ko.trim()
          ? raw.reason_ko.slice(0, 500)
          : "모델 응답에 이 축의 판정 근거가 누락되었습니다.";
      return [code, { verdict, reason_ko: reason }];
    }),
  );
  const values = Object.values(axes);
  const derived = values.some((a) => a.verdict === "fail")
    ? "fail"
    : values.some((a) => a.verdict === "warning")
      ? "warning"
      : "pass";
  const RANK = { pass: 0, warning: 1, fail: 2 };
  const claimed = VERDICTS.includes(parsed?.verdict) ? parsed.verdict : "pass";
  return {
    verdict: RANK[claimed] > RANK[derived] ? claimed : derived,
    summary_ko: typeof parsed?.summary_ko === "string" ? parsed.summary_ko.slice(0, 400) : "",
    axes,
  };
}

// ── 저장된 행 → 비평 요청 본문 ──────────────────────────────────────────
// pdr은 core_content.pdr(JSON 형태)를 그대로 쓴다. 없으면 추측하지 않고 건너뛴다 —
// 잘못된 축 값으로 판정을 받으면 결과 전체가 오염된다.
function bodyFromRow(row) {
  const core = row.core_content;
  if (!core || typeof core !== "object") return { skip: "core_content 없음" };
  if (!core.pdr || typeof core.pdr !== "object") return { skip: "core_content.pdr 없음" };
  const topic = row.topic_code ? APP.getScenarioTopic(row.topic_code) : undefined;
  if (!topic) return { skip: `토픽 카탈로그에 없는 topic_code: ${row.topic_code}` };
  if (!row.speech_act || !row.domain || !row.mode) return { skip: "축 필드 누락" };

  return {
    body: {
      core_content: core,
      direction: row.language_direction,
      speech_act: row.speech_act,
      speech_act_ko: APP.SPEECH_ACT_UI[row.speech_act],
      level: APP.LEVEL[row.learner_level],
      domain: row.domain,
      domain_ko: APP.DOMAIN[row.domain],
      industry: row.industry_sector,
      mode: row.mode,
      pdr: { p: core.pdr.p, d: core.pdr.d, r: core.pdr.r },
      topic_code: row.topic_code,
      situation_seed_ko: topic.situationSeedKo,
      is_response_act: RESPONSE_ACTS.has(row.speech_act),
      expected_context_spec: core.context_spec ?? null,
    },
  };
}

// ── 모델 호출 ───────────────────────────────────────────────────────────
const anthropic = new Anthropic({ maxRetries: 4 });

async function callAnthropic(sys, usr) {
  const req = {
    model: OPTS.model,
    max_tokens: 16000,
    system: sys,
    messages: [{ role: "user", content: usr }],
    output_config: { format: { type: "json_schema", schema: REVIEW_SCHEMA } },
  };
  // temperature는 Claude Opus 5에서 제거된 파라미터라 보낼 수 없다(400).
  // OpenAI 쪽 0.1과 대칭을 맞출 수 없다는 뜻이며, 이 비대칭은 결과에 기록된다.
  if (OPTS.effort) req.output_config.effort = OPTS.effort;

  const res = await anthropic.messages.create(req);
  if (res.stop_reason === "refusal") {
    const err = new Error(`안전 분류기 거절 (${res.stop_details?.category ?? "미상"})`);
    err.refusal = true;
    throw err;
  }
  const text = res.content.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("텍스트 블록 없음");
  return {
    parsed: JSON.parse(text),
    usage: {
      input_tokens: res.usage?.input_tokens ?? 0,
      output_tokens: res.usage?.output_tokens ?? 0,
    },
    model: res.model,
  };
}

// 기준선: 같은 프롬프트를 같은 벤더(OpenAI)에 다시 물어 동일 행에 대한 비교축을 만든다.
// 이것은 '일치율 주장'이 아니라 불일치 목록을 계산하기 위한 기준선이다.
async function callOpenAI(sys, usr, apiKey) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: EDGE_EXPORTS.CRITIC_PRIMARY_MODEL,
      temperature: 0.1,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: usr },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "core_quality_review", strict: true, schema: REVIEW_SCHEMA },
      },
    }),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${raw.slice(0, 200)}`);
  const json = JSON.parse(raw);
  return {
    parsed: JSON.parse(json.choices[0].message.content),
    usage: {
      input_tokens: json.usage?.prompt_tokens ?? 0,
      output_tokens: json.usage?.completion_tokens ?? 0,
    },
    model: json.model,
  };
}

// ── 실행 ────────────────────────────────────────────────────────────────
const need = (name) => {
  const v = process.env[name];
  if (!v) {
    console.error(`환경변수 ${name}가 없습니다.`);
    process.exit(1);
  }
  return v;
};

const supabase = createClient(need("SUPABASE_URL"), need("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});

const outDir = resolve(ROOT, OPTS.outDir, OPTS.runId);
mkdirSync(outDir, { recursive: true });
const resultsPath = join(outDir, "results.jsonl");

console.log(`대상 run: ${OPTS.runId}`);
const { data: rows, error } = await supabase
  .from("scenarios")
  .select(
    "scenario_id, speech_act, learner_level, domain, industry_sector, mode, topic_code, " +
      "language_direction, core_content, mission_status, review_status, content_hash, " +
      "prompt_snapshot_hash, generator_model, generation_prompt_version",
  )
  .eq("generation_run_id", OPTS.runId)
  .order("scenario_id", { ascending: true });

if (error) {
  console.error("행 조회 실패:", error.message);
  process.exit(1);
}
if (!rows?.length) {
  console.error("해당 run에 행이 없습니다. run ID를 확인하세요.");
  process.exit(1);
}

const done = new Set();
if (OPTS.resume && existsSync(resultsPath)) {
  for (const line of readFileSync(resultsPath, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      done.add(JSON.parse(line).scenario_id);
    } catch {
      /* 깨진 줄은 무시하고 다시 검토한다 */
    }
  }
  console.log(`이어하기: 이미 끝난 ${done.size}건 건너뜀`);
}

let targets = rows.filter((r) => !done.has(r.scenario_id));
if (OPTS.limit) targets = targets.slice(0, OPTS.limit);

const skipped = [];
const jobs = [];
for (const row of targets) {
  const { body, skip } = bodyFromRow(row);
  if (skip) {
    skipped.push({ scenario_id: row.scenario_id, reason: skip });
    continue;
  }
  const sys = EDGE_EXPORTS.buildCoreQualitySystemPrompt(body.direction === "zh_ko" ? "zh_ko" : "ko_zh");
  const usr = EDGE_EXPORTS.buildCoreQualityUserPrompt(body);
  jobs.push({ row, sys, usr });
}

console.log(
  `전체 ${rows.length}건 · 이번 대상 ${jobs.length}건 · 제외 ${skipped.length}건` +
    (OPTS.baseline ? " · 기준선 재호출 포함" : " · 교차 벤더만"),
);
if (skipped.length) {
  for (const s of skipped.slice(0, 10)) console.log(`  제외 ${s.scenario_id}: ${s.reason}`);
  if (skipped.length > 10) console.log(`  … 외 ${skipped.length - 10}건`);
}

const startedAt = new Date().toISOString();
const manifest = {
  contract_clause: "PRAGMA_생성계약_정본.md §5.4 교차 벤더 검토",
  purpose: "결함 탐지(독립 편향 프로파일 추가). 검증 아님. 상태 변경 없음.",
  generation_run_id: OPTS.runId,
  started_at: startedAt,
  repo_commit: git("git rev-parse HEAD", "unknown"),
  repo_dirty: git("git status --porcelain", "") !== "",
  cross_vendor: { provider: "anthropic", model: OPTS.model, effort: OPTS.effort ?? "(API 기본값)" },
  baseline: OPTS.baseline
    ? { provider: "openai", model: EDGE_EXPORTS.CRITIC_PRIMARY_MODEL, temperature: 0.1 }
    : null,
  prompt_version: EDGE_EXPORTS.CURRENT_CORE_QUALITY_PROMPT_VERSION,
  axes: AXIS_CODES,
  rows_total: rows.length,
  rows_targeted: jobs.length,
  rows_skipped: skipped,
  known_asymmetries: [
    "temperature: OpenAI 0.1 고정 / Anthropic은 해당 파라미터를 받지 않아 미지정. 완전 대칭이 아니다.",
    "구조화 출력 강제 방식이 벤더마다 다르다(OpenAI strict json_schema / Anthropic output_config.format). system·user 문자열 자체는 동일하다.",
    OPTS.baseline
      ? "기준선은 저장된 판정이 아니라 같은 프롬프트로 재호출한 값이다."
      : "기준선 재호출을 생략했다 — 불일치 계산은 별도 기준선이 있어야 가능하다.",
  ],
};

if (OPTS.dryRun) {
  const sample = jobs[0];
  console.log("\n--- dry-run: 첫 행 프롬프트 지문 ---");
  console.log(`scenario_id : ${sample.row.scenario_id}`);
  console.log(`system sha  : ${sha(sample.sys).slice(0, 16)}  (${sample.sys.length}자)`);
  console.log(`user sha    : ${sha(sample.usr).slice(0, 16)}  (${sample.usr.length}자)`);
  console.log("\n모델 호출 없이 종료합니다.");
  writeFileSync(join(outDir, "manifest.dry-run.json"), JSON.stringify(manifest, null, 2), "utf8");
  process.exit(0);
}

const openaiKey = OPTS.baseline ? need("OPENAI_API_KEY") : null;
need("ANTHROPIC_API_KEY");

const totals = { ok: 0, failed: 0, cross_in: 0, cross_out: 0, base_in: 0, base_out: 0 };
let cursor = 0;

async function worker() {
  for (;;) {
    const i = cursor++;
    if (i >= jobs.length) return;
    const { row, sys, usr } = jobs[i];
    const record = {
      scenario_id: row.scenario_id,
      generation_run_id: OPTS.runId,
      content_hash: row.content_hash,
      prompt_snapshot_hash: row.prompt_snapshot_hash,
      mission_status: row.mission_status,
      review_status: row.review_status,
      prompt_sha256: { system: sha(sys), user: sha(usr) },
      prompt_version: EDGE_EXPORTS.CURRENT_CORE_QUALITY_PROMPT_VERSION,
      checked_at: new Date().toISOString(),
    };
    try {
      const cross = await callAnthropic(sys, usr);
      record.cross_vendor = {
        provider: "anthropic",
        model: cross.model,
        ...normalize(cross.parsed),
      };
      totals.cross_in += cross.usage.input_tokens;
      totals.cross_out += cross.usage.output_tokens;

      if (OPTS.baseline) {
        const base = await callOpenAI(sys, usr, openaiKey);
        record.baseline = {
          provider: "openai",
          model: base.model,
          temperature: 0.1,
          ...normalize(base.parsed),
        };
        totals.base_in += base.usage.input_tokens;
        totals.base_out += base.usage.output_tokens;

        record.disagreements = AXIS_CODES.filter(
          (c) => record.cross_vendor.axes[c].verdict !== record.baseline.axes[c].verdict,
        ).map((c) => ({
          axis: c,
          baseline: record.baseline.axes[c].verdict,
          cross_vendor: record.cross_vendor.axes[c].verdict,
          baseline_reason: record.baseline.axes[c].reason_ko,
          cross_vendor_reason: record.cross_vendor.axes[c].reason_ko,
          human_verdict: null, // 사람이 채운다 — 자동 조정하지 않는다(계약 §5.4)
        }));
      }
      totals.ok += 1;
    } catch (e) {
      record.error = e.message;
      if (e.refusal) record.error_kind = "refusal";
      totals.failed += 1;
    }
    appendFileSync(resultsPath, JSON.stringify(record) + "\n", "utf8");
    const n = totals.ok + totals.failed;
    if (n % 10 === 0 || n === jobs.length) {
      console.log(`  ${n}/${jobs.length}  (성공 ${totals.ok} · 실패 ${totals.failed})`);
    }
  }
}

console.log(`\n검토 시작 — 동시 ${OPTS.concurrency}`);
await Promise.all(Array.from({ length: OPTS.concurrency }, () => worker()));

// ── 요약 ────────────────────────────────────────────────────────────────
const records = readFileSync(resultsPath, "utf8")
  .split("\n")
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l));

const withBoth = records.filter((r) => r.cross_vendor && r.baseline);
const axisDisagreement = Object.fromEntries(AXIS_CODES.map((c) => [c, 0]));
let rowsWithAnyDisagreement = 0;
for (const r of withBoth) {
  if (r.disagreements?.length) rowsWithAnyDisagreement += 1;
  for (const d of r.disagreements ?? []) axisDisagreement[d.axis] += 1;
}

manifest.finished_at = new Date().toISOString();
manifest.totals = {
  reviewed: records.length,
  ok: records.filter((r) => !r.error).length,
  failed: records.filter((r) => r.error).length,
  rows_with_disagreement: rowsWithAnyDisagreement,
  axis_disagreement: axisDisagreement,
  token_usage: totals,
};
writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

const pct = (n, d) => (d ? ((n / d) * 100).toFixed(1) : "0.0");
const summary = `# 교차 벤더 검토 결과 — ${OPTS.runId}

> 생성계약 §5.4에 따른 결함 탐지 절차다. **검증이 아니다.**
> 두 판정의 일치는 내용 타당성의 증거와 유사 편향 공유를 구분하지 못하므로,
> 일치율을 품질의 증거로 해석하지 않는다. 이 절의 분석 단위는 **불일치**이며,
> 불일치 항목이 사람 판정으로 어떻게 귀결됐는지가 보고 대상이다.

- 대상 run: \`${OPTS.runId}\` (전체 ${manifest.rows_total}건 중 검토 ${records.length}건, 제외 ${skipped.length}건)
- 교차 벤더: ${manifest.cross_vendor.provider} \`${manifest.cross_vendor.model}\` (effort ${manifest.cross_vendor.effort})
- 기준선: ${OPTS.baseline ? `${manifest.baseline.provider} \`${manifest.baseline.model}\` (temperature 0.1)` : "생략"}
- 프롬프트 판본: \`${manifest.prompt_version}\` · 저장소 커밋 \`${manifest.repo_commit.slice(0, 7)}\`${manifest.repo_dirty ? " (미커밋 변경 있음)" : ""}
- 실행: ${manifest.started_at} → ${manifest.finished_at}
- 성공 ${manifest.totals.ok} · 실패 ${manifest.totals.failed}

## 불일치 요약

- 축이 하나라도 갈린 행: **${rowsWithAnyDisagreement} / ${withBoth.length}건** (${pct(rowsWithAnyDisagreement, withBoth.length)}%)

| 축 | 불일치 건수 | 비율 |
|---|---:|---:|
${AXIS_CODES.map((c) => `| \`${c}\` | ${axisDisagreement[c]} | ${pct(axisDisagreement[c], withBoth.length)}% |`).join("\n")}

## 다음 단계 (사람 몫)

\`results.jsonl\`의 각 \`disagreements[].human_verdict\`를 채운다. 값은 셋 중 하나다.

- \`defect\` — 결함이 실재한다(교차 벤더가 옳았다)
- \`baseline_correct\` — 기존 검사가 옳았다
- \`undecided\` — 판단 유보

**자동 조정하지 않는다.** 다수결·평균·자동 채택을 두지 않으며, 이 검토는
\`generated\`를 \`reviewed\`로 올리지도 내리지도 않는다(계약 §5.4·§7.2).

## 알려진 비대칭

${manifest.known_asymmetries.map((s) => `- ${s}`).join("\n")}

## 토큰 사용량

| 구분 | 입력 | 출력 |
|---|---:|---:|
| 교차 벤더 | ${totals.cross_in.toLocaleString()} | ${totals.cross_out.toLocaleString()} |
| 기준선 | ${totals.base_in.toLocaleString()} | ${totals.base_out.toLocaleString()} |
`;
writeFileSync(join(outDir, "SUMMARY.md"), summary, "utf8");

console.log(`\n완료. 성공 ${manifest.totals.ok} · 실패 ${manifest.totals.failed}`);
if (withBoth.length) {
  console.log(`축이 갈린 행: ${rowsWithAnyDisagreement}/${withBoth.length} (${pct(rowsWithAnyDisagreement, withBoth.length)}%)`);
}
console.log(`결과: ${resultsPath}`);
console.log(`요약: ${join(outDir, "SUMMARY.md")}`);
