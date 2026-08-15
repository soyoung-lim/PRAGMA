import { supabase } from "@/integrations/supabase/client";
import { promoteCore, type PromotableCore, type PromoteResult } from "@/lib/pragma/promoteMission";

export interface FinalCorpusMissionBatchState {
  schema_version: "pragma_final_corpus_mission_batch_state_v1";
  batch_id: string;
  generation_run_id: string;
  status: "prepared" | "started" | "paused" | "resumed" | "completed";
  target_count: number;
  generated_count: number;
  remaining_count: number;
  succeeded_claim_count: number;
  failed_attempt_count: number;
  active_lease_count: number;
  exhausted_item_count: number;
  max_item_attempts: number;
  lease_minutes: number;
}

export interface FinalCorpusMissionClaim {
  schema_version: "pragma_final_corpus_mission_claim_v1";
  done: boolean;
  waiting: boolean;
  blocked: boolean;
  remaining_count: number;
  active_lease_count: number;
  exhausted_count: number;
  claim_id?: string;
  attempt_no?: number;
  plan_ordinal?: number;
  lease_minutes?: number;
  core?: PromotableCore;
}

export interface FinalCorpusMissionProgress {
  claim: FinalCorpusMissionClaim;
  result: PromoteResult;
  processed: number;
}

const rpc = (
  fn: string,
  args: Record<string, unknown>,
) => (supabase.rpc as unknown as (
  name: string,
  payload: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message?: string } | null }>)(fn, args);

const unwrapId = (data: unknown, error: { message?: string } | null, label: string): string => {
  if (error) throw new Error(error.message ?? `${label} 실패`);
  if (typeof data !== "string" || !data) throw new Error(`${label} 결과 ID가 없습니다.`);
  return data;
};

export async function prepareFinalCorpusMissionBatch(
  generationRunId: string,
  rationaleKo: string,
): Promise<string> {
  const { data, error } = await rpc("prepare_pragma_final_corpus_mission_batch", {
    p_generation_run_id: generationRunId,
    p_rationale_ko: rationaleKo,
  });
  const batchId = unwrapId(data, error, "최종 mission batch 준비");
  const reconciled = await rpc("reconcile_pragma_final_corpus_mission_batch", { p_batch_id: batchId });
  if (reconciled.error) throw new Error(reconciled.error.message ?? "최종 mission batch 결과 복구 실패");
  return batchId;
}

export async function getFinalCorpusMissionBatchState(batchId: string): Promise<FinalCorpusMissionBatchState> {
  const { data, error } = await rpc("get_pragma_final_corpus_mission_batch_state", { p_batch_id: batchId });
  if (error) throw new Error(error.message ?? "최종 mission batch 상태 조회 실패");
  return data as FinalCorpusMissionBatchState;
}

export async function pauseFinalCorpusMissionBatch(batchId: string, rationaleKo: string): Promise<string> {
  const { data, error } = await rpc("pause_pragma_final_corpus_mission_batch", {
    p_batch_id: batchId,
    p_rationale_ko: rationaleKo,
  });
  return unwrapId(data, error, "최종 mission batch 일시정지");
}

export async function completeFinalCorpusMissionBatch(batchId: string, rationaleKo: string): Promise<string> {
  const { data, error } = await rpc("complete_pragma_final_corpus_mission_batch", {
    p_batch_id: batchId,
    p_rationale_ko: rationaleKo,
  });
  return unwrapId(data, error, "최종 mission batch 완료");
}

async function claimNext(batchId: string): Promise<FinalCorpusMissionClaim> {
  const { data, error } = await rpc("claim_pragma_final_corpus_mission_item", { p_batch_id: batchId });
  if (error) throw new Error(error.message ?? "최종 mission item claim 실패");
  return data as FinalCorpusMissionClaim;
}

async function recordResult(claim: FinalCorpusMissionClaim, result: PromoteResult): Promise<void> {
  if (!claim.claim_id) throw new Error("서버 claim ID가 없습니다.");
  const success = Boolean(result.ok && result.ruleResult && result.attempts && result.quality
    && result.quality.verdict !== "fail");
  const { error } = await rpc("record_pragma_final_corpus_mission_item_result", {
    p_claim_id: claim.claim_id,
    p_result: success ? "succeeded" : "failed",
    p_generation_attempt_count: success ? result.attempts : null,
    p_rule_result: success ? result.ruleResult : null,
    p_quality_verdict: success ? result.quality?.verdict : null,
    p_error_message: success ? null : result.error ?? "미션 생성 실패",
  });
  if (error) throw new Error(error.message ?? "최종 mission item 결과 기록 실패");
}

/**
 * Claims only server-selected missing items. Two workers balance throughput and
 * cost while 20-minute leases prevent duplicate paid calls after interruption.
 */
export async function runFinalCorpusMissionBatch(input: {
  batchId: string;
  signal?: AbortSignal;
  concurrency?: number;
  onProgress?: (progress: FinalCorpusMissionProgress) => void;
}): Promise<FinalCorpusMissionBatchState> {
  const concurrency = Math.max(1, Math.min(input.concurrency ?? 2, 3));
  let processed = 0;

  const worker = async () => {
    while (!input.signal?.aborted) {
      const claim = await claimNext(input.batchId);
      if (!claim.claim_id || !claim.core) return;
      const result = await promoteCore(claim.core, { qualityGate: "required_non_fail" });
      await recordResult(claim, result);
      processed += 1;
      input.onProgress?.({ claim, result, processed });
    }
  };

  const outcomes = await Promise.allSettled(Array.from({ length: concurrency }, () => worker()));
  const failure = outcomes.find((outcome): outcome is PromiseRejectedResult => outcome.status === "rejected");
  if (failure) throw failure.reason;
  return getFinalCorpusMissionBatchState(input.batchId);
}
