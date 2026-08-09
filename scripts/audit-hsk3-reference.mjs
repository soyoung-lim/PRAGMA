import fs from "node:fs/promises";
import path from "node:path";
import {
  HSK3_TOPIC_DERIVATION_VERSION,
  HSK3_TOPIC_MAPPING_VERSION,
  boolValue,
  readCsv,
  sha256File,
} from "./lib/hsk3-reference-data.mjs";

const root = process.cwd();
const sourceVocabPath = path.join(root, "data/hsk3/source/hsk3_vocab_extracted.csv");
const sourceTopicsPath = path.join(root, "data/hsk3/source/hsk3_topics_extracted.csv");
const rawPath = path.join(root, "data/hsk3/derived/hsk3_topics_raw.csv");
const derivationPath = path.join(root, "data/hsk3/derived/hsk3_topic_derivations.csv");
const mappingPath = path.join(root, "data/hsk3/derived/pragma_hsk_topic_mappings.csv");
const manifestPath = path.join(root, "data/hsk3/source-manifest.json");

const EXPECTED = {
  vocabHash: "4B01EFEDE63CA55032AEFAFBB80C758D819915D016A7D03A13338E903C822097",
  topicsHash: "48B42B83A321C651FDF83D9BBB44CC9DF1CDE4E21B20F26A191FC18ACE6AEA1A",
  levels: new Map([
    [1, 300],
    [2, 200],
    [3, 500],
    [4, 1000],
    [5, 1600],
    [6, 1800],
    [7, 5600],
  ]),
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert((await sha256File(sourceVocabPath)) === EXPECTED.vocabHash, "Vocabulary source hash mismatch");
assert((await sha256File(sourceTopicsPath)) === EXPECTED.topicsHash, "Topic source hash mismatch");
const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
for (const item of [...manifest.extracted_datasets, ...manifest.derived_outputs]) {
  assert(typeof item.path === "string" && typeof item.sha256 === "string", `Manifest hash missing for ${item.path}`);
  const actual = await sha256File(path.join(root, item.path));
  assert(actual === item.sha256, `Manifest hash mismatch for ${item.path}`);
}

const vocab = await readCsv(sourceVocabPath);
assert(vocab.length === 11000, `Vocabulary rows ${vocab.length}; expected 11000`);
const seqs = new Set();
const senseKeys = new Set();
const levelCounts = new Map();
for (const row of vocab) {
  const seq = Number(row.seq);
  const level = Number(row.intro_level);
  assert(Number.isInteger(seq) && seq >= 1 && seq <= 11000, `Invalid vocabulary seq ${row.seq}`);
  assert(!seqs.has(seq), `Duplicate vocabulary seq ${seq}`);
  seqs.add(seq);
  const key = `${row.headword}\u0000${row.pinyin}\u0000${row.sense_no}`;
  assert(!senseKeys.has(key), `Duplicate vocabulary sense key at seq ${seq}`);
  senseKeys.add(key);
  levelCounts.set(level, (levelCounts.get(level) ?? 0) + 1);
}
for (const [level, count] of EXPECTED.levels) {
  assert(levelCounts.get(level) === count, `Level ${level} rows ${levelCounts.get(level)}; expected ${count}`);
}
assert(vocab.filter((row) => row.extra_levels !== "{}").length === 102, "extra_levels count mismatch");
assert(vocab.filter((row) => boolValue(row.is_phrase, "is_phrase")).length === 495, "phrase count mismatch");
assert(
  new Set(vocab.filter((row) => boolValue(row.is_polyphone, "is_polyphone")).map((row) => row.headword)).size === 60,
  "polyphone headword count mismatch",
);
assert(
  new Set(vocab.filter((row) => boolValue(row.is_multi_sense, "is_multi_sense")).map((row) => row.headword)).size === 99,
  "multi-sense headword count mismatch",
);
assert(vocab.filter((row) => row.source_note).length === 2, "source_note count mismatch");

const sourceTopics = await readCsv(sourceTopicsPath);
const rawTopics = await readCsv(rawPath);
const derivations = await readCsv(derivationPath);
const mappings = await readCsv(mappingPath);
assert(sourceTopics.length === 427, `Source topic rows ${sourceTopics.length}; expected 427`);
assert(rawTopics.length === 427 && derivations.length === 427 && mappings.length === 427, "Topic layer row count mismatch");

const levelsByPath = new Map();
for (const row of sourceTopics) {
  if (!levelsByPath.has(row.path)) levelsByPath.set(row.path, new Set());
  levelsByPath.get(row.path).add(row.level_int);
}

for (let index = 0; index < sourceTopics.length; index += 1) {
  const source = sourceTopics[index];
  const raw = rawTopics[index];
  const derived = derivations[index];
  const mapping = mappings[index];
  const seq = String(index + 1);
  assert(raw.topic_seq === seq && derived.topic_seq === seq && mapping.topic_seq === seq, `Topic seq mismatch at ${seq}`);
  for (const field of ["level_band", "level_int", "l1", "l2", "l3"]) {
    assert(raw[field] === source[field], `Official topic field ${field} mismatch at ${seq}`);
  }
  assert(derived.derivation_version === HSK3_TOPIC_DERIVATION_VERSION, `Derivation version mismatch at ${seq}`);
  assert(derived.l3_terms === source.l3_terms, `l3_terms mismatch at ${seq}`);
  assert(Number(derived.n_terms) === derived.l3_terms.split("|").filter(Boolean).length, `n_terms mismatch at ${seq}`);
  assert(
    boolValue(derived.has_explicit_open_marker, "has_explicit_open_marker") === source.l3.trim().endsWith("等"),
    `Open marker mismatch at ${seq}`,
  );
  assert(derived.path === `${source.l1}/${source.l2}/${source.l3}`, `Path mismatch at ${seq}`);
  const levels = [...levelsByPath.get(source.path)]
    .map((level) => (level === "7" ? "7-9" : level))
    .sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10));
  assert(derived.appears_in_levels === levels.join("|"), `appears_in_levels mismatch at ${seq}`);
  assert(Number(derived.n_levels) === levels.length, `n_levels mismatch at ${seq}`);
  assert(mapping.mapping_version === HSK3_TOPIC_MAPPING_VERSION, `Mapping version mismatch at ${seq}`);
  assert(mapping.axis_code === source.axis, `axis_code mismatch at ${seq}`);
  assert(mapping.scope_code === source.scope, `scope_code mismatch at ${seq}`);
  assert(mapping.app_domain_code === source.app_domain, `app_domain_code mismatch at ${seq}`);
  assert(mapping.has_state_administration_frame === source.state_framed, `state frame mismatch at ${seq}`);
  assert(mapping.coding_status === "legacy_imported_unverified", `coding status mismatch at ${seq}`);
  assert(mapping.selection_status === "unreviewed", `selection status mismatch at ${seq}`);
}

console.log(
  JSON.stringify(
    {
      status: "pass",
      vocabulary_rows: vocab.length,
      vocabulary_level_counts: Object.fromEntries([...levelCounts].sort(([a], [b]) => a - b)),
      topic_rows: sourceTopics.length,
      topic_layers: ["official_raw", "deterministic_derived", "researcher_coded_legacy_import"],
    },
    null,
    2,
  ),
);
