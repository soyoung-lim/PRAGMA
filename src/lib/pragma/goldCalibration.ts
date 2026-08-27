import { z } from "zod";

import {
  SeedGoldCaseSchema,
  type SeedGoldCase,
} from "@/lib/pragma/seedGoldSet";

export const GOLD_CALIBRATION_REVIEW_SCHEMA_VERSION = "pragma_gold_calibration_review_v1" as const;

const BandCodeSchema = z.enum([
  "too_direct",
  "within_band",
  "too_indirect",
  "too_blunt",
  "over_elaborate",
  "insufficient",
  "excessive",
]);

const CandidateAssessmentSchema = z.object({
  assessed_band_code: BandCodeSchema,
  semantic_fidelity: z.enum(["pass", "fail"]),
  rationale_ko: z.string().trim().min(1),
});

export const GoldCalibrationReviewSchema = z.object({
  schema_version: z.literal(GOLD_CALIBRATION_REVIEW_SCHEMA_VERSION),
  case_id: z.string().min(1),
  case_version: z.string().min(1),
  realization_pack_id: z.string().min(1),
  realization_pack_version: z.string().min(1),
  case_snapshot: SeedGoldCaseSchema,
  review_round: z.number().int().positive(),
  context_assessment: z.object({
    scenario_valid: z.boolean(),
    pdr_valid: z.boolean(),
    semantic_invariant_valid: z.boolean(),
  }),
  candidate_assessments: z.object({
    A: CandidateAssessmentSchema,
    B: CandidateAssessmentSchema,
    C: CandidateAssessmentSchema,
  }),
  overall_verdict: z.enum(["approve", "revise", "reject"]),
  rationale_ko: z.string().trim().min(1),
}).superRefine((review, ctx) => {
  const item = review.case_snapshot;
  const identityMatches =
    review.case_id === item.case_id &&
    review.case_version === item.version &&
    review.realization_pack_id === item.realization_pack_id &&
    review.realization_pack_version === item.realization_pack_version;
  if (!identityMatches) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "review identity가 case snapshot과 일치하지 않습니다." });
  }

  const allowedBands = new Set(item.candidates.map((candidate) => candidate.expected_band_code));
  for (const candidate of item.candidates) {
    const assessment = review.candidate_assessments[candidate.candidate_id];
    if (!allowedBands.has(assessment.assessed_band_code)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["candidate_assessments", candidate.candidate_id, "assessed_band_code"],
        message: `이 화행의 calibration 대역이 아닙니다: ${assessment.assessed_band_code}`,
      });
    }
  }

  if (review.overall_verdict === "approve") {
    const contextPass = Object.values(review.context_assessment).every(Boolean);
    const candidatesPass = item.candidates.every((candidate) => {
      const assessment = review.candidate_assessments[candidate.candidate_id];
      return assessment.semantic_fidelity === "pass"
        && assessment.assessed_band_code === candidate.expected_band_code;
    });
    if (!contextPass || !candidatesPass) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["overall_verdict"],
        message: "맥락·의미·대역 이견이 있는 review는 approve할 수 없습니다.",
      });
    }
  }
});

export type GoldCalibrationReview = z.infer<typeof GoldCalibrationReviewSchema>;
export type GoldCalibrationResolutionStatus = "researcher_approved" | "revise_required" | "rejected";

export function calibrationResolutionStatus(
  review: GoldCalibrationReview,
): GoldCalibrationResolutionStatus {
  const parsed = GoldCalibrationReviewSchema.parse(review);
  if (parsed.overall_verdict === "reject") return "rejected";
  if (parsed.overall_verdict === "revise") return "revise_required";
  return "researcher_approved";
}

export function buildResearcherApprovedCalibrationCase(
  review: GoldCalibrationReview,
  reviewerId: string,
): SeedGoldCase {
  const parsed = GoldCalibrationReviewSchema.parse(review);
  if (calibrationResolutionStatus(parsed) !== "researcher_approved") {
    throw new Error("researcher_approved review만 승인 calibration case를 만들 수 있습니다.");
  }

  return SeedGoldCaseSchema.parse({
    ...parsed.case_snapshot,
    candidates: parsed.case_snapshot.candidates.map((candidate) => ({
      ...candidate,
      semantic_fidelity: "pass",
    })),
    review: {
      status: "researcher_approved",
      researcher_reviewer_id: reviewerId,
      note_ko: parsed.rationale_ko,
    },
    provenance: {
      ...parsed.case_snapshot.provenance,
      supersedes_case_id: parsed.case_snapshot.case_id,
    },
  });
}

export function makeGoldCalibrationReview(input: Omit<
  GoldCalibrationReview,
  "schema_version" | "case_id" | "case_version" | "realization_pack_id" | "realization_pack_version" | "case_snapshot"
> & { caseSnapshot: SeedGoldCase }): GoldCalibrationReview {
  const { caseSnapshot, ...review } = input;
  return GoldCalibrationReviewSchema.parse({
    ...review,
    schema_version: GOLD_CALIBRATION_REVIEW_SCHEMA_VERSION,
    case_id: caseSnapshot.case_id,
    case_version: caseSnapshot.version,
    realization_pack_id: caseSnapshot.realization_pack_id,
    realization_pack_version: caseSnapshot.realization_pack_version,
    case_snapshot: caseSnapshot,
  });
}
