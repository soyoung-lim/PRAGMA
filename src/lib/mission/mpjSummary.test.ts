import { describe, expect, it } from "vitest";

import {
  buildMpjSummaryRows,
  MPJ_SUMMARY_DIVERGENCE_COPY,
} from "@/lib/mission/mpjSummary";
import type { MpjResponseTrace } from "@/lib/mission/missionAttemptRow";
import { SAMPLE_MISSION_V4 } from "@/lib/mission/missionV4Sample";
import type { MissionRuntime } from "@/lib/pragma/missionSchema";
import {
  FEATURE_CODES_BY_ACT,
  TARGET_FEATURES,
} from "@/lib/pragma/targetFeatures";

const APPROVED_FEATURE_CODES = [...new Set(Object.values(FEATURE_CODES_BY_ACT).flat())];
const NOW = "2026-07-29T00:00:00.000Z";

function missionFor(
  featureCode: string,
  mode: "translation" | "interpreting" = "translation",
): MissionRuntime {
  const feature = TARGET_FEATURES[featureCode];
  const lowCode = feature.band_schema[0].code;
  const highCode = feature.band_schema[feature.band_schema.length - 1].code;
  const withinCode = feature.within_band_code;

  const mpjItems = SAMPLE_MISSION_V4.mpj_items.map((item) => {
    const common = { ...item, axis_feature: featureCode };
    switch (item.type) {
      case "scale4":
        return common;
      case "fix_choice":
        return { ...common, accepted_band_codes: [lowCode] };
      case "reason":
        return { ...common, problem_band_code: lowCode };
      case "multi_judge":
        return {
          ...common,
          candidates: item.candidates.map((candidate, index) => ({
            ...candidate,
            accepted_band_codes: [
              index === 1 || index === 2
                ? withinCode
                : index === 3
                  ? highCode
                  : lowCode,
            ],
          })),
        };
    }
  });

  return {
    ...SAMPLE_MISSION_V4,
    unit: {
      ...SAMPLE_MISSION_V4.unit,
      target_feature: featureCode,
      target_feature_version: feature.version,
      learner_label: feature.learner_label,
      closing_ko: feature.closing_principle_ko,
    },
    mpj_items: mpjItems,
    production_task: {
      ...SAMPLE_MISSION_V4.production_task,
      mode,
      source_modality: mode === "interpreting" ? "spoken" : "written",
      vocabulary_hints:
        mode === "interpreting" ? [] : SAMPLE_MISSION_V4.production_task.vocabulary_hints,
    },
  } as MissionRuntime;
}

function correctResponses(mission: MissionRuntime, worstBand: "low" | "high"): MpjResponseTrace[] {
  const feature = TARGET_FEATURES[mission.unit.target_feature];
  const lowCode = feature.band_schema[0].code;
  const highCode = feature.band_schema[feature.band_schema.length - 1].code;

  return mission.mpj_items.map((item) => {
    const base = { item_id: item.id, item_type: item.type, completed_at: NOW };
    switch (item.type) {
      case "scale4":
        return { ...base, scale_code: item.accepted_scale_codes[0] };
      case "judge3":
        return { ...base, band_code: item.accepted_band_codes[0] };
      case "fix_choice":
        return {
          ...base,
          band_code: item.accepted_band_codes[0],
          correction_indexes: item.corrections
            .map((correction, index) => (correction.is_valid ? index : -1))
            .filter((index) => index >= 0),
        };
      case "reason":
        return { ...base, reason_id: item.accepted_reason_id };
      case "reason_conf":
        return { ...base, reason_ids: [...item.accepted_reason_ids] };
      case "multi_judge": {
        const bestIndex = item.candidates.findIndex((candidate) =>
          candidate.accepted_band_codes.includes(feature.within_band_code),
        );
        const worstCode = worstBand === "low" ? lowCode : highCode;
        const worstIndex = item.candidates.findIndex((candidate) =>
          candidate.accepted_band_codes.includes(worstCode),
        );
        return {
          ...base,
          best_candidate_index: bestIndex,
          worst_candidate_index: worstIndex,
        };
      }
    }
  });
}

describe("MPJ handoff summary generalization", () => {
  it("uses feature-specific learning concepts for every approved feature", () => {
    for (const featureCode of APPROVED_FEATURE_CODES) {
      const mission = missionFor(featureCode);
      const rows = buildMpjSummaryRows(mission, correctResponses(mission, "low"));
      const summary = TARGET_FEATURES[featureCode].handoff_summary;

      expect(rows.map((row) => row.label), featureCode).toEqual([
        "첫인상 판단",
        "판단하고 고쳐보기",
        "이유 찾기",
        "여러 초안 비교",
      ]);
      expect(rows.map((row) => row.comment), featureCode).toEqual([
        summary.first_impression,
        summary.correction,
        summary.reason,
        summary.compare_low,
      ]);
    }
  });

  it("distinguishes the low and high comparison concepts for every approved feature", () => {
    for (const featureCode of APPROVED_FEATURE_CODES) {
      const mission = missionFor(featureCode);
      const rows = buildMpjSummaryRows(mission, correctResponses(mission, "high"));
      expect(rows[3].comment, featureCode).toBe(
        TARGET_FEATURES[featureCode].handoff_summary.compare_high,
      );
    }
  });

  it("does not invent successful learning when the learner response differs", () => {
    const mission = missionFor("request_mitigation_optionality");
    const responses: MpjResponseTrace[] = mission.mpj_items.map((item) => {
      const base = { item_id: item.id, item_type: item.type, completed_at: NOW };
      switch (item.type) {
        case "scale4":
          return { ...base, scale_code: "very_inappropriate" };
        case "judge3":
          return { ...base, band_code: "within_band" };
        case "fix_choice":
          return { ...base, band_code: "within_band", correction_indexes: [2, 3] };
        case "reason":
          return { ...base, reason_id: "not-the-reference" };
        case "reason_conf":
          return { ...base, reason_ids: ["not-the-reference"] };
        case "multi_judge":
          return { ...base, best_candidate_index: 0, worst_candidate_index: 1 };
      }
    });

    expect(buildMpjSummaryRows(mission, responses).map((row) => row.comment)).toEqual([
      MPJ_SUMMARY_DIVERGENCE_COPY,
      MPJ_SUMMARY_DIVERGENCE_COPY,
      MPJ_SUMMARY_DIVERGENCE_COPY,
      MPJ_SUMMARY_DIVERGENCE_COPY,
    ]);
  });

  it("keeps the same concept summary across translation and interpreting modes", () => {
    for (const featureCode of APPROVED_FEATURE_CODES) {
      const translation = missionFor(featureCode, "translation");
      const interpreting = missionFor(featureCode, "interpreting");

      expect(
        buildMpjSummaryRows(translation, correctResponses(translation, "low")),
        featureCode,
      ).toEqual(buildMpjSummaryRows(interpreting, correctResponses(interpreting, "low")));
    }
  });
});
