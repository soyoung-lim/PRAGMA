import { z } from "zod";

export const ITEM_LINEAGE_SCHEMA_VERSION = "mission_item_lineage_v1" as const;
export const ITEM_LINEAGE_PENDING_STATUS = "model_claimed_pending_review" as const;

export const ItemLineageClaimSchema = z.object({
  /** 서버가 부여하는 미션 내부 고유 ID. */
  claim_id: z.string().min(1),
  /** 0-based JSON path. 학습자에게 제시되는 목표어 문장만 추적한다. */
  target_path: z.string().min(1),
  attribution_status: z.enum(["model_claimed", "model_unattributed"]),
  /** 모델이 해당 문장에 실제 사용되었다고 주장한 realization rule. */
  rule_ids: z.array(z.string().min(1)),
  /** 모델이 해당 문장이 구현하거나 피해야 할 위험으로 주장한 risk. */
  risk_ids: z.array(z.string().min(1)),
  /** rule/risk 선택에서 서버가 계산한 근거 ID 합집합. */
  evidence_ids: z.array(z.string().min(1)),
  note_ko: z.string().min(1),
}).superRefine((claim, ctx) => {
  const linkedCount = claim.rule_ids.length + claim.risk_ids.length;
  if (claim.attribution_status === "model_claimed" && (linkedCount === 0 || claim.evidence_ids.length === 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "model_claimed에는 rule/risk와 evidence가 필요합니다." });
  }
  if (
    claim.attribution_status === "model_unattributed" &&
    (linkedCount > 0 || claim.evidence_ids.length > 0)
  ) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "model_unattributed는 ID를 임의로 연결할 수 없습니다." });
  }
});
export type ItemLineageClaim = z.infer<typeof ItemLineageClaimSchema>;

export const ItemLineageSchema = z.object({
  schema_version: z.literal(ITEM_LINEAGE_SCHEMA_VERSION),
  claim_status: z.enum([ITEM_LINEAGE_PENDING_STATUS, "model_attribution_pending_review"]),
  realization_pack_id: z.string().min(1),
  realization_pack_version: z.string().min(1),
  /** 별도 저온 attribution 호출의 서버 주입 provenance. legacy v3 읽기 호환용 optional. */
  attribution_provenance: z.object({
    provider: z.string().min(1),
    model: z.string().min(1),
    prompt_version: z.string().min(1),
    prompt_instance_hash: z.string().min(1),
    attribution_attempts: z.number().int().positive(),
    batch_count: z.number().int().positive().optional(),
    calls: z.array(z.object({
      batch_index: z.number().int().positive(),
      target_count: z.number().int().positive(),
      model: z.string().min(1),
      prompt_instance_hash: z.string().min(1),
      attempts: z.number().int().positive(),
    })).min(1).optional(),
    attributed_at: z.string().min(1),
  }).optional(),
  coverage_summary: z.object({
    total_count: z.number().int().positive(),
    claimed_count: z.number().int().nonnegative(),
    unattributed_count: z.number().int().nonnegative(),
  }).optional(),
  claims: z.array(ItemLineageClaimSchema).min(1),
});
export type ItemLineage = z.infer<typeof ItemLineageSchema>;

export interface ItemLineageScopeEntry {
  evidence_ids: string[];
}

export interface ItemLineageValidationScope {
  coverage_status: "covered" | "not_covered";
  realization_pack_id: string | null;
  realization_pack_version: string | null;
  rules: Array<ItemLineageScopeEntry & { rule_id: string }>;
  risks: Array<ItemLineageScopeEntry & { risk_id: string }>;
}

export interface ItemLineageMissionShape {
  mpj_items?: Array<{
    type?: string;
    target?: string;
    recommended_example?: string;
    corrections?: unknown[];
    candidates?: unknown[];
  }>;
  production_task?: { reference_alternatives?: unknown[] };
  item_lineage?: ItemLineage;
}

export interface ItemLineageIssue {
  code:
    | "missing_lineage"
    | "unexpected_lineage"
    | "pack_mismatch"
    | "duplicate_claim_id"
    | "duplicate_target_path"
    | "missing_target_path"
    | "unknown_target_path"
    | "empty_rule_and_risk"
    | "unknown_rule_id"
    | "unknown_risk_id"
    | "evidence_mismatch"
    | "coverage_summary_mismatch";
  target_path?: string;
  message: string;
}

/**
 * 문항의 상황·원문·해설이 아니라 학습자가 실제로 판단/산출 참고에 쓰는 목표어 문장만
 * 추적한다. 순서는 생성 prompt와 동일하며, 경로는 모두 0-based다.
 */
export function expectedItemLineageTargetPaths(
  mission: Pick<ItemLineageMissionShape, "mpj_items" | "production_task">,
): string[] {
  const paths: string[] = [];
  (mission.mpj_items ?? []).forEach((item, itemIndex) => {
    if (typeof item.target === "string") paths.push(`mpj_items[${itemIndex}].target`);
    if (Array.isArray(item.corrections)) {
      item.corrections.forEach((_, index) => paths.push(`mpj_items[${itemIndex}].corrections[${index}]`));
    }
    if (Array.isArray(item.candidates)) {
      item.candidates.forEach((_, index) => paths.push(`mpj_items[${itemIndex}].candidates[${index}]`));
    }
    if (typeof item.recommended_example === "string") {
      paths.push(`mpj_items[${itemIndex}].recommended_example`);
    }
  });
  (mission.production_task?.reference_alternatives ?? []).forEach((_, index) =>
    paths.push(`production_task.reference_alternatives[${index}]`),
  );
  return paths;
}

/**
 * 모델의 ID 선택은 provenance claim일 뿐이다. 이 함수는 claim의 진위를 판정하지 않고
 * 구조·허용 범위·근거 연결만 결정론적으로 검사한다.
 */
export function validateItemLineage(
  mission: ItemLineageMissionShape,
  scope: ItemLineageValidationScope,
): ItemLineageIssue[] {
  const issues: ItemLineageIssue[] = [];
  const lineage = mission.item_lineage;

  if (scope.coverage_status === "not_covered") {
    if (lineage) {
      issues.push({
        code: "unexpected_lineage",
        message: "검증 범위 밖 미션에 realization pack lineage가 첨부됨",
      });
    }
    return issues;
  }

  if (!lineage) {
    return [{ code: "missing_lineage", message: "검증 범위 미션에 item_lineage가 없음" }];
  }
  if (
    lineage.realization_pack_id !== scope.realization_pack_id ||
    lineage.realization_pack_version !== scope.realization_pack_version
  ) {
    issues.push({
      code: "pack_mismatch",
      message: `item_lineage pack(${lineage.realization_pack_id}@${lineage.realization_pack_version})가 생성 scope와 다름`,
    });
  }

  const expectedPaths = expectedItemLineageTargetPaths(mission);
  const expectedPathSet = new Set(expectedPaths);
  const claimIdSet = new Set<string>();
  const targetPathSet = new Set<string>();
  const ruleMap = new Map(scope.rules.map((rule) => [rule.rule_id, rule]));
  const riskMap = new Map(scope.risks.map((risk) => [risk.risk_id, risk]));

  for (const claim of lineage.claims) {
    if (claimIdSet.has(claim.claim_id)) {
      issues.push({ code: "duplicate_claim_id", target_path: claim.target_path, message: `중복 claim_id: ${claim.claim_id}` });
    }
    claimIdSet.add(claim.claim_id);
    if (targetPathSet.has(claim.target_path)) {
      issues.push({ code: "duplicate_target_path", target_path: claim.target_path, message: `중복 target_path: ${claim.target_path}` });
    }
    targetPathSet.add(claim.target_path);
    if (!expectedPathSet.has(claim.target_path)) {
      issues.push({ code: "unknown_target_path", target_path: claim.target_path, message: `미션에 없는 추적 경로: ${claim.target_path}` });
    }
    if (
      claim.attribution_status === "model_claimed" &&
      claim.rule_ids.length === 0 &&
      claim.risk_ids.length === 0
    ) {
      issues.push({ code: "empty_rule_and_risk", target_path: claim.target_path, message: "rule_ids와 risk_ids가 모두 비어 있음" });
    }

    const linkedEvidence = new Set<string>();
    for (const ruleId of claim.rule_ids) {
      const rule = ruleMap.get(ruleId);
      if (!rule) {
        issues.push({ code: "unknown_rule_id", target_path: claim.target_path, message: `scope 밖 rule_id: ${ruleId}` });
      } else {
        rule.evidence_ids.forEach((id) => linkedEvidence.add(id));
      }
    }
    for (const riskId of claim.risk_ids) {
      const risk = riskMap.get(riskId);
      if (!risk) {
        issues.push({ code: "unknown_risk_id", target_path: claim.target_path, message: `scope 밖 risk_id: ${riskId}` });
      } else {
        risk.evidence_ids.forEach((id) => linkedEvidence.add(id));
      }
    }

    const actualEvidence = [...new Set(claim.evidence_ids)].sort();
    const expectedEvidence = [...linkedEvidence].sort();
    if (
      actualEvidence.length !== claim.evidence_ids.length ||
      actualEvidence.join("\u0000") !== expectedEvidence.join("\u0000")
    ) {
      issues.push({
        code: "evidence_mismatch",
        target_path: claim.target_path,
        message: `evidence_ids가 선택한 rule/risk의 서버 계산 합집합과 다름`,
      });
    }
  }

  if (lineage.coverage_summary) {
    const claimedCount = lineage.claims.filter((claim) => claim.attribution_status === "model_claimed").length;
    const unattributedCount = lineage.claims.length - claimedCount;
    if (
      lineage.coverage_summary.total_count !== lineage.claims.length ||
      lineage.coverage_summary.claimed_count !== claimedCount ||
      lineage.coverage_summary.unattributed_count !== unattributedCount
    ) {
      issues.push({ code: "coverage_summary_mismatch", message: "item_lineage coverage_summary가 claim 실제 개수와 다름" });
    }
  }

  for (const path of expectedPaths) {
    if (!targetPathSet.has(path)) {
      issues.push({ code: "missing_target_path", target_path: path, message: `lineage가 누락된 목표어 문장: ${path}` });
    }
  }
  return issues;
}
