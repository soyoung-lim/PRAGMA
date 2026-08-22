import { describe, expect, it } from "vitest";

import type { ItemLineage } from "./itemLineage";
import {
  EXPERT_REVIEW_PROTOCOL_VERSION,
  makeMissionExpertReviewSubmission,
  resolveExpertReviewTargetText,
  type MissionExpertAssignmentSnapshot,
  type MissionExpertLineageSnapshot,
} from "./expertReviewProtocol";

const assignment: MissionExpertAssignmentSnapshot = {
  id: "10000000-0000-4000-8000-000000000001",
  lineage_version_id: "20000000-0000-4000-8000-000000000001",
  reviewer_user_id: "30000000-0000-4000-8000-000000000001",
  review_round: 1,
  protocol_version: EXPERT_REVIEW_PROTOCOL_VERSION,
  blind_review: true,
};

const itemLineage: ItemLineage = {
  schema_version: "mission_item_lineage_v1",
  claim_status: "model_attribution_pending_review",
  realization_pack_id: "rp-ko-zh-core",
  realization_pack_version: "1.2.0",
  claims: [
    {
      claim_id: "ILC-001",
      target_path: "mpj_items[0].target",
      attribution_status: "model_claimed",
      rule_ids: ["RR-1"],
      risk_ids: [],
      evidence_ids: ["EV-1"],
      note_ko: "완화 표지를 사용함",
    },
    {
      claim_id: "ILC-002",
      target_path: "mpj_items[1].candidates[0]",
      attribution_status: "model_unattributed",
      rule_ids: [],
      risk_ids: [],
      evidence_ids: [],
      note_ko: "현행 scope에서 귀속 불가",
    },
  ],
};

const lineage: MissionExpertLineageSnapshot = {
  id: assignment.lineage_version_id,
  item_lineage: itemLineage,
  rule_scope_ids: ["RR-1", "RR-2"],
  risk_scope_ids: ["RK-1"],
  mission_content: {
    mpj_items: [
      { target: "麻烦你发给我。" },
      { candidates: [{ text: "现在发给我。" }] },
    ],
  },
};

const validInput = () => ({
  assignment,
  lineage,
  reviewerUserId: assignment.reviewer_user_id,
  independenceDeclaration: {
    reviewed_independently: true as const,
    conflict_of_interest: false as const,
    chinese_proficiency_confirmed: true as const,
  },
  overallVerdict: "revise" as const,
  confidence: 4,
  candidateBandAssessments: {
    "ILC-001": { band_code: "within_band" as const, rationale_ko: "상황에 맞는 완화" },
    "ILC-002": { band_code: "too_direct" as const, rationale_ko: "선택권 제시가 부족함" },
  },
  lineageClaimAssessments: {
    "ILC-001": { verdict: "support" as const, proposed_rule_ids: [], proposed_risk_ids: [], rationale_ko: "규칙 연결 적절" },
    "ILC-002": { verdict: "revise" as const, proposed_rule_ids: ["RR-2"], proposed_risk_ids: [], rationale_ko: "대체 규칙으로 귀속" },
  },
  rationaleKo: "두 번째 claim의 귀속을 수정해야 함",
});

describe("expert review protocol", () => {
  it("builds a complete blind review for every claim", () => {
    const review = makeMissionExpertReviewSubmission(validInput());
    expect(review.schema_version).toBe("mission_expert_review_v2");
    expect(Object.keys(review.candidate_band_assessments)).toEqual(["ILC-001", "ILC-002"]);
    expect(review.independence_declaration.reviewed_independently).toBe(true);
  });

  it("rejects missing band or provenance assessments", () => {
    const input = validInput();
    delete (input.candidateBandAssessments as Partial<typeof input.candidateBandAssessments>)["ILC-002"];
    expect(() => makeMissionExpertReviewSubmission(input)).toThrow(/모든 item-lineage claim/);
  });

  it("rejects replacement IDs outside the versioned mission scope", () => {
    const input = validInput();
    input.lineageClaimAssessments["ILC-002"].proposed_rule_ids = ["RR-OUTSIDE"];
    expect(() => makeMissionExpertReviewSubmission(input)).toThrow(/scope 밖/);
  });

  it("requires the exact blind protocol assignment", () => {
    const input = validInput();
    input.assignment = { ...assignment, blind_review: false };
    expect(() => makeMissionExpertReviewSubmission(input)).toThrow(/blind protocol/);
  });

  it("resolves only the fixed item-lineage target path grammar", () => {
    expect(resolveExpertReviewTargetText(lineage.mission_content, "mpj_items[0].target")).toBe("麻烦你发给我。");
    expect(resolveExpertReviewTargetText(lineage.mission_content, "mpj_items[1].candidates[0]")).toBe("现在发给我。");
    expect(resolveExpertReviewTargetText(lineage.mission_content, "__proto__.polluted")).toBeNull();
  });
});
