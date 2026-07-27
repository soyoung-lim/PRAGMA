// 코어 배치 실행기 — 계약 v1.4 §7-0. scenario_core_v1 대량 생성.
//
// legacy batchRun.ts(candidates+feedback)와 별개. 경로:
//   action:'core'(엣지함수) → checkCore(클라 검사) → save_generated_core RPC
// RPC는 is_admin() 가드 → 관리자 세션에서만 성공(브라우저 AdminBatch).

import { supabase } from "@/integrations/supabase/client";
import {
  DOMAIN,
  LEVEL,
  SPEECH_ACT_UI,
  type GenMode,
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
  /** 같은 세션에서 코어 비평 파일럿을 돌리기 위한 생성 응답. DB 저장 게이트에는 사용하지 않는다. */
  coreContent?: Record<string, unknown>;
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

// task_mode → source_modality (channel 폐기 2026-07-25 — 매체가 아니라 수행 방식이 결정).
const modalityOf = (mode: GenMode) => (mode === "stt_interpreting" ? "spoken" : "written");
// genre 행 태그(legacy)를 task_mode에서 파생하기 위한 legacy channel 토큰.
// channel은 더 이상 축이 아니지만, save_generated_core RPC가 core_content.channel로
// genre를 파생하므로(DB 무변경 유지) 저장 직전 mode에서 이 값을 주입한다.
const legacyChannelOf = (mode: GenMode) => (mode === "stt_interpreting" ? "facetoface" : "messenger");

function ctxOf(cell: BatchCell): CheckContext {
  const mode = cell.mode;
  return {
    speech_act: cell.speech_act_ui,
    level: cell.level,
    domain: cell.domain,
    theme_code: cell.theme_code as ThemeCode,
    topic_code: cell.topic_code,
    industry: cell.industry,
    mode,
    source_modality: modalityOf(mode),
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
    const mode = cell.mode;
    const sourceModality = modalityOf(mode);
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
          mode, // channel 폐기(2026-07-25) — 수행 방식이 1차 축(매체 관습 강제 제거)
          // 재배포 전 live 엣지 호환용 legacy channel(mode 파생). 재배포 후 엣지는 mode를 본다.
          channel: legacyChannelOf(mode),
          channel_ko: mode === "stt_interpreting" ? "구두(통역)" : "서면(번역)",
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

    const core = data.core_content as Record<string, unknown> & {
      channel?: string;
      brief_note_ko?: string;
      situation_ko?: string;
    };
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
    // genre 행 태그(legacy)를 task_mode에서 파생 — RPC가 core_content.channel로 genre를
    // 만들므로(DB 무변경) 저장 직전 mode에서 legacy channel을 주입한다. channel은 축이 아님.
    core.channel = legacyChannelOf(mode);
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
      // 프롬프트 지문 — 엣지가 '보내기 직전 문자열'로 계산한 값을 그대로 넘긴다.
      // 여기서 재계산하면 로컬 코드 기준이 되어 배포본과 어긋날 수 있다(=거짓 기록).
      prompt_snapshot_hash: meta?.prompt_snapshot_hash ?? null,
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
      coreContent: core,
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
