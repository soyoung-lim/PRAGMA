import { coreGenerationItemKey, type CoreCellResult } from "@/lib/pragma/coreBatchRun";
import type { MissionBatchItemResult } from "@/lib/pragma/missionBatchRun";

export interface BatchTerminalEvidenceRecord {
  generation_run_id: string;
  phase: "core" | "mission";
  item_index: number | "UNKNOWN";
  plan_item_key: string | "UNKNOWN";
  scenario_id: string | "UNKNOWN";
  mission_id: string | "UNKNOWN";
  item_candidate_path: string[];
  terminal_stage: string;
  deterministic_failure_code: string[];
  critic_verdict: "pass" | "warning" | "fail" | "UNKNOWN";
  critic_finding_code: Array<{ code: string; path: string }>;
  attempt_no: number;
  replacement_no: number;
  regeneration_count: number;
  repair_fallback_operation: string;
  repair_fallback_result: string;
  infrastructure_error: boolean;
  provider_status: number | "UNKNOWN";
  final_outcome: string;
  stop_code: string | "UNKNOWN";
  terminal_error: string | "UNKNOWN";
  boundary_fallback: Record<string, unknown> | null;
  recorded_at: string;
}

export function itemIndexFromPlanItemKey(key: string | null): number | "UNKNOWN" {
  if (!key) return "UNKNOWN";
  const value = Number.parseInt(key.split("|").at(-1) ?? "", 10);
  return Number.isInteger(value) ? value : "UNKNOWN";
}

export function coreTerminalEvidence(
  runId: string,
  result: CoreCellResult,
  recordedAt = new Date().toISOString(),
  replacementNo = 0,
): BatchTerminalEvidenceRecord {
  return {
    generation_run_id: runId,
    phase: "core",
    item_index: result.index,
    plan_item_key: coreGenerationItemKey(result.cell, result.index),
    scenario_id: result.scenarioId ?? "UNKNOWN",
    mission_id: "UNKNOWN",
    item_candidate_path: [],
    terminal_stage: result.terminalStage ?? "UNKNOWN",
    deterministic_failure_code: result.deterministicFailureCodes ?? [],
    critic_verdict: "UNKNOWN",
    critic_finding_code: [],
    attempt_no: result.reused ? 0 : 1,
    replacement_no: replacementNo,
    regeneration_count: 0,
    repair_fallback_operation: "none",
    repair_fallback_result: "not_attempted",
    infrastructure_error: result.infrastructureError ?? false,
    provider_status: result.providerStatus ?? "UNKNOWN",
    final_outcome: result.reused ? "reused" : result.ok ? "core_saved" : "terminal_dropout",
    stop_code: "UNKNOWN",
    terminal_error: result.error?.slice(0, 500) ?? "UNKNOWN",
    boundary_fallback: null,
    recorded_at: recordedAt,
  };
}

export function missionTerminalEvidence(
  runId: string,
  result: MissionBatchItemResult,
  recordedAt = new Date().toISOString(),
): BatchTerminalEvidenceRecord {
  const terminal = result.terminal;
  return {
    generation_run_id: runId,
    phase: "mission",
    item_index: itemIndexFromPlanItemKey(result.generationItemKey),
    plan_item_key: result.generationItemKey ?? "UNKNOWN",
    scenario_id: result.scenarioId || "UNKNOWN",
    mission_id: "UNKNOWN",
    item_candidate_path: terminal?.itemCandidatePaths ?? [],
    terminal_stage: result.reused ? "mission_reused" : terminal?.terminalStage ?? "UNKNOWN",
    deterministic_failure_code: terminal?.deterministicFailureCodes ??
      result.violations?.filter((violation) => violation.level === "fail").map((violation) => violation.id) ?? [],
    critic_verdict: terminal?.criticVerdict ?? result.qualityVerdict ?? "UNKNOWN",
    critic_finding_code: terminal?.criticFindingCodes ?? [],
    attempt_no: terminal?.attemptNo ?? (result.reused ? 0 : 1),
    replacement_no: 0,
    regeneration_count: terminal?.regenerationCount ?? result.candidateRegenerationCount ?? 0,
    repair_fallback_operation: terminal?.operation ?? "none",
    repair_fallback_result: terminal?.operationResult ?? "UNKNOWN",
    infrastructure_error: terminal?.infrastructureError ?? false,
    provider_status: terminal?.providerStatus ?? "UNKNOWN",
    final_outcome: result.reused
      ? "reused"
      : terminal?.finalOutcome ?? (result.ok ? "eligible_or_quarantined" : "terminal_dropout"),
    stop_code: terminal?.stopCode ?? "UNKNOWN",
    terminal_error: terminal?.operationError?.slice(0, 500) ?? result.error?.slice(0, 500) ?? "UNKNOWN",
    boundary_fallback: terminal?.boundaryFallback ?? null,
    recorded_at: recordedAt,
  };
}
