import { describe, expect, it } from "vitest";

import { SEED_GOLD_CASES } from "./seedGoldSet";
import {
  GoldCalibrationReviewSchema,
  buildResearcherApprovedCalibrationCase,
  calibrationResolutionStatus,
  makeGoldCalibrationReview,
} from "./goldCalibration";

const seed = SEED_GOLD_CASES[0];

const validReview = () => makeGoldCalibrationReview({
  caseSnapshot: seed,
  review_round: 1,
  context_assessment: {
    scenario_valid: true,
    pdr_valid: true,
    semantic_invariant_valid: true,
  },
  candidate_assessments: Object.fromEntries(
    seed.candidates.map((candidate) => [candidate.candidate_id, {
      assessed_band_code: candidate.expected_band_code,
      semantic_fidelity: "pass",
      rationale_ko: "맥락과 의미를 유지하며 해당 대역을 실현함",
    }]),
  ) as ReturnType<typeof makeGoldCalibrationReview>["candidate_assessments"],
  overall_verdict: "approve",
  rationale_ko: "세 후보의 의미와 대역을 확인함",
});

describe("Gold calibration review", () => {
  it("approves only a complete context, semantic, and band-aligned review", () => {
    const review = validReview();
    expect(calibrationResolutionStatus(review)).toBe("researcher_approved");
    const approved = buildResearcherApprovedCalibrationCase(
      review,
      "researcher-1",
    );
    expect(approved.review.status).toBe("researcher_approved");
    expect(approved.candidates.every((candidate) => candidate.semantic_fidelity === "pass")).toBe(true);
  });

  it("rejects approve when a candidate meaning or expected band is disputed", () => {
    const semanticDispute = structuredClone(validReview());
    semanticDispute.candidate_assessments.A.semantic_fidelity = "fail";
    expect(GoldCalibrationReviewSchema.safeParse(semanticDispute).success).toBe(false);

    const bandDispute = structuredClone(validReview());
    bandDispute.candidate_assessments.A.assessed_band_code = seed.candidates[1].expected_band_code;
    expect(GoldCalibrationReviewSchema.safeParse(bandDispute).success).toBe(false);
  });

  it("preserves disagreement as revise_required instead of silently changing the seed", () => {
    const review = structuredClone(validReview());
    review.overall_verdict = "revise";
    review.context_assessment.pdr_valid = false;
    review.candidate_assessments.A.assessed_band_code = seed.candidates[1].expected_band_code;
    const parsed = GoldCalibrationReviewSchema.parse(review);
    expect(calibrationResolutionStatus(parsed)).toBe("revise_required");
    expect(() => buildResearcherApprovedCalibrationCase(
      parsed,
      "researcher-1",
    )).toThrow(/researcher_approved/);
  });
});
