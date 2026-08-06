import {
  FULL_BATCH_QUOTA_495,
  ZH_KO_VALIDATION_ACTS,
  buildBatchPlan,
  buildZhKoValidationPlan,
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
  const zhKo = buildZhKoValidationPlan();

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

/**
 * 통역 역할 계약 운영 카나리.
 *
 * 현행 한→중 495 계획과 중→한 30셀 검증 계획에서 화행별 통역 셀 하나를 뽑는다.
 * 화행별 후보가 여러 개면 화행 순번으로 회전해 P·D·R·수준이 한 셀에 고정되지 않게 한다.
 * 결과는 9화행 × 2방향 = 18건이며 호출자가 DB 저장 없이 core-only로 실행한다.
 */
export function buildInterpreterRoleCanaryPlan(): BatchCell[] {
  const plans = [
    buildBatchPlan(FULL_BATCH_QUOTA_495, "ko_zh"),
    buildZhKoValidationPlan(),
  ];

  return plans.flatMap((cells, directionIndex) =>
    ZH_KO_VALIDATION_ACTS.map((speechAct, actIndex) => {
      const candidates = cells.filter(
        (cell) =>
          cell.direction === (directionIndex === 0 ? "ko_zh" : "zh_ko") &&
          cell.speech_act_ui === speechAct &&
          cell.mode === "stt_interpreting",
      );
      if (candidates.length === 0) {
        throw new Error(`통역 역할 canary 셀이 없습니다: ${speechAct}`);
      }
      return { ...candidates[actIndex % candidates.length], count: 1 };
    }),
  );
}
