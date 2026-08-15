// Read-only/negative-path live RLS smoke for real admin, expert, and learner accounts.
// It never creates research fixtures, reviews, learner events, releases, or decisions.
// A successful CI run appends one service-attested operational verification row.
import { createClient } from "@supabase/supabase-js";

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
};
const url = required("SUPABASE_URL");
const anonKey = required("SUPABASE_ANON_KEY");
const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");
const sourceCommitRef = required("GITHUB_SHA");
const runRef = required("CI_RUN_REF");
const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

const credentials = {
  admin: { email: required("PRAGMA_ADMIN_EMAIL"), password: required("PRAGMA_ADMIN_PASSWORD") },
  expert: { email: required("PRAGMA_EXPERT_EMAIL"), password: required("PRAGMA_EXPERT_PASSWORD") },
  learner: { email: required("PRAGMA_LEARNER_EMAIL"), password: required("PRAGMA_LEARNER_PASSWORD") },
};

const makeClient = () => createClient(url, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includesAny = (message, expected) => expected.some((part) => message.toLowerCase().includes(part.toLowerCase()));

async function signIn(label, account) {
  const client = makeClient();
  const { data, error } = await client.auth.signInWithPassword(account);
  if (error || !data.user || !data.session) throw new Error(`${label} sign-in failed: ${error?.message ?? "missing session"}`);
  return { client, user: data.user };
}

async function expectRpcError(label, client, fn, args, expected) {
  const { data, error } = await client.rpc(fn, args);
  if (!error || data) throw new Error(`${label}: ${fn} unexpectedly succeeded.`);
  if (!includesAny(error.message, expected)) {
    throw new Error(`${label}: ${fn} failed at the wrong boundary: ${error.message}`);
  }
}

async function expectAttestationInsertDenied(label, client) {
  // The invalid full-commit value guarantees rollback even if table privileges regress.
  const { data, error } = await client.from("pragma_pack_manifest_attestations").insert({
    canonicalization_version: "pragma_canonical_json_v1",
    pack_id: "pragma-rls-smoke-do-not-insert",
    pack_version: "0.0.0",
    artifact_hash: "0".repeat(64),
    prompt_snapshot_hash: "1".repeat(64),
    evidence_snapshot_hash: "2".repeat(64),
    source_commit_ref: "invalid-by-design",
    build_run_ref: "rls-smoke-do-not-insert",
  }).select("id");
  if (!error || data?.length) throw new Error(`${label}: authenticated attestation INSERT unexpectedly succeeded.`);
  if (!includesAny(error.message, ["permission denied", "row-level security"])) {
    throw new Error(`${label}: attestation INSERT reached constraints instead of the privilege boundary: ${error.message}`);
  }
}

const sessions = {};
for (const [label, account] of Object.entries(credentials)) sessions[label] = await signIn(label, account);
assert(new Set(Object.values(sessions).map(({ user }) => user.id)).size === 3, "Admin, expert, and learner must be three distinct users.");

for (const [label, { client, user }] of Object.entries(sessions)) {
  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("user_id,role,approval_status,profile_completed")
    .eq("user_id", user.id)
    .single();
  if (profileError || !profile) throw new Error(`${label}: own profile is not readable: ${profileError?.message ?? "missing profile"}`);
  const expectedRole = label === "admin" ? "admin" : "learner";
  assert(profile.role === expectedRole, `${label}: expected profile role ${expectedRole}, got ${profile.role}.`);

  const { data: isAdmin, error: adminError } = await client.rpc("is_admin");
  if (adminError) throw new Error(`${label}: is_admin failed: ${adminError.message}`);
  assert(isAdmin === (label === "admin"), `${label}: is_admin boundary mismatch.`);
  await expectAttestationInsertDenied(label, client);
}

const { data: expertRegistry, error: expertRegistryError } = await sessions.expert.client
  .from("pragma_expert_registry_versions")
  .select("expert_user_id,registry_version,status,language_pairs")
  .eq("expert_user_id", sessions.expert.user.id)
  .order("registry_version", { ascending: false })
  .limit(1);
if (expertRegistryError || !expertRegistry?.length) throw new Error(`expert: active registry is required: ${expertRegistryError?.message ?? "missing registry"}`);
assert(expertRegistry[0].status === "active" && expertRegistry[0].language_pairs.includes("ko_zh"), "expert: latest registry must be active for ko_zh.");

const { data: expertAssignments, error: assignmentError } = await sessions.expert.client
  .from("mission_expert_review_assignments")
  .select("id,reviewer_user_id");
if (assignmentError) throw new Error(`expert: own assignment queue is not readable: ${assignmentError.message}`);
assert(expertAssignments.every((row) => row.reviewer_user_id === sessions.expert.user.id), "expert: RLS exposed another reviewer's assignment.");

const { data: learnerAssignments, error: learnerAssignmentError } = await sessions.learner.client
  .from("mission_expert_review_assignments")
  .select("id,reviewer_user_id");
if (learnerAssignmentError) throw new Error(`learner: assignment query failed unexpectedly: ${learnerAssignmentError.message}`);
assert(learnerAssignments.length === 0, "learner: non-expert account can see expert assignments.");

for (const label of ["expert", "learner"]) {
  await expectRpcError(label, sessions[label].client, "record_pragma_improvement_decision", {
    p_candidate_id: ZERO_UUID, p_decision: "triage", p_note_ko: "RLS smoke — 저장되면 안 됨",
  }, ["Only admins can record improvement decisions"]);
  await expectRpcError(label, sessions[label].client, "release_mission", {
    p_scenario_id: ZERO_UUID, p_reviewed_lineage_id: ZERO_UUID,
    p_resolution_id: ZERO_UUID, p_gold_regression_run_id: ZERO_UUID,
  }, ["Only admins can release missions"]);
  await expectRpcError(label, sessions[label].client, "register_pragma_expert", {
    p_expert_user_id: ZERO_UUID, p_status: "active", p_language_pairs: ["ko_zh"],
    p_expertise_areas: ["rls_smoke"], p_qualification_note: "저장되면 안 됨",
  }, ["Only admins can register experts"]);
}

await expectRpcError("admin", sessions.admin.client, "record_pragma_improvement_decision", {
  p_candidate_id: ZERO_UUID, p_decision: "triage", p_note_ko: "RLS smoke — 존재하지 않는 candidate",
}, ["Improvement candidate not found"]);
await expectRpcError("admin", sessions.admin.client, "release_mission", {
  p_scenario_id: ZERO_UUID, p_reviewed_lineage_id: ZERO_UUID,
  p_resolution_id: ZERO_UUID, p_gold_regression_run_id: ZERO_UUID,
}, ["release requires a covered reviewed lineage"]);
await expectRpcError("admin", sessions.admin.client, "register_pragma_expert", {
  p_expert_user_id: ZERO_UUID, p_status: "active", p_language_pairs: ["ko_zh"],
  p_expertise_areas: ["rls_smoke"], p_qualification_note: "존재하지 않는 사용자",
}, ["Expert must be a non-admin authenticated profile"]);
await expectRpcError("admin", sessions.admin.client, "record_pragma_realization_pack_release", {
  p_pack_id: "pragma-rls-smoke-do-not-insert", p_pack_version: "0.0.0",
  p_artifact_hash: "0".repeat(64), p_prompt_snapshot_hash: "1".repeat(64),
  p_evidence_snapshot_hash: "2".repeat(64), p_source_commit_ref: "0".repeat(40),
  p_release_note_ko: "RLS smoke — 저장되면 안 됨", p_manifest_attestation_id: ZERO_UUID,
  p_source_candidate_id: null,
}, ["Pack release must exactly match a CI/service manifest attestation"]);

const { data: beforeEvents, error: beforeError, count: beforeCount } = await sessions.learner.client
  .from("learner_mission_events")
  .select("id", { count: "exact", head: true });
if (beforeError || beforeEvents) throw new Error(`learner: event count precheck failed: ${beforeError?.message ?? "unexpected rows"}`);
await expectRpcError("learner", sessions.learner.client, "append_learner_mission_event", { p_payload: {} }, [
  "Approved research participant profile is required", "Research data consent is required",
  "Research consent version is missing or stale", "null value in column \"attempt_id\"",
]);
const { error: afterError, count: afterCount } = await sessions.learner.client
  .from("learner_mission_events")
  .select("id", { count: "exact", head: true });
if (afterError || afterCount !== beforeCount) throw new Error("learner: negative event smoke changed persisted event count.");

for (const { client } of Object.values(sessions)) await client.auth.signOut();
const result = {
  status: "pass",
  research_rows_created: 0,
  role_accounts_distinct: true,
  expert_visible_assignment_count: expertAssignments.length,
  learner_event_count_unchanged: true,
  learner_visible_event_count: beforeCount ?? 0,
};

const service = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});
const { data: verification, error: verificationError } = await service
  .from("pragma_operational_verifications")
  .insert({
    verification_type: "live_rls_role_smoke",
    contract_version: "pragma_live_rls_role_smoke_v1",
    status: "pass",
    source_commit_ref: sourceCommitRef,
    run_ref: runRef,
    result,
    result_hash: "0".repeat(64),
  })
  .select("id,result_hash,verified_at")
  .single();
if (verificationError || !verification) {
  throw new Error(`Operational verification attestation failed: ${verificationError?.message ?? "missing row"}`);
}

console.log(JSON.stringify({ ...result, operational_verification: verification }, null, 2));
