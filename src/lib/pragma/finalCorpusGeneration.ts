import { supabase } from "@/integrations/supabase/client";
import type { BatchCell } from "@/lib/pragma/batchPlan";
import { summarizePlan } from "@/lib/pragma/batchPlan";
import { coreGenerationItemKey } from "@/lib/pragma/coreBatchRun";

export const FINAL_CORPUS_PLAN_VERSION = "pragma_final_corpus_9act_kozh_v1_504";
export const FINAL_CORPUS_TARGET_COUNT = 504;

export interface FinalCorpusPlanItem {
  ordinal: number;
  item_key: string;
  direction: "ko_zh";
  speech_act: string;
  level: string;
  domain: string;
  mode: string;
  industry: string | null;
  pdr_power: string;
  pdr_distance: string;
  pdr_burden: string;
  theme_code: string;
  topic_code: string;
}

export interface FinalCorpusPlanSnapshot {
  schema_version: "pragma_final_corpus_plan_v1";
  plan_version: typeof FINAL_CORPUS_PLAN_VERSION;
  direction: "ko_zh";
  target_count: typeof FINAL_CORPUS_TARGET_COUNT;
  items: FinalCorpusPlanItem[];
}

export interface FinalCorpusReadiness {
  schema_version: "pragma_final_corpus_generation_readiness_v1";
  pack_id: string;
  pack_version: string | null;
  generation_allowed: boolean;
  missing_requirements: string[];
  requirements: Record<string, unknown>;
}

export interface FinalCorpusRunState {
  schema_version: "pragma_final_corpus_run_state_v1";
  run_id: string;
  status: "prepared" | "generating" | "closed" | "aborted";
  target_count: number;
  current_item_count: number;
  remaining_item_count: number;
  plan_snapshot_hash: string;
  started_at: string | null;
  terminal_at: string | null;
}

export interface FinalCorpusReleaseReadiness {
  schema_version: "pragma_final_corpus_release_readiness_v1";
  run_id: string;
  pack_id: string;
  pack_version: string;
  target_count: number;
  release_allowed: boolean;
  existing_release_id: string | null;
  requirements: {
    core_run_closed: { passed: boolean };
    pack_lock_current: { passed: boolean };
    exact_locked_cores: { passed: boolean; count: number };
    missions_generated: { passed: boolean; count: number };
    missions_individually_released: { passed: boolean; count: number };
    authoritative_lineage_bundle: { passed: boolean; count: number };
    not_previously_released: { passed: boolean };
  };
}

const rpc = (
  fn: string,
  args: Record<string, unknown>,
) => (supabase.rpc as unknown as (
  name: string,
  payload: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message?: string } | null }>)(fn, args);

/**
 * Creates the exact immutable plan sent to the database lock/run contract.
 * This is not content: it contains only the 504 experimental/operational cells.
 */
export function buildFinalCorpusPlanSnapshot(cells: BatchCell[]): FinalCorpusPlanSnapshot {
  const summary = summarizePlan(cells);
  const acts = Object.values(summary.bySpeechAct);
  if (
    summary.total !== FINAL_CORPUS_TARGET_COUNT
    || cells.some((cell) => cell.direction !== "ko_zh" || cell.count !== 1)
    || summary.emptyActPdrCells.length > 0
    || summary.minActPdrCount < 2
    || summary.emptyActLevelModeCells.length > 0
    || summary.minActLevelModeCount < 3
    || acts.length !== 9
    || acts.some((count) => count !== 56)
  ) {
    throw new Error("최종 코퍼스는 승인된 한→중 504셀 계획만 lock할 수 있습니다.");
  }

  return {
    schema_version: "pragma_final_corpus_plan_v1",
    plan_version: FINAL_CORPUS_PLAN_VERSION,
    direction: "ko_zh",
    target_count: FINAL_CORPUS_TARGET_COUNT,
    items: cells.map((cell, ordinal) => ({
      ordinal,
      item_key: coreGenerationItemKey(cell, ordinal),
      direction: "ko_zh",
      speech_act: cell.speech_act_ui,
      level: cell.level,
      domain: cell.domain,
      mode: cell.mode,
      industry: cell.industry,
      pdr_power: cell.pdr_power,
      pdr_distance: cell.pdr_distance,
      pdr_burden: cell.pdr_burden,
      theme_code: cell.theme_code,
      topic_code: cell.topic_code,
    })),
  };
}

function unwrapString(data: unknown, error: { message?: string } | null, label: string): string {
  if (error) throw new Error(error.message ?? `${label} 실패`);
  if (typeof data !== "string" || data.length === 0) throw new Error(`${label} 결과 ID가 없습니다.`);
  return data;
}

export async function getFinalCorpusReadiness(packId: string): Promise<FinalCorpusReadiness> {
  const { data, error } = await rpc("get_pragma_final_corpus_generation_readiness", {
    p_pack_id: packId,
  });
  if (error) throw new Error(error.message ?? "최종 코퍼스 readiness 조회 실패");
  return data as FinalCorpusReadiness;
}

/** Locks current code/evidence/Gold state, creates the immutable 504 plan, then starts it. */
export async function prepareFinalCorpusRun(input: {
  packId: string;
  rationaleKo: string;
  cells: BatchCell[];
}): Promise<string> {
  const plan = buildFinalCorpusPlanSnapshot(input.cells);
  const lock = await rpc("lock_pragma_final_corpus_generation", {
    p_pack_id: input.packId,
    p_rationale_ko: input.rationaleKo,
  });
  const lockId = unwrapString(lock.data, lock.error, "최종 코퍼스 lock");

  const run = await rpc("create_pragma_final_corpus_generation_run", {
    p_generation_lock_id: lockId,
    p_plan_snapshot: plan,
  });
  const runId = unwrapString(run.data, run.error, "최종 코퍼스 run 생성");

  const started = await rpc("start_pragma_final_corpus_generation_run", {
    p_run_id: runId,
    p_rationale_ko: input.rationaleKo,
  });
  unwrapString(started.data, started.error, "최종 코퍼스 run 시작");
  return runId;
}

export async function getFinalCorpusRunState(runId: string): Promise<FinalCorpusRunState> {
  const { data, error } = await rpc("get_pragma_final_corpus_run_state", { p_run_id: runId });
  if (error) throw new Error(error.message ?? "최종 코퍼스 run 조회 실패");
  return data as FinalCorpusRunState;
}

export async function getFinalCorpusReleaseReadiness(runId: string): Promise<FinalCorpusReleaseReadiness> {
  const { data, error } = await rpc("get_pragma_final_corpus_release_readiness", { p_run_id: runId });
  if (error) throw new Error(error.message ?? "최종 코퍼스 release readiness 조회 실패");
  return data as FinalCorpusReleaseReadiness;
}

export async function closeFinalCorpusRun(runId: string, rationaleKo: string): Promise<string> {
  const { data, error } = await rpc("close_pragma_final_corpus_generation_run", {
    p_run_id: runId,
    p_rationale_ko: rationaleKo,
  });
  return unwrapString(data, error, "최종 코퍼스 run 종료");
}

export async function abortFinalCorpusRun(runId: string, rationaleKo: string): Promise<string> {
  const { data, error } = await rpc("abort_pragma_final_corpus_generation_run", {
    p_run_id: runId,
    p_rationale_ko: rationaleKo,
  });
  return unwrapString(data, error, "최종 코퍼스 run 중단");
}

/** Atomically labels all 504 locked scenarios only after every mission has authoritative release evidence. */
export async function releaseFinalCorpus(runId: string, rationaleKo: string): Promise<string> {
  const { data, error } = await rpc("release_pragma_final_corpus", {
    p_run_id: runId,
    p_rationale_ko: rationaleKo,
  });
  return unwrapString(data, error, "최종 코퍼스 release");
}
