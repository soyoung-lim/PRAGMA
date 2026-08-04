import {
  FULL_BATCH_QUOTA_495,
  ZH_KO_VALIDATION_ACTS,
  ZH_KO_VALIDATION_QUOTA,
  buildBatchPlan,
  type BatchCell,
} from "@/lib/pragma/batchPlan";

function requireCell(
  cells: readonly BatchCell[],
  label: string,
  predicate: (cell: BatchCell) => boolean,
): BatchCell {
  const cell = cells.find(predicate);
  if (!cell) throw new Error(`콘텐츠 canary 셀을 구성할 수 없습니다: ${label}`);
  return { ...cell, count: 1 };
}

/**
 * 전체 refresh 전에 생성·눈검사할 최소 대표 표본.
 *
 * 임의 장면을 따로 만들지 않고 본 배치 플래너에서 뽑는다. 두 방향·두 수행 방식,
 * 응답/비응답 화행, 고부담·먼 관계·권력 차이를 작은 표본 안에 포함한다.
 */
export function buildContentCanaryPlan(): BatchCell[] {
  const koZh = buildBatchPlan(FULL_BATCH_QUOTA_495, "ko_zh");
  const zhKo = buildBatchPlan(
    ZH_KO_VALIDATION_QUOTA,
    "zh_ko",
    ZH_KO_VALIDATION_ACTS,
  );

  return [
    requireCell(
      koZh,
      "한→중 요청·번역·고부담",
      (cell) =>
        cell.speech_act_ui === "request" &&
        cell.level === "intermediate" &&
        cell.mode === "translation" &&
        cell.pdr_burden === "high",
    ),
    requireCell(
      koZh,
      "한→중 요청·통역",
      (cell) =>
        cell.speech_act_ui === "request" &&
        cell.level === "intermediate" &&
        cell.mode === "stt_interpreting",
    ),
    requireCell(
      koZh,
      "한→중 거절·응답 화행·권력 차",
      (cell) =>
        cell.speech_act_ui === "refusal" &&
        cell.mode === "translation" &&
        cell.pdr_power === "higher",
    ),
    requireCell(
      koZh,
      "한→중 불만·통역·먼 관계",
      (cell) =>
        cell.speech_act_ui === "complaint" &&
        cell.mode === "stt_interpreting" &&
        cell.pdr_distance === "formal",
    ),
    requireCell(
      zhKo,
      "중→한 요청·번역",
      (cell) =>
        cell.speech_act_ui === "request" &&
        cell.level === "intermediate" &&
        cell.mode === "translation",
    ),
    requireCell(
      zhKo,
      "중→한 감사·통역",
      (cell) =>
        cell.speech_act_ui === "thanks" &&
        cell.level === "advanced" &&
        cell.mode === "stt_interpreting",
    ),
  ];
}
