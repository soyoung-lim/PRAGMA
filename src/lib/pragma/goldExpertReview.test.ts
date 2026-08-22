import { describe, expect, it } from "vitest";

import {
  GoldExpertResolutionSchema,
  buildExpertApprovedGoldCase,
  makeBlindGoldCaseSnapshot,
  makeGoldExpertReview,
} from "./goldExpertReview";
import {
  buildResearcherApprovedCalibrationCase,
  makeGoldCalibrationReview,
} from "./goldCalibration";
import { SEED_GOLD_CASES } from "./seedGoldSet";

const researcher = "00000000-0000-4000-8000-000000000000";
const expert1 = "00000000-0000-4000-8000-000000000001";
const expert2 = "00000000-0000-4000-8000-000000000002";
const assignment1 = "10000000-0000-4000-8000-000000000001";
const calibrationResolutionId = "20000000-0000-4000-8000-000000000001";
const reviewId1 = "30000000-0000-4000-8000-000000000001";
const reviewId2 = "30000000-0000-4000-8000-000000000002";

const seed = SEED_GOLD_CASES[0];
const researcherReview = makeGoldCalibrationReview({
  caseSnapshot: seed,
  review_round: 1,
  context_assessment: {
    scenario_valid: true,
    pdr_valid: true,
    semantic_invariant_valid: true,
  },
  candidate_assessments: Object.fromEntries(seed.candidates.map((candidate) => [
    candidate.candidate_id,
    {
      assessed_band_code: candidate.expected_band_code,
      semantic_fidelity: "pass",
      rationale_ko: "연구자 독립 판정",
    },
  ])) as ReturnType<typeof makeGoldCalibrationReview>["candidate_assessments"],
  overall_verdict: "approve",
  rationale_ko: "연구자 승인",
});
const researcherApproved = buildResearcherApprovedCalibrationCase(researcherReview, researcher);
const blindSnapshot = makeBlindGoldCaseSnapshot(researcherApproved);

const candidateAssessments = Object.fromEntries(researcherApproved.candidates.map((candidate) => [
  candidate.candidate_id,
  {
    assessed_band_code: candidate.expected_band_code,
    semantic_fidelity: "pass" as const,
    rationale_ko: "외부 전문가 독립 판정",
  },
])) as {
  A: { assessed_band_code: typeof researcherApproved.candidates[number]["expected_band_code"]; semantic_fidelity: "pass"; rationale_ko: string };
  B: { assessed_band_code: typeof researcherApproved.candidates[number]["expected_band_code"]; semantic_fidelity: "pass"; rationale_ko: string };
  C: { assessed_band_code: typeof researcherApproved.candidates[number]["expected_band_code"]; semantic_fidelity: "pass"; rationale_ko: string };
};

describe("Gold external expert review", () => {
  it("requires the exact blind independence declaration", () => {
    expect(() => makeGoldExpertReview({
      assignment_id: assignment1,
      calibration_resolution_id: calibrationResolutionId,
      reviewer_user_id: expert1,
      review_round: 1,
      case_snapshot: blindSnapshot,
      independence_declaration: {
        reviewed_independently: true,
        conflict_of_interest: true as false,
        chinese_proficiency_confirmed: true,
      },
      context_assessment: { scenario_valid: true, pdr_valid: true, semantic_invariant_valid: true },
      candidate_assessments: candidateAssessments,
      overall_verdict: "approve",
      rationale_ko: "독립 검토",
    })).toThrow();
  });

  it("does not allow approve when a candidate meaning fails", () => {
    expect(() => makeGoldExpertReview({
      assignment_id: assignment1,
      calibration_resolution_id: calibrationResolutionId,
      reviewer_user_id: expert1,
      review_round: 1,
      case_snapshot: blindSnapshot,
      independence_declaration: {
        reviewed_independently: true,
        conflict_of_interest: false,
        chinese_proficiency_confirmed: true,
      },
      context_assessment: { scenario_valid: true, pdr_valid: true, semantic_invariant_valid: true },
      candidate_assessments: {
        ...candidateAssessments,
        A: { ...candidateAssessments.A, semantic_fidelity: "fail" },
      },
      overall_verdict: "approve",
      rationale_ko: "의미 이견",
    })).toThrow(/approve/);
  });

  it("requires two distinct experts in a resolved result", () => {
    expect(() => GoldExpertResolutionSchema.parse({
      schema_version: "pragma_gold_expert_resolution_v1",
      protocol_version: "gold_expert_review_protocol_v1",
      calibration_resolution_id: calibrationResolutionId,
      review_round: 1,
      review_ids: [reviewId1, reviewId2],
      reviewer_user_ids: [expert1, expert1],
      resolution_method: "unanimous",
      final_status: "expert_approved",
      resolved_context_assessment: { scenario_valid: true, pdr_valid: true, semantic_invariant_valid: true },
      resolved_candidate_assessments: candidateAssessments,
      rationale_ko: "두 전문가 일치",
    })).toThrow(/중복/);
  });

  it("does not let a researcher-only decision create expert_approved Gold", () => {
    expect(() => GoldExpertResolutionSchema.parse({
      schema_version: "pragma_gold_expert_resolution_v1",
      protocol_version: "gold_expert_review_protocol_v1",
      calibration_resolution_id: calibrationResolutionId,
      review_round: 1,
      review_ids: [reviewId1, reviewId2],
      reviewer_user_ids: [expert1, expert2],
      resolution_method: "researcher_decision",
      final_status: "expert_approved",
      resolved_context_assessment: { scenario_valid: true, pdr_valid: true, semantic_invariant_valid: true },
      resolved_candidate_assessments: candidateAssessments,
      rationale_ko: "연구자 단독 결정",
    })).toThrow(/전문가 일치/);
  });

  it("builds a new expert-approved snapshot without overwriting the researcher snapshot", () => {
    const resolution = GoldExpertResolutionSchema.parse({
      schema_version: "pragma_gold_expert_resolution_v1",
      protocol_version: "gold_expert_review_protocol_v1",
      calibration_resolution_id: calibrationResolutionId,
      review_round: 1,
      review_ids: [reviewId1, reviewId2],
      reviewer_user_ids: [expert1, expert2],
      resolution_method: "unanimous",
      final_status: "expert_approved",
      resolved_context_assessment: { scenario_valid: true, pdr_valid: true, semantic_invariant_valid: true },
      resolved_candidate_assessments: candidateAssessments,
      rationale_ko: "독립 전문가 2인 일치",
    });
    const approved = buildExpertApprovedGoldCase(researcherApproved, resolution, [
      { reviewer_user_id: expert1, overall_verdict: "approve", rationale_ko: "전문가 1", submitted_at: "2026-08-15T00:00:00.000Z" },
      { reviewer_user_id: expert2, overall_verdict: "approve", rationale_ko: "전문가 2", submitted_at: "2026-08-15T00:01:00.000Z" },
    ]);

    expect(researcherApproved.review.status).toBe("researcher_approved");
    expect(approved.review.status).toBe("expert_approved");
    expect(approved.review.expert_reviews).toHaveLength(2);
  });

  it("removes expected labels, rationales, and references from the expert snapshot", () => {
    const serialized = JSON.stringify(blindSnapshot);
    expect(serialized).not.toContain("expected_band_code");
    expect(serialized).not.toContain("rationale_ko");
    expect(serialized).not.toContain("references");
    expect(serialized).not.toContain("researcher_approved");
  });
});
