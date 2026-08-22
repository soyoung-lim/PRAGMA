import { describe, expect, it } from "vitest";

import {
  ITEM_LINEAGE_PENDING_STATUS,
  ITEM_LINEAGE_SCHEMA_VERSION,
  expectedItemLineageTargetPaths,
  validateItemLineage,
  type ItemLineageMissionShape,
} from "./itemLineage";
import { buildMissionLineageScope } from "./missionLineage";
import { normalizeMission } from "./missionSchema";
import { checkMission, type CheckContext } from "./missionRules";
import { SAMPLE_MISSION_V1 } from "@/lib/mission/missionV1Sample";

function baseMission(): ItemLineageMissionShape {
  return {
    mpj_items: [
      { type: "scale4", target: "请帮我看一下。", recommended_example: "方便的话，请帮我看一下。" },
      { type: "judge3", target: "可以帮我看一下吗？", recommended_example: "可以帮我看一下吗？" },
      {
        type: "fix_choice",
        target: "你现在看。",
        corrections: [{}, {}, {}, {}],
        recommended_example: "方便的话，可以帮我看一下吗？",
      },
      { type: "reason_conf", target: "麻烦您务必立刻看一下。", recommended_example: "方便的话，麻烦您看一下。" },
      {
        type: "multi_judge",
        candidates: [{}, {}, {}, {}, {}],
        recommended_example: "您方便的时候帮我看一下，可以吗？",
      },
    ],
    production_task: { reference_alternatives: [{}] },
  };
}

function coveredMission(): ItemLineageMissionShape {
  const mission = baseMission();
  const scope = buildMissionLineageScope({
    direction: "ko_zh",
    speechAct: "request",
    targetFeature: "request_mitigation_optionality",
  });
  const rule = scope.rules[0];
  mission.item_lineage = {
    schema_version: ITEM_LINEAGE_SCHEMA_VERSION,
    claim_status: ITEM_LINEAGE_PENDING_STATUS,
    realization_pack_id: scope.realization_pack_id!,
    realization_pack_version: scope.realization_pack_version!,
    claims: expectedItemLineageTargetPaths(mission).map((targetPath, index) => ({
      claim_id: `ILC-${String(index + 1).padStart(3, "0")}`,
      target_path: targetPath,
      attribution_status: "model_claimed",
      rule_ids: [rule.rule_id],
      risk_ids: [],
      evidence_ids: [...rule.evidence_ids].sort(),
      note_ko: "요청 완화 자원을 사용했다는 모델 주장",
    })),
  };
  return mission;
}

describe("item-level realization lineage", () => {
  const scope = buildMissionLineageScope({
    direction: "ko_zh",
    speechAct: "request",
    targetFeature: "request_mitigation_optionality",
  });

  it("covers all 19 target, correction, candidate, recommendation, and reference paths", () => {
    const mission = coveredMission();
    expect(expectedItemLineageTargetPaths(mission)).toHaveLength(19);
    expect(validateItemLineage(mission, scope)).toEqual([]);
    expect(mission.item_lineage?.claim_status).toBe("model_claimed_pending_review");
  });

  it("rejects a missing target path and a cross-act rule instead of treating claims as verified", () => {
    const mission = coveredMission();
    mission.item_lineage!.claims.pop();
    mission.item_lineage!.claims[0] = {
      ...mission.item_lineage!.claims[0],
      rule_ids: ["RR-KOZH-REF-HEDGE"],
      evidence_ids: ["EV-WU-ROEVER-2021-REFUSAL"],
    };
    const issues = validateItemLineage(mission, scope);
    expect(issues.some((issue) => issue.code === "missing_target_path")).toBe(true);
    expect(issues.some((issue) => issue.code === "unknown_rule_id")).toBe(true);
    expect(issues.some((issue) => issue.code === "evidence_mismatch")).toBe(true);
  });

  it("does not attach the ko→zh pack outside the audited direction", () => {
    const uncoveredScope = buildMissionLineageScope({
      direction: "zh_ko",
      speechAct: "request",
      targetFeature: "request_mitigation_optionality",
    });
    expect(validateItemLineage(baseMission(), uncoveredScope)).toEqual([]);
    expect(validateItemLineage(coveredMission(), uncoveredScope)[0]?.code).toBe("unexpected_lineage");
  });

  it("makes complete pending lineage a hard gate only for the current prompt version", () => {
    const mission = normalizeMission(SAMPLE_MISSION_V1).data!;
    mission.provenance = {
      provider: "openai",
      model: "test-model",
      prompt_version: "mission_v6_fix_review_mpj4_dct1",
      prompt_instance_hash: "prompt-instance",
      mission_content_hash: "mission-content",
      generated_at: "2026-08-14T00:00:00Z",
      generation_attempt: 1,
    };
    const context: CheckContext = {
      speech_act: "request",
      level: "intermediate",
      domain: "work",
      theme_code: "career_workplace",
      topic_code: "schedule_change",
      mode: "translation",
      source_modality: "written",
      direction: "ko_zh",
    };
    expect(checkMission(mission, context).violations.some((violation) => violation.id === "R27")).toBe(true);

    const rule = scope.rules[0];
    const targetPaths = expectedItemLineageTargetPaths(mission);
    mission.item_lineage = {
      schema_version: ITEM_LINEAGE_SCHEMA_VERSION,
      claim_status: "model_attribution_pending_review",
      realization_pack_id: scope.realization_pack_id!,
      realization_pack_version: scope.realization_pack_version!,
      attribution_provenance: {
        provider: "openai",
        model: "test-attributor",
        prompt_version: "item_lineage_attribution_v2",
        prompt_instance_hash: "attribution-prompt-instance",
        attribution_attempts: 1,
        batch_count: 1,
        calls: [{
          batch_index: 1,
          target_count: targetPaths.length,
          model: "test-attributor",
          prompt_instance_hash: "attribution-batch-prompt-instance",
          attempts: 1,
        }],
        attributed_at: "2026-08-14T00:00:01Z",
      },
      coverage_summary: {
        total_count: targetPaths.length,
        claimed_count: targetPaths.length,
        unattributed_count: 0,
      },
      claims: targetPaths.map((targetPath, index) => ({
        claim_id: `ILC-${String(index + 1).padStart(3, "0")}`,
        target_path: targetPath,
        attribution_status: "model_claimed",
        rule_ids: [rule.rule_id],
        risk_ids: [],
        evidence_ids: [...rule.evidence_ids].sort(),
        note_ko: "테스트용 모델 주장",
      })),
    };
    expect(checkMission(mission, context).violations.filter((violation) => violation.id === "R27")).toEqual([]);

    const warningCount = Math.max(1, Math.floor(targetPaths.length * 0.2));
    for (const claim of mission.item_lineage.claims.slice(0, warningCount)) {
      claim.attribution_status = "model_unattributed";
      claim.rule_ids = [];
      claim.risk_ids = [];
      claim.evidence_ids = [];
      claim.note_ko = "현행 pack에서 방어 가능한 rule/risk 귀속을 찾지 못함";
    }
    mission.item_lineage.coverage_summary = {
      total_count: targetPaths.length,
      claimed_count: targetPaths.length - warningCount,
      unattributed_count: warningCount,
    };
    const warningResult = checkMission(mission, context).violations;
    expect(warningResult.filter((violation) => violation.id === "R27")).toEqual([]);
    expect(warningResult.filter((violation) => violation.id === "R28")).toHaveLength(1);

    const firstClaimed = mission.item_lineage.claims[warningCount];
    firstClaimed.attribution_status = "model_unattributed";
    firstClaimed.rule_ids = [];
    firstClaimed.risk_ids = [];
    firstClaimed.evidence_ids = [];
    firstClaimed.note_ko = "현행 pack에서 방어 가능한 rule/risk 귀속을 찾지 못함";
    mission.item_lineage.coverage_summary = {
      total_count: targetPaths.length,
      claimed_count: targetPaths.length - warningCount - 1,
      unattributed_count: warningCount + 1,
    };
    expect(checkMission(mission, context).violations.some((violation) => violation.id === "R27")).toBe(true);
  });
});
