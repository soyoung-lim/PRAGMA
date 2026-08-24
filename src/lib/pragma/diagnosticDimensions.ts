/**
 * 한 화행을 통합적으로 수행할 때 관찰할 수 있는 미션 수준 진단차원.
 * 문항별 target_feature와 별개이며, 신규 MPJ5는 각 차원의 근거 위치를 함께 남긴다.
 */
export const MISSION_DIAGNOSTIC_DIMENSIONS = [
  "illocutionary_clarity",
  "force_calibration",
  "relational_calibration",
  "burden_optionality",
  "supportive_move_fit",
  "channel_sequence_fit",
] as const;
export type MissionDiagnosticDimension =
  (typeof MISSION_DIAGNOSTIC_DIMENSIONS)[number];

/** MPJ는 1-based 문항 번호, dct는 production_task를 가리킨다. */
export const MISSION_DIAGNOSTIC_EVIDENCE_REFS = [
  "mpj:1",
  "mpj:2",
  "mpj:3",
  "mpj:4",
  "mpj:5",
  "dct",
] as const;
export type MissionDiagnosticEvidenceRef =
  (typeof MISSION_DIAGNOSTIC_EVIDENCE_REFS)[number];

export const MISSION_DIAGNOSTIC_DIMENSION_LABELS: Record<
  MissionDiagnosticDimension,
  string
> = {
  illocutionary_clarity: "화행 의도 명료성",
  force_calibration: "화행 강도 조절",
  relational_calibration: "관계에 따른 조절",
  burden_optionality: "부담·선택권 조절",
  supportive_move_fit: "보조화행 적합성",
  channel_sequence_fit: "매체·담화순서 적합성",
};
