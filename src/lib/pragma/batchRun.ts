// 배치 실행기 — 계획(batchPlan)의 셀을 하나씩 생성·저장한다.
//
// 새 생성 로직을 쓰지 않는다. AdminGenerator가 이미 쓰는 경로를 그대로 반복 호출한다:
//   generate-scenario(단발) → save_generated_scenario RPC → 후속 컬럼 보정
//
// ⚠️ 후속 보정이 필요한 이유 (2026-07-22 발견):
// save_generated_scenario RPC는 domain을 INSERT하지 않는다. AdminGenerator의
// persistExtraColumns도 mode·language_direction만 채운다. 그래서 지금까지 생성된
// 시나리오는 전부 domain이 NULL이었다 — 교수님이 요구한 "주제별" 필터의 축이
// 저장되지 않고 있었다는 뜻이다. 여기서 domain을 반드시 함께 기록한다.
//
// 저장 결과는 review_status='needs_review' · usage_assignment='archived_only'다(RPC 고정).
// 즉 생성만으로는 학습자에게 노출되지 않고 승인 큐를 거친다 — 설계대로다.

import { supabase } from "@/integrations/supabase/client";
import {
  COMPLEX_TASK_TO_CONTEXT,
  type GenMode,
  type LanguageDirection,
} from "@/lib/pragma/enums";
import type { BatchCell } from "@/lib/pragma/batchPlan";

// channel 폐기(2026-07-25) — 이 legacy 배치 러너도 task_mode에서 파생한다.
// genre·channel_ui는 legacy_v1 RPC(save_generated_scenario) 호환용 태그일 뿐 축이 아니다.
const legacyGenreOf = (mode: GenMode) => (mode === "stt_interpreting" ? "meeting_speech" : "business_messenger");
const legacyChannelOf = (mode: GenMode) => (mode === "stt_interpreting" ? "facetoface" : "messenger");

export interface BatchCellResult {
  index: number;
  cell: BatchCell;
  ok: boolean;
  scenarioId?: string;
  title?: string;
  error?: string;
  /** domain 등 후속 컬럼 보정 실패 — 저장 자체는 성공한 상태 */
  metaWarning?: boolean;
}

export interface RunOptions {
  languageDirection?: LanguageDirection;
  /** 동시 실행 수. OpenAI·엣지함수 한도를 고려해 작게 잡는다. */
  concurrency?: number;
  onProgress?: (done: number, total: number, last: BatchCellResult) => void;
  signal?: AbortSignal;
}

/** 셀 → 엣지함수 요청 바디. AdminGenerator의 baseGenBody와 같은 축을 채운다. */
function cellToBody(cell: BatchCell, languageDirection: LanguageDirection) {
  return {
    speech_act: cell.speech_act_ui,
    genre: legacyGenreOf(cell.mode),
    level: cell.level,
    context: COMPLEX_TASK_TO_CONTEXT.none,
    domain: cell.domain,
    industry: cell.industry,
    // func는 생성 프롬프트에 넣지 않는다 — '마케팅·홍보' 편향이 주입된다
    // (AdminGenerator의 기존 판단을 그대로 따른다).
    func: null,
    pdr_power: cell.pdr_power,
    pdr_distance: cell.pdr_distance,
    pdr_burden: cell.pdr_burden,
    multi: false,
    reasons: "1",
    coordination: false,
    language_direction: languageDirection,
    mode: cell.mode,
    speech_act_ui: cell.speech_act_ui,
    channel_ui: legacyChannelOf(cell.mode),
    complex_task_ui: "none",
  };
}

/** 한 셀을 생성·저장한다. 실패해도 throw하지 않고 결과로 돌려준다. */
export async function runBatchCell(
  cell: BatchCell,
  index: number,
  languageDirection: LanguageDirection,
): Promise<BatchCellResult> {
  try {
    const { data, error } = await supabase.functions.invoke("generate-scenario", {
      body: cellToBody(cell, languageDirection),
    });
    if (error) throw error;
    if (!data?.scenario) throw new Error(data?.error ?? "빈 응답을 받았습니다.");

    const scenario = data.scenario;
    const meta = data.meta;

    const { data: savedId, error: saveErr } = await (supabase.rpc as never as
      (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>)(
      "save_generated_scenario",
      {
        p_payload: {
          scenario,
          meta,
          form: {
            speech_act: cell.speech_act_ui,
            genre: legacyGenreOf(cell.mode),
            level: cell.level,
            context: COMPLEX_TASK_TO_CONTEXT.none,
            industry: cell.industry,
            func: null,
            pdr_power: cell.pdr_power,
            pdr_distance: cell.pdr_distance,
            pdr_burden: cell.pdr_burden,
          },
        },
      },
    );
    if (saveErr) throw saveErr;

    const scenarioId = savedId as string;

    // RPC가 못 채우는 축을 보정한다. domain이 빠지면 '주제별' 필터가 통째로 빈다.
    const { error: metaErr } = await supabase
      .from("scenarios")
      .update({
        domain: cell.domain,
        mode: cell.mode,
        language_direction: languageDirection,
      })
      .eq("scenario_id", scenarioId);

    return {
      index,
      cell,
      ok: true,
      scenarioId,
      title: scenario.title as string,
      metaWarning: Boolean(metaErr),
    };
  } catch (e) {
    return { index, cell, ok: false, error: (e as Error).message ?? "실패" };
  }
}

/**
 * 계획 전체를 실행한다. 소규모 동시 실행 풀 — 한 건이 실패해도 나머지는 계속된다.
 * 중단(signal)하면 진행 중인 건까지만 마치고 멈춘다.
 */
export async function runBatch(
  cells: BatchCell[],
  opts: RunOptions = {},
): Promise<BatchCellResult[]> {
  const languageDirection = opts.languageDirection ?? "ko_zh";
  const concurrency = Math.max(1, Math.min(opts.concurrency ?? 3, 8));
  const results: BatchCellResult[] = [];
  let cursor = 0;
  let done = 0;

  const worker = async () => {
    for (;;) {
      if (opts.signal?.aborted) return;
      const i = cursor;
      cursor += 1;
      if (i >= cells.length) return;

      const res = await runBatchCell(cells[i], i, languageDirection);
      results.push(res);
      done += 1;
      opts.onProgress?.(done, cells.length, res);
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results.sort((a, b) => a.index - b.index);
}
