import { z } from "zod";

import {
  SeedGoldCaseSchema,
  type SeedGoldCase,
} from "@/lib/pragma/seedGoldSet";

export const GOLD_EXPERT_REVIEW_PROTOCOL_VERSION = "gold_expert_review_protocol_v1" as const;
export const GOLD_EXPERT_REVIEW_SCHEMA_VERSION = "pragma_gold_expert_review_v1" as const;
export const GOLD_EXPERT_RESOLUTION_SCHEMA_VERSION = "pragma_gold_expert_resolution_v1" as const;

export const GoldBandCodeSchema = z.enum([
  "too_direct",
  "within_band",
  "too_indirect",
  "too_blunt",
  "over_elaborate",
  "insufficient",
  "excessive",
]);

const GoldContextAssessmentSchema = z.object({
  scenario_valid: z.boolean(),
  pdr_valid: z.boolean(),
  semantic_invariant_valid: z.boolean(),
}).strict();

const GoldCandidateAssessmentSchema = z.object({
  assessed_band_code: GoldBandCodeSchema,
  semantic_fidelity: z.enum(["pass", "fail"]),
  rationale_ko: z.string().trim().min(1),
}).strict();

const GoldCandidateAssessmentsSchema = z.object({
  A: GoldCandidateAssessmentSchema,
  B: GoldCandidateAssessmentSchema,
  C: GoldCandidateAssessmentSchema,
}).strict();

const GoldExpertIndependenceSchema = z.object({
  reviewed_independently: z.literal(true),
  conflict_of_interest: z.literal(false),
  chinese_proficiency_confirmed: z.literal(true),
}).strict();

export const BlindGoldCaseSnapshotSchema = z.object({
  schema_version: z.literal("pragma_gold_expert_blind_case_v1"),
  case_id: z.string().min(1),
  version: z.string().min(1),
  direction: z.literal("ko_zh"),
  realization_pack_id: z.string().min(1),
  realization_pack_version: z.string().min(1),
  speech_act: z.enum(["request", "refusal", "thanks"]),
  target_feature: z.string().min(1),
  level: z.enum(["beginner_intermediate", "intermediate", "advanced"]),
  domain: z.enum(["daily", "school", "work"]),
  mode: z.enum(["translation", "stt_interpreting"]),
  pdr: z.object({
    power: z.enum(["higher", "equal", "lower"]),
    distance: z.enum(["close", "acquaintance", "formal"]),
    burden: z.enum(["low", "mid", "high"]),
  }).strict(),
  scenario_ko: z.string().min(1),
  source_text_ko: z.string().min(1),
  preceding_turn_zh: z.string().min(1).nullable(),
  semantic_invariant_ko: z.string().min(1),
  candidates: z.array(z.object({
    candidate_id: z.enum(["A", "B", "C"]),
    text_zh: z.string().min(1),
  }).strict()).length(3),
}).strict().superRefine((snapshot, ctx) => {
  const ids = snapshot.candidates.map((candidate) => candidate.candidate_id);
  if (new Set(ids).size !== 3) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["candidates"], message: "blind snapshot에는 A/B/C가 한 번씩 필요합니다." });
  }
});

export type BlindGoldCaseSnapshot = z.infer<typeof BlindGoldCaseSnapshotSchema>;

export const GoldExpertReviewSchema = z.object({
  schema_version: z.literal(GOLD_EXPERT_REVIEW_SCHEMA_VERSION),
  protocol_version: z.literal(GOLD_EXPERT_REVIEW_PROTOCOL_VERSION),
  assignment_id: z.string().uuid(),
  calibration_resolution_id: z.string().uuid(),
  reviewer_user_id: z.string().uuid(),
  review_round: z.number().int().positive(),
  blind_review: z.literal(true),
  case_snapshot: BlindGoldCaseSnapshotSchema,
  independence_declaration: GoldExpertIndependenceSchema,
  context_assessment: GoldContextAssessmentSchema,
  candidate_assessments: GoldCandidateAssessmentsSchema,
  overall_verdict: z.enum(["approve", "revise", "reject"]),
  rationale_ko: z.string().trim().min(1),
}).superRefine((review, ctx) => {
  if (review.overall_verdict === "approve") {
    const contextPass = Object.values(review.context_assessment).every(Boolean);
    const semanticPass = Object.values(review.candidate_assessments)
      .every((candidate) => candidate.semantic_fidelity === "pass");
    if (!contextPass || !semanticPass) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["overall_verdict"],
        message: "맥락 또는 의미 이견이 있는 expert review는 approve할 수 없습니다.",
      });
    }
  }
});

export type GoldExpertReview = z.infer<typeof GoldExpertReviewSchema>;

export const GoldExpertResolutionSchema = z.object({
  schema_version: z.literal(GOLD_EXPERT_RESOLUTION_SCHEMA_VERSION),
  protocol_version: z.literal(GOLD_EXPERT_REVIEW_PROTOCOL_VERSION),
  calibration_resolution_id: z.string().uuid(),
  review_round: z.number().int().positive(),
  review_ids: z.array(z.string().uuid()).min(2),
  reviewer_user_ids: z.array(z.string().uuid()).min(2),
  resolution_method: z.enum([
    "unanimous",
    "consensus_after_discussion",
    "researcher_decision",
    "unresolved",
  ]),
  final_status: z.enum([
    "expert_approved",
    "revise_required",
    "rejected",
    "unresolved",
  ]),
  resolved_context_assessment: GoldContextAssessmentSchema.nullable(),
  resolved_candidate_assessments: GoldCandidateAssessmentsSchema.nullable(),
  rationale_ko: z.string().trim().min(1),
}).superRefine((resolution, ctx) => {
  if (new Set(resolution.review_ids).size !== resolution.review_ids.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["review_ids"], message: "review ID는 중복될 수 없습니다." });
  }
  if (new Set(resolution.reviewer_user_ids).size !== resolution.reviewer_user_ids.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["reviewer_user_ids"],
      message: "독립 전문가 ID는 중복될 수 없습니다.",
    });
  }

  const unresolved = resolution.final_status === "unresolved";
  if (unresolved !== (resolution.resolution_method === "unresolved")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["final_status"],
      message: "unresolved 상태와 해결 방식은 함께 사용해야 합니다.",
    });
  }
  if (unresolved) {
    if (resolution.resolved_context_assessment || resolution.resolved_candidate_assessments) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "미해결 resolution에는 최종 맥락·후보 판정을 저장할 수 없습니다.",
      });
    }
    return;
  }
  if (!resolution.resolved_context_assessment || !resolution.resolved_candidate_assessments) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "해결된 resolution에는 완전한 맥락·후보 판정이 필요합니다.",
    });
    return;
  }

  if (resolution.final_status === "expert_approved") {
    if (
      resolution.resolution_method !== "unanimous"
      && resolution.resolution_method !== "consensus_after_discussion"
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["resolution_method"],
        message: "expert_approved는 전문가 일치 또는 서명된 토론 합의로만 확정할 수 있습니다.",
      });
    }
    const contextPass = Object.values(resolution.resolved_context_assessment).every(Boolean);
    const semanticPass = Object.values(resolution.resolved_candidate_assessments)
      .every((candidate) => candidate.semantic_fidelity === "pass");
    if (!contextPass || !semanticPass) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["final_status"],
        message: "expert_approved에는 모든 맥락 gate와 의미 충실성 pass가 필요합니다.",
      });
    }
  }
});

export type GoldExpertResolution = z.infer<typeof GoldExpertResolutionSchema>;

export function makeGoldExpertReview(input: Omit<
  GoldExpertReview,
  "schema_version" | "protocol_version" | "blind_review"
>): GoldExpertReview {
  return GoldExpertReviewSchema.parse({
    ...input,
    schema_version: GOLD_EXPERT_REVIEW_SCHEMA_VERSION,
    protocol_version: GOLD_EXPERT_REVIEW_PROTOCOL_VERSION,
    blind_review: true,
  });
}

export function makeBlindGoldCaseSnapshot(
  researcherApprovedCase: SeedGoldCase,
): BlindGoldCaseSnapshot {
  const source = SeedGoldCaseSchema.parse(researcherApprovedCase);
  if (source.review.status !== "researcher_approved") {
    throw new Error("researcher_approved Gold만 blind expert snapshot으로 만들 수 있습니다.");
  }
  return BlindGoldCaseSnapshotSchema.parse({
    schema_version: "pragma_gold_expert_blind_case_v1",
    case_id: source.case_id,
    version: source.version,
    direction: source.direction,
    realization_pack_id: source.realization_pack_id,
    realization_pack_version: source.realization_pack_version,
    speech_act: source.speech_act,
    target_feature: source.target_feature,
    level: source.level,
    domain: source.domain,
    mode: source.mode,
    pdr: source.pdr,
    scenario_ko: source.scenario_ko,
    source_text_ko: source.source_text_ko,
    preceding_turn_zh: source.preceding_turn_zh,
    semantic_invariant_ko: source.semantic_invariant_ko,
    candidates: source.candidates.map(({ candidate_id, text_zh }) => ({ candidate_id, text_zh })),
  });
}

export function buildExpertApprovedGoldCase(
  researcherApprovedCase: SeedGoldCase,
  resolution: GoldExpertResolution,
  reviews: Array<Pick<GoldExpertReview, "reviewer_user_id" | "overall_verdict" | "rationale_ko"> & {
    submitted_at: string;
  }>,
): SeedGoldCase {
  const source = SeedGoldCaseSchema.parse(researcherApprovedCase);
  const parsed = GoldExpertResolutionSchema.parse(resolution);
  if (source.review.status !== "researcher_approved" || parsed.final_status !== "expert_approved") {
    throw new Error("researcher_approved case와 expert_approved resolution이 필요합니다.");
  }
  if (!parsed.resolved_candidate_assessments) {
    throw new Error("expert_approved resolution에 최종 후보 판정이 없습니다.");
  }

  const expectedReviewers = new Set(parsed.reviewer_user_ids);
  const suppliedReviewers = new Set(reviews.map((review) => review.reviewer_user_id));
  if (
    expectedReviewers.size !== suppliedReviewers.size
    || [...expectedReviewers].some((reviewerId) => !suppliedReviewers.has(reviewerId))
  ) {
    throw new Error("resolution에 포함된 모든 독립 전문가 review가 필요합니다.");
  }

  return SeedGoldCaseSchema.parse({
    ...source,
    candidates: source.candidates.map((candidate) => ({
      ...candidate,
      expected_band_code:
        parsed.resolved_candidate_assessments![candidate.candidate_id].assessed_band_code,
      semantic_fidelity:
        parsed.resolved_candidate_assessments![candidate.candidate_id].semantic_fidelity,
    })),
    review: {
      ...source.review,
      status: "expert_approved",
      expert_reviews: reviews.map((review) => ({
        reviewer_id: review.reviewer_user_id,
        verdict: review.overall_verdict,
        reviewed_at: review.submitted_at,
        note_ko: review.rationale_ko,
      })),
      note_ko: parsed.rationale_ko,
    },
    provenance: {
      ...source.provenance,
      supersedes_case_id: source.case_id,
    },
  });
}
