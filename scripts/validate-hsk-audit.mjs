// HSK 3.0 lexical audit validation batch.
//
// Purpose: validate the audit device across a stratified LOCK-pretest sample.
// This is not a content-quality estimate and must not be mixed into final research metrics.
//
// Usage:
//   node scripts/validate-hsk-audit.mjs              # read-only dry run
//   node scripts/validate-hsk-audit.mjs --apply      # write only hsk_lexical_audit into 30 selected rows
//   node scripts/validate-hsk-audit.mjs --verify-report # recheck the stored 30-row report

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";
import { createClient } from "@supabase/supabase-js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const APPLY = process.argv.includes("--apply");
const VERIFY_REPORT = process.argv.includes("--verify-report");
const SOURCE_ID = "hsk30_syllabus_2025_11_effective_2026_07";
const LEVELS = ["beginner_intermediate", "intermediate", "advanced"];
const DIRECTIONS = ["ko_zh", "zh_ko"];
const MODES = ["translation", "stt_interpreting"];
const REPORT_DIR = resolve(ROOT, ".tmp", "hsk-audit-validation");
const REPORT_PATH = resolve(REPORT_DIR, "2026-08-10-stratified-30.json");

if (APPLY && existsSync(REPORT_PATH)) {
  const previousReport = JSON.parse(readFileSync(REPORT_PATH, "utf8"));
  if (previousReport.summary?.applied === true) {
    throw new Error(
      `이미 적용된 30건 보고서가 있습니다. 중복 적용을 중단합니다: ${REPORT_PATH}`,
    );
  }
}

function loadLocalEnv() {
  const envPath = resolve(ROOT, ".env.cross-vendor.local");
  if (!existsSync(envPath)) throw new Error(`환경 파일이 없습니다: ${envPath}`);
  for (const rawLine of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function need(name) {
  const value = process.env[name];
  if (!value) throw new Error(`환경변수 ${name}가 없습니다.`);
  return value;
}

function exposeHskModule() {
  const bundle = buildSync({
    stdin: {
      contents: `
        import {
          collectMissionChineseTexts,
          createHskLexicalAudit,
          extractDistinctChineseTokens,
          hskReferenceCeiling,
        } from "./supabase/functions/_shared/hskLexicalAudit.ts";
        globalThis.__HSK_VALIDATION = {
          collectMissionChineseTexts,
          createHskLexicalAudit,
          extractDistinctChineseTokens,
          hskReferenceCeiling,
        };
      `,
      resolveDir: ROOT,
      sourcefile: "hsk-validation-entry.ts",
      loader: "ts",
    },
    bundle: true,
    write: false,
    platform: "neutral",
    format: "iife",
    target: "es2022",
  }).outputFiles[0].text;
  (0, eval)(bundle);
  return globalThis.__HSK_VALIDATION;
}

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function targetForRow(row, hsk) {
  if (row.language_direction === "ko_zh") {
    const content = asRecord(row.mission_content);
    const collected = hsk.collectMissionChineseTexts(content, "ko_zh");
    return {
      field: "mission_content",
      container: content,
      scope: collected.scope,
      texts: collected.texts,
      existingAudit: asRecord(content.hsk_lexical_audit),
      embeddedHash: asRecord(content.provenance).mission_content_hash ?? null,
    };
  }
  const content = asRecord(row.core_content);
  const sourceText = typeof content.source_text === "string" ? content.source_text.trim() : "";
  return {
    field: "core_content",
    container: content,
    scope: "zh_source_core",
    texts: sourceText ? [sourceText] : [],
    existingAudit: asRecord(content.hsk_lexical_audit),
    embeddedHash: asRecord(content.generation).content_hash ?? null,
  };
}

function candidate(row, hsk) {
  const target = targetForRow(row, hsk);
  const text = target.texts.join("\n");
  return {
    ...row,
    ...target,
    text,
    tokens: hsk.extractDistinctChineseTokens(target.texts),
  };
}

function isEligible(item) {
  return LEVELS.includes(item.learner_level)
    && DIRECTIONS.includes(item.language_direction)
    && MODES.includes(item.mode)
    && item.review_status !== "approved"
    && item.mission_status !== "reviewed"
    && !item.existingAudit.status
    && item.tokens.length > 0;
}

function chooseDiverse(pool, count, used) {
  const available = pool.filter((item) => !used.has(item.scenario_id));
  const chosen = [];
  const acts = new Set();
  const domains = new Set();
  for (const item of available) {
    if (chosen.length >= count) break;
    if (acts.has(item.speech_act) && domains.has(item.domain)) continue;
    chosen.push(item);
    used.add(item.scenario_id);
    acts.add(item.speech_act);
    domains.add(item.domain);
  }
  for (const item of available) {
    if (chosen.length >= count) break;
    if (used.has(item.scenario_id)) continue;
    chosen.push(item);
    used.add(item.scenario_id);
  }
  return chosen;
}

function edgeTags(item) {
  const tags = [];
  if (/[A-Za-z][A-Za-z0-9.+-]*|\d/.test(item.text)) tags.push("latin_or_number");
  if (/(大学|学院|公司|集团|教授|老师|平台|系统|项目|北京|上海|韩国|中国)/.test(item.text)) tags.push("name_or_term");
  if (item.text.length >= 180) tags.push("long_multi_field");
  if ((item.text.match(/[，。！？；：]/g) ?? []).length >= 10) tags.push("dense_segmentation");
  if (item.tokens.some((token) => [...token].length >= 4)) tags.push("long_token");
  return tags;
}

function chooseEdgeCases(pool, count, used) {
  const available = pool
    .filter((item) => !used.has(item.scenario_id))
    .map((item) => ({ ...item, edgeTags: edgeTags(item) }))
    .sort((a, b) => b.edgeTags.length - a.edgeTags.length || b.text.length - a.text.length);
  const chosen = [];
  const covered = new Set();
  for (const item of available) {
    if (chosen.length >= count) break;
    if (item.edgeTags.length > 0 && item.edgeTags.every((tag) => covered.has(tag))) continue;
    chosen.push(item);
    used.add(item.scenario_id);
    item.edgeTags.forEach((tag) => covered.add(tag));
  }
  for (const item of available) {
    if (chosen.length >= count) break;
    if (used.has(item.scenario_id)) continue;
    chosen.push(item);
    used.add(item.scenario_id);
  }
  return chosen;
}

async function matchTokens(supabase, tokens, referenceCeiling) {
  const { data, error } = await supabase.rpc("hsk3_match_tokens", {
    p_source_id: SOURCE_ID,
    p_max_intro_level: referenceCeiling,
    p_tokens: tokens,
  });
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? data : [];
}

function reportRow(item, audit, category) {
  return {
    scenario_id: item.scenario_id,
    category,
    learner_level: item.learner_level,
    language_direction: item.language_direction,
    mode: item.mode,
    speech_act: item.speech_act,
    domain: item.domain,
    field: item.field,
    edge_tags: item.edgeTags ?? [],
    audit,
    content_hash_before: item.content_hash ?? null,
    embedded_hash_before: item.embeddedHash,
  };
}

loadLocalEnv();
const hsk = exposeHskModule();
const supabase = createClient(need("SUPABASE_URL"), need("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});

if (VERIFY_REPORT) {
  if (!existsSync(REPORT_PATH)) throw new Error(`검증 보고서가 없습니다: ${REPORT_PATH}`);
  const report = JSON.parse(readFileSync(REPORT_PATH, "utf8"));
  const ids = report.results.map((result) => result.scenario_id);
  const { data, error } = await supabase
    .from("scenarios")
    .select("scenario_id, content_format, review_status, mission_status, language_direction, core_content, mission_content")
    .in("scenario_id", ids);
  if (error) throw new Error(`보고서 행 재조회 실패: ${error.message}`);
  const summary = {
    selected: ids.length,
    fetched: data.length,
    current_review_format: data.filter((row) => row.content_format === "scenario_core_v1").length,
    legacy_or_other_format: data.filter((row) => row.content_format !== "scenario_core_v1").length,
    mission_review_loaded_complete: data.filter((row) =>
      row.content_format === "scenario_core_v1"
      && row.language_direction === "ko_zh"
      && asRecord(row.mission_content).hsk_lexical_audit?.status === "complete"
      && row.mission_status === "generated",
    ).length,
    mission_candidate_filter_visible: data.filter((row) => {
      const audit = asRecord(asRecord(row.mission_content).hsk_lexical_audit);
      return row.content_format === "scenario_core_v1"
        && row.language_direction === "ko_zh"
        && audit.status === "complete"
        && Array.isArray(audit.out_of_reference_candidates)
        && audit.out_of_reference_candidates.length > 0
        && row.mission_status === "generated";
    }).length,
    core_review_loaded_complete: data.filter((row) =>
      row.content_format === "scenario_core_v1"
      && row.language_direction === "zh_ko"
      && asRecord(row.core_content).hsk_lexical_audit?.status === "complete"
      && row.review_status === "needs_review",
    ).length,
    core_candidate_filter_visible: data.filter((row) => {
      const audit = asRecord(asRecord(row.core_content).hsk_lexical_audit);
      return row.content_format === "scenario_core_v1"
        && row.language_direction === "zh_ko"
        && audit.status === "complete"
        && Array.isArray(audit.out_of_reference_candidates)
        && audit.out_of_reference_candidates.length > 0
        && row.review_status === "needs_review";
    }).length,
  };
  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
}

const fields = [
  "scenario_id",
  "learner_level",
  "language_direction",
  "mode",
  "speech_act",
  "domain",
  "review_status",
  "mission_status",
  "content_hash",
  "core_content",
  "mission_content",
].join(",");

const [koResult, zhResult] = await Promise.all([
  supabase.from("scenarios").select(fields).eq("language_direction", "ko_zh").not("mission_content", "is", null).order("scenario_id"),
  supabase.from("scenarios").select(fields).eq("language_direction", "zh_ko").not("core_content", "is", null).order("scenario_id"),
]);
if (koResult.error) throw new Error(`한→중 mission 조회 실패: ${koResult.error.message}`);
if (zhResult.error) throw new Error(`중→한 core 조회 실패: ${zhResult.error.message}`);

const candidates = [...koResult.data, ...zhResult.data].map((row) => candidate(row, hsk)).filter(isEligible);
const used = new Set();
const selected = [];
const gaps = [];
for (const level of LEVELS) {
  for (const direction of DIRECTIONS) {
    for (const mode of MODES) {
      const cell = candidates.filter((item) => item.learner_level === level && item.language_direction === direction && item.mode === mode);
      const picks = chooseDiverse(cell, 2, used);
      if (picks.length < 2) gaps.push({ level, direction, mode, available: cell.length, selected: picks.length });
      selected.push(...picks.map((item) => ({ ...item, category: "base_cell" })));
    }
  }
}
if (gaps.some((gap) => gap.selected === 0)) {
  console.error("최소 1건도 확보하지 못한 층화 셀이 있습니다:");
  console.error(JSON.stringify(gaps, null, 2));
  process.exit(2);
}
const edgeTarget = 30 - selected.length;
const edges = chooseEdgeCases(candidates, edgeTarget, used).map((item) => ({ ...item, category: "edge_case" }));
selected.push(...edges);
if (selected.length !== 30) throw new Error(`검증 표본이 30건이 아닙니다: ${selected.length}`);

const results = [];
for (const item of selected) {
  const referenceCeiling = hsk.hskReferenceCeiling(item.learner_level);
  const audit = await hsk.createHskLexicalAudit({
    texts: item.texts,
    direction: item.language_direction,
    scope: item.scope,
    referenceCeiling,
    matchTokens: (tokens, ceiling) => matchTokens(supabase, tokens, ceiling),
  });
  const expectedScope = item.language_direction === "ko_zh" ? "zh_target_mission" : "zh_source_core";
  const expectedCoverage = Number((audit.matched_token_count / audit.distinct_token_count).toFixed(4));
  const contractPass = audit.status === "complete"
    && audit.non_blocking === true
    && audit.reference_ceiling === referenceCeiling
    && audit.direction === item.language_direction
    && audit.scope === expectedScope
    && audit.distinct_token_count === item.tokens.length
    && audit.matched_token_count <= audit.distinct_token_count
    && audit.coverage_ratio === expectedCoverage
    && audit.out_of_reference_candidates.length <= 40;
  results.push({ ...reportRow(item, audit, item.category), contract_pass: contractPass });
}

const failures = results.filter((result) => !result.contract_pass);
if (failures.length) {
  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(REPORT_PATH, JSON.stringify({ applied: false, failures, results }, null, 2));
  throw new Error(`계약 검증 실패 ${failures.length}건. DB는 변경하지 않았습니다.`);
}

if (APPLY) {
  for (const result of results) {
    const item = selected.find((candidateItem) => candidateItem.scenario_id === result.scenario_id);
    const nextContent = { ...item.container, hsk_lexical_audit: result.audit };
    const { error } = await supabase
      .from("scenarios")
      .update({ [item.field]: nextContent })
      .eq("scenario_id", item.scenario_id);
    if (error) throw new Error(`${item.scenario_id} 갱신 실패: ${error.message}`);
  }

  const ids = results.map((result) => result.scenario_id);
  const { data: verifiedRows, error: verifyError } = await supabase
    .from("scenarios")
    .select("scenario_id, content_hash, core_content, mission_content")
    .in("scenario_id", ids);
  if (verifyError) throw new Error(`갱신 후 검증 조회 실패: ${verifyError.message}`);
  const verifiedById = new Map(verifiedRows.map((row) => [row.scenario_id, row]));
  for (const result of results) {
    const item = selected.find((candidateItem) => candidateItem.scenario_id === result.scenario_id);
    const row = verifiedById.get(result.scenario_id);
    const content = asRecord(row?.[item.field]);
    const storedAudit = asRecord(content.hsk_lexical_audit);
    const storedEmbeddedHash = item.field === "mission_content"
      ? asRecord(content.provenance).mission_content_hash ?? null
      : asRecord(content.generation).content_hash ?? null;
    result.stored_status = storedAudit.status ?? null;
    result.content_hash_after = row?.content_hash ?? null;
    result.embedded_hash_after = storedEmbeddedHash;
    result.hash_unchanged = result.content_hash_before === result.content_hash_after
      && result.embedded_hash_before === result.embedded_hash_after;
    result.storage_pass = result.stored_status === "complete" && result.hash_unchanged;
  }
}

const summary = {
  purpose: "LOCK 전 HSK 감사 장치 작동 검증. 콘텐츠 품질 추정 또는 최종 연구 통계가 아님.",
  applied: APPLY,
  selected: results.length,
  base_cells: results.filter((result) => result.category === "base_cell").length,
  edge_cases: results.filter((result) => result.category === "edge_case").length,
  underfilled_cells: gaps,
  contract_pass: results.filter((result) => result.contract_pass).length,
  storage_pass: APPLY ? results.filter((result) => result.storage_pass).length : null,
  levels: Object.fromEntries(LEVELS.map((level) => [level, results.filter((result) => result.learner_level === level).length])),
  directions: Object.fromEntries(DIRECTIONS.map((direction) => [direction, results.filter((result) => result.language_direction === direction).length])),
  modes: Object.fromEntries(MODES.map((mode) => [mode, results.filter((result) => result.mode === mode).length])),
  total_distinct_tokens: results.reduce((sum, result) => sum + result.audit.distinct_token_count, 0),
  total_matched_tokens: results.reduce((sum, result) => sum + result.audit.matched_token_count, 0),
  total_review_candidates: results.reduce((sum, result) => sum + result.audit.out_of_reference_candidates.length, 0),
};

mkdirSync(REPORT_DIR, { recursive: true });
writeFileSync(REPORT_PATH, JSON.stringify({ summary, results }, null, 2));
console.log(JSON.stringify(summary, null, 2));
console.log(`보고서: ${REPORT_PATH}`);
