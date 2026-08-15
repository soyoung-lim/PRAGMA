export type ExpertVerdict = "approve" | "revise" | "reject";
export type LineageClaimVerdict = "support" | "revise" | "reject" | "uncertain";

export interface LineageClaimAssessment {
  verdict: LineageClaimVerdict;
  /** revise일 때 전문가가 제안한 대체 연결. support는 원 claim을 그대로 뜻한다. */
  proposed_rule_ids?: string[];
  proposed_risk_ids?: string[];
  rationale_ko: string;
}

export interface ExpertReviewSnapshot {
  review_id: string;
  reviewer_id: string;
  verdict: ExpertVerdict;
  confidence: 1 | 2 | 3 | 4 | 5;
  candidate_bands: Record<string, string>;
  lineage_claims?: Record<string, LineageClaimAssessment>;
}

export interface CandidateDisagreement {
  candidate_id: string;
  judgments: { reviewer_id: string; band_code: string | null }[];
}

export interface LineageClaimDisagreement {
  claim_id: string;
  judgments: Array<{
    reviewer_id: string;
    assessment: LineageClaimAssessment | null;
  }>;
}

export interface ExpertReviewSummary {
  status: "insufficient_reviewers" | "unanimous" | "disagreement";
  reviewer_count: number;
  duplicate_reviewer_ids: string[];
  unanimous_verdict: ExpertVerdict | null;
  verdict_counts: Record<ExpertVerdict, number>;
  candidate_disagreements: CandidateDisagreement[];
  lineage_claim_disagreements: LineageClaimDisagreement[];
  /** Deliberately never resolves disagreement automatically. */
  requires_human_resolution: boolean;
}

export function summarizeExpertReviews(
  reviews: ExpertReviewSnapshot[],
): ExpertReviewSummary {
  const reviewerCounts = new Map<string, number>();
  const verdictCounts: Record<ExpertVerdict, number> = {
    approve: 0,
    revise: 0,
    reject: 0,
  };
  for (const review of reviews) {
    reviewerCounts.set(review.reviewer_id, (reviewerCounts.get(review.reviewer_id) ?? 0) + 1);
    verdictCounts[review.verdict] += 1;
  }
  const duplicateReviewerIds = [...reviewerCounts]
    .filter(([, count]) => count > 1)
    .map(([reviewerId]) => reviewerId);

  const candidateIds = new Set(reviews.flatMap((review) => Object.keys(review.candidate_bands)));
  const candidateDisagreements: CandidateDisagreement[] = [];
  for (const candidateId of candidateIds) {
    const judgments = reviews.map((review) => ({
      reviewer_id: review.reviewer_id,
      band_code: review.candidate_bands[candidateId] ?? null,
    }));
    if (
      judgments.some((judgment) => judgment.band_code === null)
      || new Set(judgments.map((judgment) => judgment.band_code)).size > 1
    ) {
      candidateDisagreements.push({ candidate_id: candidateId, judgments });
    }
  }

  const claimIds = new Set(
    reviews.flatMap((review) => Object.keys(review.lineage_claims ?? {})),
  );
  const lineageClaimDisagreements: LineageClaimDisagreement[] = [];
  for (const claimId of claimIds) {
    const judgments = reviews.map((review) => ({
      reviewer_id: review.reviewer_id,
      assessment: review.lineage_claims?.[claimId] ?? null,
    }));
    const signatures = judgments.map(({ assessment }) =>
      assessment
        ? JSON.stringify({
            verdict: assessment.verdict,
            proposed_rule_ids: [...(assessment.proposed_rule_ids ?? [])].sort(),
            proposed_risk_ids: [...(assessment.proposed_risk_ids ?? [])].sort(),
          })
        : "__missing__",
    );
    if (new Set(signatures).size > 1 || signatures.includes("__missing__")) {
      lineageClaimDisagreements.push({ claim_id: claimId, judgments });
    }
  }

  const verdicts = new Set(reviews.map((review) => review.verdict));
  const enoughIndependentReviewers = reviewerCounts.size >= 2 && duplicateReviewerIds.length === 0;
  const unanimous =
    enoughIndependentReviewers &&
    verdicts.size === 1 &&
    candidateDisagreements.length === 0 &&
    lineageClaimDisagreements.length === 0;
  const status: ExpertReviewSummary["status"] = !enoughIndependentReviewers
    ? "insufficient_reviewers"
    : unanimous
      ? "unanimous"
      : "disagreement";

  return {
    status,
    reviewer_count: reviewerCounts.size,
    duplicate_reviewer_ids: duplicateReviewerIds,
    unanimous_verdict: unanimous ? reviews[0]?.verdict ?? null : null,
    verdict_counts: verdictCounts,
    candidate_disagreements: candidateDisagreements,
    lineage_claim_disagreements: lineageClaimDisagreements,
    requires_human_resolution: status !== "unanimous",
  };
}
