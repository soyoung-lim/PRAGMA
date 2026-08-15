import type { SeedGoldCase } from "@/lib/pragma/seedGoldSet";

export type GoldReviewStatus = SeedGoldCase["review"]["status"];

export interface CandidateEvaluationObservation {
  case_id: string;
  candidate_id: string;
  predicted_band_code: string;
  predicted_semantic_fidelity?: "pass" | "warning" | "fail";
}

export interface GoldRegressionOptions {
  /** Seed is allowed for engineering calibration only; release gates should use expert_approved. */
  eligible_statuses: GoldReviewStatus[];
  minimum_band_accuracy: number;
  minimum_semantic_accuracy: number;
  require_complete_coverage: boolean;
  /** Seed 단계의 미검토 의미 라벨은 점수화하지 않는다. release gate에서는 true. */
  require_semantic_labels: boolean;
}

export interface GoldRegressionMismatch {
  case_id: string;
  candidate_id: string;
  field: "band" | "semantic_fidelity";
  expected: string;
  actual: string;
}

export interface GoldRegressionReport {
  gate_status: "pass" | "fail" | "not_runnable";
  mode: "engineering_seed" | "researcher_gate" | "expert_release_gate" | "mixed";
  eligible_case_count: number;
  expected_observation_count: number;
  received_observation_count: number;
  matched_band_count: number;
  matched_semantic_count: number;
  expected_semantic_observation_count: number;
  band_accuracy: number | null;
  semantic_accuracy: number | null;
  missing_observation_keys: string[];
  duplicate_observation_keys: string[];
  unknown_observation_keys: string[];
  mismatches: GoldRegressionMismatch[];
  thresholds: Pick<
    GoldRegressionOptions,
    "minimum_band_accuracy" | "minimum_semantic_accuracy" | "require_complete_coverage" | "require_semantic_labels"
  >;
  evaluation_purpose: "operational_gate_check";
  is_quality_measurement: false;
  interpretation_note_ko: string;
}

export const GOLD_GATE_INTERPRETATION_KO =
  "외부 전문가가 확인한 9화행 층화표본으로 품질 점검 자동화 장치의 작동 여부를 확인하는 운영 게이트입니다. 전체 시스템의 정확도나 일반화된 품질 측정치로 해석하거나 보고하지 않습니다.";

const keyOf = (caseId: string, candidateId: string) => `${caseId}::${candidateId}`;

function modeOf(statuses: GoldReviewStatus[]): GoldRegressionReport["mode"] {
  const unique = new Set(statuses);
  if (unique.size !== 1) return "mixed";
  if (unique.has("researcher_seed")) return "engineering_seed";
  if (unique.has("researcher_approved")) return "researcher_gate";
  if (unique.has("expert_approved")) return "expert_release_gate";
  return "mixed";
}

export function runGoldRegression(
  goldCases: SeedGoldCase[],
  observations: CandidateEvaluationObservation[],
  options: GoldRegressionOptions,
): GoldRegressionReport {
  const eligibleCases = goldCases.filter((item) =>
    options.eligible_statuses.includes(item.review.status),
  );
  const expected = new Map<
    string,
    {
      case_id: string;
      candidate_id: string;
      band: string;
      semantic: SeedGoldCase["candidates"][number]["semantic_fidelity"];
    }
  >();
  for (const item of eligibleCases) {
    for (const candidate of item.candidates) {
      expected.set(keyOf(item.case_id, candidate.candidate_id), {
        case_id: item.case_id,
        candidate_id: candidate.candidate_id,
        band: candidate.expected_band_code,
        semantic: candidate.semantic_fidelity,
      });
    }
  }

  const seen = new Set<string>();
  const duplicates = new Set<string>();
  const unknown = new Set<string>();
  const mismatches: GoldRegressionMismatch[] = [];
  let matchedBand = 0;
  let matchedSemantic = 0;

  for (const observation of observations) {
    const key = keyOf(observation.case_id, observation.candidate_id);
    if (seen.has(key)) {
      duplicates.add(key);
      continue;
    }
    seen.add(key);
    const target = expected.get(key);
    if (!target) {
      unknown.add(key);
      continue;
    }
    if (observation.predicted_band_code === target.band) {
      matchedBand += 1;
    } else {
      mismatches.push({
        case_id: target.case_id,
        candidate_id: target.candidate_id,
        field: "band",
        expected: target.band,
        actual: observation.predicted_band_code,
      });
    }
    if (target.semantic !== "pending_researcher_review") {
      if (observation.predicted_semantic_fidelity === target.semantic) {
        matchedSemantic += 1;
      } else {
        mismatches.push({
          case_id: target.case_id,
          candidate_id: target.candidate_id,
          field: "semantic_fidelity",
          expected: target.semantic,
          actual: observation.predicted_semantic_fidelity ?? "missing",
        });
      }
    }
  }

  const missing = [...expected.keys()].filter((key) => !seen.has(key));
  const comparedCount = expected.size - missing.length;
  const bandAccuracy = comparedCount > 0 ? matchedBand / comparedCount : null;
  const expectedSemanticCount = [...expected.values()].filter(
    (target) => target.semantic !== "pending_researcher_review",
  ).length;
  const comparedSemanticCount = [...expected.entries()].filter(
    ([key, target]) => target.semantic !== "pending_researcher_review" && seen.has(key),
  ).length;
  const semanticAccuracy = comparedSemanticCount > 0
    ? matchedSemantic / comparedSemanticCount
    : null;
  const notRunnable = expected.size === 0;
  const coveragePass = !options.require_complete_coverage || missing.length === 0;
  const semanticPass = options.require_semantic_labels
    ? expectedSemanticCount === expected.size
      && semanticAccuracy !== null
      && semanticAccuracy >= options.minimum_semantic_accuracy
    : true;
  const accuracyPass =
    bandAccuracy !== null
    && bandAccuracy >= options.minimum_band_accuracy
    && semanticPass;
  const integrityPass = duplicates.size === 0 && unknown.size === 0;

  return {
    gate_status: notRunnable
      ? "not_runnable"
      : coveragePass && accuracyPass && integrityPass
        ? "pass"
        : "fail",
    mode: modeOf(options.eligible_statuses),
    eligible_case_count: eligibleCases.length,
    expected_observation_count: expected.size,
    received_observation_count: observations.length,
    matched_band_count: matchedBand,
    matched_semantic_count: matchedSemantic,
    expected_semantic_observation_count: expectedSemanticCount,
    band_accuracy: bandAccuracy,
    semantic_accuracy: semanticAccuracy,
    missing_observation_keys: missing,
    duplicate_observation_keys: [...duplicates],
    unknown_observation_keys: [...unknown],
    mismatches,
    thresholds: {
      minimum_band_accuracy: options.minimum_band_accuracy,
      minimum_semantic_accuracy: options.minimum_semantic_accuracy,
      require_complete_coverage: options.require_complete_coverage,
      require_semantic_labels: options.require_semantic_labels,
    },
    evaluation_purpose: "operational_gate_check",
    is_quality_measurement: false,
    interpretation_note_ko: GOLD_GATE_INTERPRETATION_KO,
  };
}

export function observationsFromExpectedLabels(
  goldCases: SeedGoldCase[],
  eligibleStatuses: GoldReviewStatus[],
): CandidateEvaluationObservation[] {
  return goldCases
    .filter((item) => eligibleStatuses.includes(item.review.status))
    .flatMap((item) =>
      item.candidates.map((candidate) => ({
        case_id: item.case_id,
        candidate_id: candidate.candidate_id,
        predicted_band_code: candidate.expected_band_code,
        ...(candidate.semantic_fidelity === "pending_researcher_review"
          ? {}
          : { predicted_semantic_fidelity: candidate.semantic_fidelity }),
      })),
    );
}

export const ENGINEERING_SEED_GATE: GoldRegressionOptions = {
  eligible_statuses: ["researcher_seed"],
  minimum_band_accuracy: 1,
  minimum_semantic_accuracy: 1,
  require_complete_coverage: true,
  require_semantic_labels: false,
};

export const EXPERT_RELEASE_GATE: GoldRegressionOptions = {
  eligible_statuses: ["expert_approved"],
  minimum_band_accuracy: 0.9,
  minimum_semantic_accuracy: 0.95,
  require_complete_coverage: true,
  require_semantic_labels: true,
};
