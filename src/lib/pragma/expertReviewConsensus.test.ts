import { describe, expect, it } from "vitest";

import { summarizeExpertReviews, type ExpertReviewSnapshot } from "./expertReviewConsensus";

const review = (
  review_id: string,
  reviewer_id: string,
  verdict: ExpertReviewSnapshot["verdict"],
  candidate_bands: Record<string, string>,
  lineage_claims?: ExpertReviewSnapshot["lineage_claims"],
): ExpertReviewSnapshot => ({
  review_id,
  reviewer_id,
  verdict,
  confidence: 4,
  candidate_bands,
  lineage_claims,
});

describe("expert review disagreement summary", () => {
  it("marks two independent matching reviews as unanimous", () => {
    const summary = summarizeExpertReviews([
      review("r1", "expert-a", "approve", { A: "too_direct", B: "within_band", C: "too_indirect" }),
      review("r2", "expert-b", "approve", { A: "too_direct", B: "within_band", C: "too_indirect" }),
    ]);

    expect(summary.status).toBe("unanimous");
    expect(summary.unanimous_verdict).toBe("approve");
    expect(summary.requires_human_resolution).toBe(false);
  });

  it("preserves candidate-level disagreement instead of auto-resolving it", () => {
    const summary = summarizeExpertReviews([
      review("r1", "expert-a", "approve", { A: "too_direct", B: "within_band" }),
      review("r2", "expert-b", "revise", { A: "within_band", B: "within_band" }),
    ]);

    expect(summary.status).toBe("disagreement");
    expect(summary.unanimous_verdict).toBeNull();
    expect(summary.candidate_disagreements).toEqual([
      {
        candidate_id: "A",
        judgments: [
          { reviewer_id: "expert-a", band_code: "too_direct" },
          { reviewer_id: "expert-b", band_code: "within_band" },
        ],
      },
    ]);
    expect(summary.requires_human_resolution).toBe(true);
  });

  it("does not count duplicate reviews from one expert as independent agreement", () => {
    const summary = summarizeExpertReviews([
      review("r1", "expert-a", "approve", { A: "within_band" }),
      review("r2", "expert-a", "approve", { A: "within_band" }),
    ]);

    expect(summary.status).toBe("insufficient_reviewers");
    expect(summary.duplicate_reviewer_ids).toEqual(["expert-a"]);
  });

  it("treats different claim verdicts or replacement IDs as explicit disagreement", () => {
    const summary = summarizeExpertReviews([
      review("r1", "expert-a", "revise", {}, {
        "ILC-001": { verdict: "revise", proposed_rule_ids: ["RR-A"], rationale_ko: "A 규칙" },
      }),
      review("r2", "expert-b", "revise", {}, {
        "ILC-001": { verdict: "revise", proposed_rule_ids: ["RR-B"], rationale_ko: "B 규칙" },
      }),
    ]);

    expect(summary.status).toBe("disagreement");
    expect(summary.lineage_claim_disagreements).toHaveLength(1);
    expect(summary.lineage_claim_disagreements[0].claim_id).toBe("ILC-001");
  });

  it("does not treat a missing claim assessment as agreement", () => {
    const summary = summarizeExpertReviews([
      review("r1", "expert-a", "approve", {}, {
        "ILC-001": { verdict: "support", rationale_ko: "연결 적절" },
      }),
      review("r2", "expert-b", "approve", {}, {}),
    ]);
    expect(summary.status).toBe("disagreement");
    expect(summary.lineage_claim_disagreements[0].judgments[1].assessment).toBeNull();
  });

  it("does not treat a missing candidate band as agreement", () => {
    const summary = summarizeExpertReviews([
      review("r1", "expert-a", "approve", { A: "within_band" }),
      review("r2", "expert-b", "approve", {}),
    ]);
    expect(summary.status).toBe("disagreement");
    expect(summary.candidate_disagreements[0]).toEqual({
      candidate_id: "A",
      judgments: [
        { reviewer_id: "expert-a", band_code: "within_band" },
        { reviewer_id: "expert-b", band_code: null },
      ],
    });
  });
});
