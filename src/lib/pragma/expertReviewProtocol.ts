import { z } from "zod";

import { ItemLineageSchema, type ItemLineage } from "@/lib/pragma/itemLineage";

export const EXPERT_REVIEW_PROTOCOL_VERSION = "expert_review_protocol_v1" as const;
export const MISSION_EXPERT_REVIEW_SCHEMA_VERSION = "mission_expert_review_v2" as const;

export const ExpertBandCodeSchema = z.enum([
  "too_direct",
  "within_band",
  "too_indirect",
  "too_blunt",
  "over_elaborate",
  "insufficient",
  "excessive",
  "uncertain",
]);

export const ExpertCandidateBandAssessmentSchema = z.object({
  band_code: ExpertBandCodeSchema,
  rationale_ko: z.string().trim().min(1),
});

export const ExpertLineageClaimAssessmentSchema = z.object({
  verdict: z.enum(["support", "revise", "reject", "uncertain"]),
  proposed_rule_ids: z.array(z.string().min(1)).default([]),
  proposed_risk_ids: z.array(z.string().min(1)).default([]),
  rationale_ko: z.string().trim().min(1),
}).superRefine((assessment, ctx) => {
  const proposedCount = assessment.proposed_rule_ids.length + assessment.proposed_risk_ids.length;
  if (assessment.verdict === "revise" && proposedCount === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "revise에는 대체 rule/risk ID가 필요합니다." });
  }
  if (assessment.verdict !== "revise" && proposedCount > 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "대체 ID는 revise 판정에만 기록할 수 있습니다." });
  }
});

export const ExpertIndependenceDeclarationSchema = z.object({
  reviewed_independently: z.literal(true),
  conflict_of_interest: z.literal(false),
  chinese_proficiency_confirmed: z.literal(true),
});

const ExpertRuleFindingSchema = z.object({
  kind: z.enum(["missing_rule", "overbroad_rule", "unsupported_rule", "language_issue", "other"]),
  rule_or_risk_id: z.string().min(1).nullable(),
  rationale_ko: z.string().trim().min(1),
});

export const MissionExpertReviewSubmissionSchema = z.object({
  schema_version: z.literal(MISSION_EXPERT_REVIEW_SCHEMA_VERSION),
  protocol_version: z.literal(EXPERT_REVIEW_PROTOCOL_VERSION),
  assignment_id: z.string().uuid(),
  lineage_version_id: z.string().uuid(),
  reviewer_user_id: z.string().uuid(),
  review_round: z.number().int().positive(),
  independence_declaration: ExpertIndependenceDeclarationSchema,
  overall_verdict: z.enum(["approve", "revise", "reject"]),
  confidence: z.number().int().min(1).max(5),
  candidate_band_assessments: z.record(ExpertCandidateBandAssessmentSchema),
  rule_findings: z.array(ExpertRuleFindingSchema),
  lineage_claim_assessments: z.record(ExpertLineageClaimAssessmentSchema),
  rationale_ko: z.string().trim().min(1),
});

export type MissionExpertReviewSubmission = z.infer<typeof MissionExpertReviewSubmissionSchema>;

export interface MissionExpertAssignmentSnapshot {
  id: string;
  lineage_version_id: string;
  reviewer_user_id: string;
  review_round: number;
  protocol_version: string;
  blind_review: boolean;
}

export interface MissionExpertLineageSnapshot {
  id: string;
  item_lineage: ItemLineage;
  rule_scope_ids: string[];
  risk_scope_ids: string[];
  mission_content: Record<string, unknown>;
}

function exactKeyCoverage(actual: Record<string, unknown>, expected: string[]): boolean {
  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = [...expected].sort();
  return actualKeys.length === expectedKeys.length
    && actualKeys.every((key, index) => key === expectedKeys[index]);
}

export function makeMissionExpertReviewSubmission(input: {
  assignment: MissionExpertAssignmentSnapshot;
  lineage: MissionExpertLineageSnapshot;
  reviewerUserId: string;
  independenceDeclaration: MissionExpertReviewSubmission["independence_declaration"];
  overallVerdict: MissionExpertReviewSubmission["overall_verdict"];
  confidence: number;
  candidateBandAssessments: MissionExpertReviewSubmission["candidate_band_assessments"];
  ruleFindings?: MissionExpertReviewSubmission["rule_findings"];
  lineageClaimAssessments: MissionExpertReviewSubmission["lineage_claim_assessments"];
  rationaleKo: string;
}): MissionExpertReviewSubmission {
  const lineage = ItemLineageSchema.parse(input.lineage.item_lineage);
  if (
    input.assignment.lineage_version_id !== input.lineage.id
    || input.assignment.reviewer_user_id !== input.reviewerUserId
    || input.assignment.protocol_version !== EXPERT_REVIEW_PROTOCOL_VERSION
    || !input.assignment.blind_review
  ) {
    throw new Error("배정·lineage·검토자·blind protocol이 일치하지 않습니다.");
  }

  const claimIds = lineage.claims.map((claim) => claim.claim_id);
  if (!exactKeyCoverage(input.candidateBandAssessments, claimIds)) {
    throw new Error("모든 item-lineage claim에는 정확히 하나의 독립 band 판정이 필요합니다.");
  }
  if (!exactKeyCoverage(input.lineageClaimAssessments, claimIds)) {
    throw new Error("모든 item-lineage claim에는 정확히 하나의 provenance 판정이 필요합니다.");
  }

  const ruleScope = new Set(input.lineage.rule_scope_ids);
  const riskScope = new Set(input.lineage.risk_scope_ids);
  for (const assessment of Object.values(input.lineageClaimAssessments)) {
    for (const ruleId of assessment.proposed_rule_ids ?? []) {
      if (!ruleScope.has(ruleId)) throw new Error(`scope 밖 proposed rule ID: ${ruleId}`);
    }
    for (const riskId of assessment.proposed_risk_ids ?? []) {
      if (!riskScope.has(riskId)) throw new Error(`scope 밖 proposed risk ID: ${riskId}`);
    }
  }

  return MissionExpertReviewSubmissionSchema.parse({
    schema_version: MISSION_EXPERT_REVIEW_SCHEMA_VERSION,
    protocol_version: EXPERT_REVIEW_PROTOCOL_VERSION,
    assignment_id: input.assignment.id,
    lineage_version_id: input.lineage.id,
    reviewer_user_id: input.reviewerUserId,
    review_round: input.assignment.review_round,
    independence_declaration: input.independenceDeclaration,
    overall_verdict: input.overallVerdict,
    confidence: input.confidence,
    candidate_band_assessments: input.candidateBandAssessments,
    rule_findings: input.ruleFindings ?? [],
    lineage_claim_assessments: input.lineageClaimAssessments,
    rationale_ko: input.rationaleKo,
  });
}

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord | null => (
  value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : null
);

const textField = (value: unknown): string | null => {
  if (typeof value === "string") return value;
  const record = asRecord(value);
  return typeof record?.text === "string" ? record.text : null;
};

/**
 * item_lineage가 허용하는 고정 path 문법만 해석한다. 임의 property traversal은 하지 않는다.
 */
export function resolveExpertReviewTargetText(
  missionContent: Record<string, unknown>,
  targetPath: string,
): string | null {
  const mpj = Array.isArray(missionContent.mpj_items) ? missionContent.mpj_items : [];
  let match = /^mpj_items\[(\d+)]\.target$/.exec(targetPath);
  if (match) return textField(asRecord(mpj[Number(match[1])])?.target);

  match = /^mpj_items\[(\d+)]\.recommended_example$/.exec(targetPath);
  if (match) return textField(asRecord(mpj[Number(match[1])])?.recommended_example);

  match = /^mpj_items\[(\d+)]\.(corrections|candidates)\[(\d+)]$/.exec(targetPath);
  if (match) {
    const item = asRecord(mpj[Number(match[1])]);
    const list = Array.isArray(item?.[match[2]]) ? item[match[2]] as unknown[] : [];
    return textField(list[Number(match[3])]);
  }

  match = /^production_task\.reference_alternatives\[(\d+)]$/.exec(targetPath);
  if (match) {
    const productionTask = asRecord(missionContent.production_task);
    const list = Array.isArray(productionTask?.reference_alternatives)
      ? productionTask.reference_alternatives as unknown[]
      : [];
    return textField(list[Number(match[1])]);
  }
  return null;
}

