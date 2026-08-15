import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { MISSION_EVENT_TYPES } from "@/lib/mission/missionEvents";
import { POLICY_VERSION } from "@/lib/research/versions";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const LINEAGE_SQL = read("supabase/migrations/20260814205000_mission_lineage_versions.sql");
const EXPERT_SQL = read("supabase/migrations/20260814211000_expert_review_disagreement.sql");
const EVENT_SQL = read("supabase/migrations/20260814214000_learner_mission_events.sql");
const FLYWHEEL_SQL = read("supabase/migrations/20260814221000_moat_improvement_queue.sql");
const CALIBRATION_SQL = read("supabase/migrations/20260814230000_gold_calibration_reviews.sql");
const EXPERT_V2_SQL = read("supabase/migrations/20260814234000_expert_review_protocol_v2.sql");
const GOLD_EXPERT_SQL = read("supabase/migrations/20260815003000_gold_expert_review_protocol.sql");
const RELEASE_SQL = read("supabase/migrations/20260815010000_authoritative_mission_release.sql");
const OPERATIONAL_FLYWHEEL_SQL = read("supabase/migrations/20260815023000_operational_improvement_flywheel.sql");
const MANIFEST_ATTESTATION_SQL = read("supabase/migrations/20260815030000_trusted_pack_manifest_attestation.sql");
const EXPANSION_READINESS_SQL = read("supabase/migrations/20260815033000_moat_expansion_readiness.sql");
const FINAL_CORPUS_SQL = read("supabase/migrations/20260815040000_authoritative_final_corpus_generation.sql");
const FINAL_CORPUS_RELEASE_SQL = read("supabase/migrations/20260815043000_authoritative_final_corpus_release.sql");
const FINAL_MISSION_BATCH_SQL = read("supabase/migrations/20260815050000_final_corpus_mission_batch.sql");
const FINAL_MISSION_RECONCILIATION_SQL = read("supabase/migrations/20260815051000_final_corpus_mission_batch_reconciliation.sql");
const PROMOTE_TS = read("src/lib/pragma/promoteMission.ts");
const EVENTS_TS = read("src/lib/mission/missionEvents.ts");
const EXPORT_TS = read("src/lib/mission/missionEventExport.ts");

describe("moat migration/runtime contracts", () => {
  it("keeps RPC names wired and every PL/pgSQL body delimiter paired", () => {
    expect(PROMOTE_TS).toContain('rpc("save_generated_mission"');
    expect(PROMOTE_TS).toContain('rpc("review_mission"');
    expect(EVENTS_TS).toContain('rpc("append_learner_mission_event"');
    expect(EXPORT_TS).toContain('rpc("export_learner_mission_events"');
    for (const sql of [LINEAGE_SQL, EXPERT_SQL, EVENT_SQL, FLYWHEEL_SQL, CALIBRATION_SQL, EXPERT_V2_SQL, GOLD_EXPERT_SQL, RELEASE_SQL, OPERATIONAL_FLYWHEEL_SQL, MANIFEST_ATTESTATION_SQL, EXPANSION_READINESS_SQL, FINAL_CORPUS_SQL, FINAL_CORPUS_RELEASE_SQL, FINAL_MISSION_BATCH_SQL, FINAL_MISSION_RECONCILIATION_SQL]) {
      expect((sql.match(/\$\$/g) ?? []).length % 2).toBe(0);
    }
  });

  it("serializes lineage versions and stores exact prompt-instance provenance", () => {
    expect(LINEAGE_SQL).toContain("pg_advisory_xact_lock");
    expect(LINEAGE_SQL).toContain("prompt_instance_hash text");
    expect(LINEAGE_SQL).toContain("item_lineage jsonb");
    expect(LINEAGE_SQL).toContain("v_mission->'item_lineage'");
    expect(LINEAGE_SQL).toContain("stage IN ('generated', 'reviewed', 'released', 'superseded')");
    expect(LINEAGE_SQL).toMatch(/REVOKE UPDATE, DELETE ON public\.mission_lineage_versions/);
    expect(PROMOTE_TS).toContain("generation_attempt: attempt");
    expect(PROMOTE_TS).toContain("lineage_scope:");
  });

  it("requires two independent expert reviewers and preserves their rows", () => {
    expect(EXPERT_SQL).toContain("count(DISTINCT reviewer_user_id)");
    expect(EXPERT_SQL).toContain("v_distinct_reviewers < 2");
    expect(EXPERT_SQL).toContain("lineage_claim_assessments jsonb");
    expect(EXPERT_SQL).toContain("every item lineage claim must have exactly one expert assessment");
    expect(EXPERT_SQL).toContain("resolved_lineage_claims jsonb");
    expect(EXPERT_SQL).toContain("resolution must cover every item lineage claim exactly once");
    expect(EXPERT_SQL).toMatch(/REVOKE UPDATE, DELETE ON public\.mission_expert_reviews/);
  });

  it("keeps event vocabulary synchronized and enforces server-side consent plus lineage", () => {
    for (const eventType of MISSION_EVENT_TYPES) expect(EVENT_SQL).toContain(`'${eventType}'`);
    expect(EVENT_SQL).toContain("v_profile_consent_version <> p_payload->>'consent_version'");
    expect(EVENT_SQL).toContain(`p_payload->>'policy_version' <> '${POLICY_VERSION}'`);
    expect(EVENT_SQL).toContain("p.consent_data_use = true");
    expect(EVENT_SQL).toContain("p.consent_anonymous_analysis = true");
    expect(EVENT_SQL).toContain("lineage_version_id uuid REFERENCES public.mission_lineage_versions");
    expect(EVENT_SQL).not.toMatch(/raw_audio|audio_blob|audio_url/i);
  });

  it("cannot auto-apply a data signal or apply it twice without a new versioned Gold impact", () => {
    expect(FLYWHEEL_SQL).toContain("an approved decision is required before applied");
    expect(FLYWHEEL_SQL).toContain("pragma_improvement_one_applied_idx");
    expect(FLYWHEEL_SQL).toContain("cardinality(resulting_gold_case_ids) > 0");
    expect(FLYWHEEL_SQL).toContain("applied decision must reference a new realization pack version");
  });

  it("keeps Seed Gold reviews and their resolutions separate and append-only", () => {
    expect(CALIBRATION_SQL).toContain("CREATE TABLE public.pragma_gold_calibration_reviews");
    expect(CALIBRATION_SQL).toContain("CREATE TABLE public.pragma_gold_calibration_resolutions");
    expect(CALIBRATION_SQL).toContain("case_snapshot jsonb NOT NULL");
    expect(CALIBRATION_SQL).toContain("case_content_hash text NOT NULL");
    expect(CALIBRATION_SQL).toContain("NEW.case_content_hash := encode(");
    expect(CALIBRATION_SQL).toContain("candidate assessments require complete A/B/C band, semantic, and rationale judgments");
    expect(CALIBRATION_SQL).toContain("approve requires all context gates, semantic fidelity, and seed bands to agree");
    expect(CALIBRATION_SQL).toContain("resolution identity must match its source review");
    expect(CALIBRATION_SQL).toContain("resolution status must preserve the researcher review verdict");
    expect(CALIBRATION_SQL).toMatch(/REVOKE UPDATE, DELETE ON public\.pragma_gold_calibration_reviews/);
    expect(CALIBRATION_SQL).toMatch(/REVOKE UPDATE, DELETE ON public\.pragma_gold_calibration_resolutions/);
  });

  it("operationalizes blind expert eligibility, same-round completeness, and honest resolution", () => {
    expect(EXPERT_V2_SQL).toContain("CREATE TABLE public.pragma_expert_registry_versions");
    expect(EXPERT_V2_SQL).toContain("administrators cannot serve as blind expert reviewers");
    expect(EXPERT_V2_SQL).toContain("reviewed_independently");
    expect(EXPERT_V2_SQL).toContain("every item lineage claim must have exactly one candidate band assessment");
    expect(EXPERT_V2_SQL).toContain("resolution requires every same-round blind assignment and at least two independent reviewers");
    expect(EXPERT_V2_SQL).toContain("unanimous status requires actually identical, non-uncertain reviews");
    expect(EXPERT_V2_SQL).toContain("resolution revisions must form a contiguous same-round chain");
    expect(EXPERT_V2_SQL).toContain("only included reviewers may sign a discussion resolution");
    expect(EXPERT_V2_SQL).toMatch(/REVOKE INSERT ON public\.mission_expert_review_assignments/);
    expect(EXPERT_V2_SQL).toMatch(/REVOKE INSERT ON public\.mission_review_resolutions/);
  });

  it("keeps Gold labels blind until a two-expert append-only resolution", () => {
    expect(GOLD_EXPERT_SQL).toContain("make_gold_expert_blind_snapshot");
    expect(GOLD_EXPERT_SQL).not.toMatch(/blind_case_snapshot[^\n]*expected_band_code/);
    expect(GOLD_EXPERT_SQL).toContain("administrators cannot serve as blind Gold expert reviewers");
    expect(GOLD_EXPERT_SQL).toContain("Gold resolution requires every same-round blind assignment and two distinct experts");
    expect(GOLD_EXPERT_SQL).toContain("unanimous Gold resolution requires actually identical expert judgments");
    expect(GOLD_EXPERT_SQL).toContain("only included Gold reviewers may sign a discussion resolution");
    expect(GOLD_EXPERT_SQL).toMatch(/REVOKE INSERT ON public\.pragma_gold_expert_review_assignments/);
    expect(GOLD_EXPERT_SQL).toMatch(/REVOKE INSERT ON public\.pragma_gold_expert_resolutions/);
  });

  it("requires expert-approved Gold regression and authoritative release for covered missions", () => {
    expect(RELEASE_SQL).toContain("expert release regression requires at least 30 distinct Gold resolutions");
    expect(RELEASE_SQL).toContain("minimum_band_accuracy', 0.90");
    expect(RELEASE_SQL).toContain("minimum_semantic_accuracy', 0.95");
    expect(RELEASE_SQL).toContain("CREATE OR REPLACE FUNCTION public.release_mission");
    expect(RELEASE_SQL).toContain("released mission cannot contain uncertain, revised, rejected, or unattributed claims");
    expect(RELEASE_SQL).toContain("release_gate_mode = 'legacy_reviewed' AND mission_status = 'reviewed'");
    expect(RELEASE_SQL).toContain("release_gate_mode = 'expert_v1' AND mission_status = 'released'");
    expect(RELEASE_SQL).toContain("covered learner events require the exact released lineage");
    expect(RELEASE_SQL).toMatch(/REVOKE INSERT, UPDATE, DELETE ON public\.pragma_gold_regression_runs/);
  });

  it("materializes real evidence and closes improvements only through a versioned authority bundle", () => {
    expect(OPERATIONAL_FLYWHEEL_SQL).toContain("CREATE TABLE public.pragma_improvement_candidate_sources");
    expect(OPERATIONAL_FLYWHEEL_SQL).toContain("UNIQUE (source_type, source_id, source_field)");
    expect(OPERATIONAL_FLYWHEEL_SQL).toContain("count(DISTINCT profile_id) >= p_min_distinct_participants");
    expect(OPERATIONAL_FLYWHEEL_SQL).toContain("lineage.stage = 'released'");
    expect(OPERATIONAL_FLYWHEEL_SQL).toContain("profile.research_consent_version = event.consent_version");
    expect(OPERATIONAL_FLYWHEEL_SQL).toContain("lineage_claim_disagreement_keys");
    expect(OPERATIONAL_FLYWHEEL_SQL).toContain("CREATE TABLE public.pragma_realization_pack_releases");
    expect(OPERATIONAL_FLYWHEEL_SQL).toContain("strictly increasing candidate-linked chain");
    expect(OPERATIONAL_FLYWHEEL_SQL).toContain("The latest decision must be approve before applied");
    expect(OPERATIONAL_FLYWHEEL_SQL).toContain("Every impacted Gold case must be latest expert-approved and included in the passing run");
    expect(OPERATIONAL_FLYWHEEL_SQL).toMatch(/REVOKE INSERT ON public\.pragma_improvement_candidates,[\s\S]*public\.pragma_improvement_decisions FROM authenticated, anon/);
  });

  it("accepts pack releases only through an exact CI/service manifest attestation", () => {
    expect(MANIFEST_ATTESTATION_SQL).toContain("CREATE TABLE public.pragma_pack_manifest_attestations");
    expect(MANIFEST_ATTESTATION_SQL).toContain("canonicalization_version = 'pragma_canonical_json_v1'");
    expect(MANIFEST_ATTESTATION_SQL).toContain("source_commit_ref ~ '^[0-9a-f]{40}$'");
    expect(MANIFEST_ATTESTATION_SQL).toContain("Pack release must exactly match a CI/service manifest attestation");
    expect(MANIFEST_ATTESTATION_SQL).toContain("Applied requires an exactly attested CI/service pack manifest");
    expect(MANIFEST_ATTESTATION_SQL).toMatch(/REVOKE INSERT, UPDATE, DELETE ON public\.pragma_pack_manifest_attestations FROM authenticated, anon/);
  });

  it("blocks speech-act expansion until the initial three-act moat has operational evidence", () => {
    expect(EXPANSION_READINESS_SQL).toContain("researcher_approved_gold_30");
    expect(EXPANSION_READINESS_SQL).toContain("expert_approved_gold_30");
    expect(EXPANSION_READINESS_SQL).toContain("released_vertical_slice_all_three_acts");
    expect(EXPANSION_READINESS_SQL).toContain("three_consented_completers_per_initial_act");
    expect(EXPANSION_READINESS_SQL).toContain("post_sample_flywheel_refresh");
    expect(EXPANSION_READINESS_SQL).toContain("live_three_role_rls_smoke");
    expect(EXPANSION_READINESS_SQL).toContain("verification.source_commit_ref = v_release.source_commit_ref");
    expect(EXPANSION_READINESS_SQL).toContain("CREATE OR REPLACE FUNCTION public.authorize_pragma_speech_act_expansion");
    expect(EXPANSION_READINESS_SQL).toContain("Expanded manifest requires an exact passing speech-act expansion authorization");
    expect(EXPANSION_READINESS_SQL).toMatch(/GRANT INSERT ON public\.pragma_operational_verifications TO service_role/);
    expect(EXPANSION_READINESS_SQL).toMatch(/REVOKE INSERT, UPDATE, DELETE ON public\.pragma_operational_verifications FROM authenticated, anon/);
  });

  it("keeps all pre-lock data test-only and accepts only 504 fresh cores under a current lock", () => {
    expect(FINAL_CORPUS_SQL).toContain("dataset_class text NOT NULL DEFAULT 'test_only'");
    expect(FINAL_CORPUS_SQL).toContain("Existing test data can never be relabelled as final corpus data");
    expect(FINAL_CORPUS_SQL).toContain("Final corpus must be newly generated; an identical pre-lock/test core already exists");
    expect(FINAL_CORPUS_SQL).toContain("pragma_final_corpus_9act_kozh_v1_504");
    expect(FINAL_CORPUS_SQL).toContain("exactly 56 items per speech act");
    expect(FINAL_CORPUS_SQL).toContain("Every speech-act by P/D/R construct cell requires at least two items");
    expect(FINAL_CORPUS_SQL).toContain("expert_gold_30_and_three_per_act_current_pack");
    expect(FINAL_CORPUS_SQL).toContain("CREATE OR REPLACE FUNCTION public.save_final_corpus_core");
    expect(FINAL_CORPUS_SQL).toContain("all 504 fresh, unique, passing plan items");
    expect(FINAL_CORPUS_SQL).toMatch(/REVOKE INSERT, UPDATE, DELETE ON public\.pragma_final_corpus_generation_locks FROM authenticated, anon/);
  });

  it("promotes the 504-item bank only as one immutable corpus after every mission release", () => {
    expect(FINAL_CORPUS_RELEASE_SQL).toContain("CREATE TABLE public.pragma_final_corpus_releases");
    expect(FINAL_CORPUS_RELEASE_SQL).toContain("CREATE TABLE public.pragma_final_corpus_release_items");
    expect(FINAL_CORPUS_RELEASE_SQL).toContain("CREATE OR REPLACE FUNCTION public.get_pragma_final_corpus_release_readiness");
    expect(FINAL_CORPUS_RELEASE_SQL).toContain("missions_individually_released");
    expect(FINAL_CORPUS_RELEASE_SQL).toContain("authoritative_lineage_bundle");
    expect(FINAL_CORPUS_RELEASE_SQL).toContain("CREATE OR REPLACE FUNCTION public.release_pragma_final_corpus");
    expect(FINAL_CORPUS_RELEASE_SQL).toContain("Final-corpus release must atomically promote all 504 scenarios");
    expect(FINAL_CORPUS_RELEASE_SQL).toContain("Final release requires exact immutable corpus membership");
    expect(FINAL_CORPUS_RELEASE_SQL).toMatch(/REVOKE INSERT, UPDATE, DELETE ON public\.pragma_final_corpus_releases,[\s\S]*public\.pragma_final_corpus_release_items FROM authenticated, anon/);
  });

  it("leases only missing final missions and preserves every retry result before completion", () => {
    expect(FINAL_MISSION_BATCH_SQL).toContain("CREATE TABLE public.pragma_final_corpus_mission_batches");
    expect(FINAL_MISSION_BATCH_SQL).toContain("CREATE TABLE public.pragma_final_corpus_mission_item_claims");
    expect(FINAL_MISSION_BATCH_SQL).toContain("CREATE TABLE public.pragma_final_corpus_mission_item_results");
    expect(FINAL_MISSION_BATCH_SQL).toContain("FOR UPDATE OF scenario SKIP LOCKED");
    expect(FINAL_MISSION_BATCH_SQL).toContain("Mission batch cannot complete until all 504 claimed items succeed");
    expect(FINAL_MISSION_BATCH_SQL).toContain("Final-corpus mission promotion requires a live server lease owned by the caller");
    expect(FINAL_MISSION_BATCH_SQL).toContain("exact locked pack, hashes, and item lineage");
    expect(FINAL_MISSION_BATCH_SQL).toMatch(/REVOKE INSERT, UPDATE, DELETE ON public\.pragma_final_corpus_mission_batches,[\s\S]*public\.pragma_final_corpus_mission_item_results FROM authenticated, anon/);
    expect(FINAL_MISSION_RECONCILIATION_SQL).toContain("CREATE OR REPLACE FUNCTION public.reconcile_pragma_final_corpus_mission_batch");
    expect(FINAL_MISSION_RECONCILIATION_SQL).toContain("The immutable generated lineage is the authority");
    expect(FINAL_MISSION_RECONCILIATION_SQL).toContain("PERFORM public.reconcile_pragma_final_corpus_mission_batch");
    expect(PROMOTE_TS).toContain('qualityGate === "required_non_fail"');
  });
});
