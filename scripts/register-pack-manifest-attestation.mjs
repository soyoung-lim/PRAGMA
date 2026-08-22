// Deployment/CI-only bridge from the code-derived manifest to the database trust gate.
// This script deliberately requires a service-role key and refuses dirty or stale drafts.
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GENERATED = resolve(ROOT, "src/lib/pragma/packReleaseManifest.generated.ts");
const source = readFileSync(GENERATED, "utf8");
const match = source.match(/PACK_RELEASE_MANIFEST_DRAFT:[^=]+=[\s\S]*?({[\s\S]*}) as const;\s*$/);
if (!match) throw new Error("Generated pack manifest draft could not be parsed. Run npm run prompts:snapshot first.");
const draft = JSON.parse(match[1]);

if (draft.git_dirty) throw new Error("Refusing attestation: manifest source was dirty when the draft was generated.");
const head = execSync("git rev-parse HEAD", { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
if (draft.source_commit_ref !== head) throw new Error("Refusing attestation: generated manifest does not match the current commit.");

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const buildRunRef = process.env.CI_RUN_REF ?? process.env.GITHUB_RUN_ID;
if (!supabaseUrl || !serviceRoleKey || !buildRunRef) {
  throw new Error("SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and CI_RUN_REF (or GITHUB_RUN_ID) are required.");
}

const payload = {
  schema_version: "pragma_pack_manifest_attestation_v1",
  canonicalization_version: draft.canonicalization_version,
  pack_id: draft.pack_id,
  pack_version: draft.pack_version,
  scope_speech_acts: draft.scope_speech_acts,
  expansion_authorization_id: process.env.PRAGMA_EXPANSION_AUTHORIZATION_ID || null,
  artifact_hash: draft.artifact_hash,
  prompt_snapshot_hash: draft.prompt_snapshot_hash,
  evidence_snapshot_hash: draft.evidence_snapshot_hash,
  source_commit_ref: draft.source_commit_ref,
  build_run_ref: String(buildRunRef),
  attestation_method: "ci_service_role",
};
const conflictColumns = [
  "pack_id", "pack_version", "artifact_hash", "prompt_snapshot_hash",
  "evidence_snapshot_hash", "source_commit_ref",
].join(",");
const endpoint = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/pragma_pack_manifest_attestations?on_conflict=${encodeURIComponent(conflictColumns)}`;
const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    apikey: serviceRoleKey,
    authorization: `Bearer ${serviceRoleKey}`,
    "content-type": "application/json",
    prefer: "resolution=ignore-duplicates,return=representation",
  },
  body: JSON.stringify(payload),
});
if (!response.ok) throw new Error(`Manifest attestation failed (${response.status}): ${(await response.text()).slice(0, 500)}`);
const rows = await response.json();
console.log(`pack manifest attested: ${draft.pack_id}@${draft.pack_version} · ${rows[0]?.id ?? "already registered"}`);
