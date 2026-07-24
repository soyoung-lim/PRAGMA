// 코어 배치 실행기 — 계약 v1.4 §7-0. scenario_core_v1 대량 생성.
//
// legacy batchRun.ts(candidates+feedback)와 별개. 경로:
//   action:'core'(엣지함수) → checkCore(클라 검사) → save_generated_core RPC
// RPC는 is_admin() 가드 → 관리자 세션에서만 성공(브라우저 AdminBatch).

import { supabase } from "@/integrations/supabase/client";
import {
  CHANNEL_TO_MODE,
  CHANNEL_UI,
  DOMAIN,
  LEVEL,
  SPEECH_ACT_UI,
  type LanguageDirection,
} from "@/lib/pragma/enums";
import {
  PDR_POWER_ENUM_TO_JSON,
  PDR_DISTANCE_ENUM_TO_JSON,
} from "@/lib/pragma/coreSchema";
import { checkCore, type CheckContext } from "@/lib/pragma/missionRules";
import type { BatchCell } from "@/lib/pragma/batchPlan";
import type { ThemeCode } from "@/lib/pragma/scenarioTopics";

const RESPONSE_ACTS = new Set(["refusal", "opposition"]);

// 수준별 원문 분량 힌트 (계약 §7-1 분량 사다리)
const LENGTH_HINT: Record<string, string> = {
  beginner_intermediate: "1~2문장",
  intermediate: "2~4문장",
  advanced: "번역 3~5문장 / 통역 짧은 구두 담화 (기억 과부하 없이)",
};

export interface CoreCellResult {
  index: number;
  cell: BatchCell;
  ok: boolean;
  scenarioId?: string;
  ruleResult?: "pass" | "warning" | "fail";
  ruleFailFirst?: string;
  error?: string;
}

export interface CoreRunOptions {
  languageDirection?: LanguageDirection;
  runId: string;
  concurrency?: number;
  onProgress?: (done: number, total: number, last: CoreCellResult) => void;
  signal?: AbortSignal;
}

function ctxOf(cell: BatchCell): CheckContext {
  const mode = CHANNEL_TO_MODE[cell.channel];
  return {
    speech_act: cell.speech_act_ui,
    level: cell.level,
    domain: cell.domain,
    theme_code: cell.theme_code as ThemeCode,
    topic_code: cell.topic_code,
    industry: cell.industry,
    mode,
    source_modality: mode === "stt_interpreting" ? "spoken" : "written",
    direction: cell.direction, // 0-l·89 — 데이터 방향과 요청 방향 일치 검사
  };
}

/** 결정론 content hash — 멱등키 보조(§6). crypto.subtle 없이 간단 해시. */
function hashString(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

export async function runCoreCell(
  cell: BatchCell,
  index: number,
  opts: CoreRunOptions,
): Promise<CoreCellResult> {
  try {
    const mode = CHANNEL_TO_MODE[cell.channel];
    const sourceModality = mode === "stt_interpreting" ? "spoken" : "written";
    const isResponse = RESPONSE_ACTS.has(cell.speech_act_ui);

    // 1. 코어 생성 (엣지함수 action:'core')
    const { data, error } = await supabase.functions.invoke("generate-scenario", {
      body: {
        action: "core",
        core: {
          direction: cell.direction, // 0-l·89 — 엣지가 방향별 원문·산출 언어 결정(라운드2 배포 후 활성)
          speech_act_ko: SPEECH_ACT_UI[cell.speech_act_ui],
          level_ko: LEVEL[cell.level],
          domain_ko: DOMAIN[cell.domain],
          channel: cell.channel,
          channel_ko: CHANNEL_UI[cell.channel],
          pdr: {
            p: PDR_POWER_ENUM_TO_JSON[cell.pdr_power],
            d: PDR_DISTANCE_ENUM_TO_JSON[cell.pdr_distance],
            r: cell.pdr_burden,
          },
          source_modality: sourceModality,
          situation_seed_ko: cell.situation_seed_ko,
          is_response_act: isResponse,
          length_hint_ko: LENGTH_HINT[cell.level] ?? "2~4문장",
        },
      },
    });
    if (error) throw error;
    if (!data?.core_content) throw new Error(data?.error ?? "빈 응답");

    const core = data.core_content;
    const meta = data.meta;

    // 2. 클라 검사 (checkCore) — fail이면 저장하지 않는다
    const ruleResult = checkCore(core, ctxOf(cell));
    if (ruleResult.result === "fail") {
      return {
        index,
        cell,
        ok: false,
        ruleResult: "fail",
        ruleFailFirst: ruleResult.violations.find((v) => v.level === "fail")?.message,
        error: "규칙검사 실패(저장 안 함)",
      };
    }

    // 3. save_generated_core RPC (검증 통과분만)
    const itemKey = `${cell.speech_act_ui}|${cell.level}|${cell.domain}|${cell.topic_code}|${index}`;
    const payload = {
      title: core.brief_note_ko || core.situation_ko?.slice(0, 40),
      speech_act: cell.speech_act_ui,
      learner_level: cell.level,
      domain: cell.domain,
      industry_sector: cell.industry,
      mode,
      source_modality: sourceModality,
      theme_code: cell.theme_code,
      topic_code: cell.topic_code,
      language_direction: cell.direction, // 0-l·89 — 행 태그(RPC가 라운드2에서 INSERT)
      core_content: core,
      auto_check_result: ruleResult.result === "warning" ? "warning" : "pass",
      meta,
      generation_run_id: opts.runId,
      generation_item_key: itemKey,
      content_hash: hashString(JSON.stringify(core)),
    };
    const { data: savedId, error: saveErr } = await (
      supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: unknown }>
    )("save_generated_core", { p_payload: payload });
    if (saveErr) throw saveErr;

    return {
      index,
      cell,
      ok: true,
      scenarioId: savedId as string,
      ruleResult: ruleResult.result === "warning" ? "warning" : "pass",
    };
  } catch (e) {
    return { index, cell, ok: false, error: (e as Error).message ?? "실패" };
  }
}

/** 계획 전체를 코어 경로로 실행. 소규모 동시 실행 풀 — 실패해도 계속. */
export async function runCoreBatch(
  cells: BatchCell[],
  opts: CoreRunOptions,
): Promise<CoreCellResult[]> {
  const concurrency = Math.max(1, Math.min(opts.concurrency ?? 3, 8));
  const results: CoreCellResult[] = [];
  let cursor = 0;
  let done = 0;

  const worker = async () => {
    for (;;) {
      if (opts.signal?.aborted) return;
      const i = cursor;
      cursor += 1;
      if (i >= cells.length) return;
      const res = await runCoreCell(cells[i], i, opts);
      results.push(res);
      done += 1;
      opts.onProgress?.(done, cells.length, res);
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results.sort((a, b) => a.index - b.index);
}
