import type { LanguageDirection, SpeechActUI } from "@/lib/pragma/enums";
import {
  KO_ZH_CORE_PACK_ID,
  KO_ZH_CORE_REALIZATION_PACK,
  realizationResourcesForFeature,
  realizationRisksForAct,
} from "@/lib/pragma/realizationPack";

export interface MissionLineageMeta {
  coverage_status: "covered" | "not_covered";
  realization_pack_id: string | null;
  realization_pack_version: string | null;
  rule_scope_ids: string[];
  risk_scope_ids: string[];
  evidence_scope_ids: string[];
}

export interface MissionLineagePromptScope extends MissionLineageMeta {
  rules: Array<{
    rule_id: string;
    label_ko: string;
    evidence_ids: string[];
  }>;
  risks: Array<{
    risk_id: string;
    description_ko: string;
    evidence_ids: string[];
  }>;
  evidence: Array<{
    evidence_id: string;
    claim_scope_ko: string;
  }>;
}

const uncoveredScope = (): MissionLineagePromptScope => ({
  coverage_status: "not_covered",
  realization_pack_id: null,
  realization_pack_version: null,
  rule_scope_ids: [],
  risk_scope_ids: [],
  evidence_scope_ids: [],
  rules: [],
  risks: [],
  evidence: [],
});

export function buildMissionLineageScope(args: {
  direction: LanguageDirection;
  speechAct: SpeechActUI;
  targetFeature: string;
}): MissionLineagePromptScope {
  if (
    args.direction !== "ko_zh" ||
    !KO_ZH_CORE_REALIZATION_PACK.scope.speech_acts.includes(
      args.speechAct as "request" | "refusal" | "thanks",
    )
  ) {
    return uncoveredScope();
  }

  const resources = realizationResourcesForFeature(args.targetFeature);
  if (resources.length === 0) {
    return uncoveredScope();
  }
  const risks = realizationRisksForAct(args.speechAct).filter(
    (risk) =>
      risk.target_features.length === 0 || risk.target_features.includes(args.targetFeature),
  );
  const evidenceIds = new Set([
    ...resources.flatMap((resource) => resource.evidence_ids),
    ...risks.flatMap((risk) => risk.evidence_ids),
  ]);

  return {
    coverage_status: "covered",
    realization_pack_id: KO_ZH_CORE_PACK_ID,
    realization_pack_version: KO_ZH_CORE_REALIZATION_PACK.version,
    rule_scope_ids: resources.map((resource) => resource.rule_id),
    risk_scope_ids: risks.map((risk) => risk.risk_id),
    evidence_scope_ids: [...evidenceIds],
    rules: resources.map((resource) => ({
      rule_id: resource.rule_id,
      label_ko: resource.prompt_label_ko,
      evidence_ids: [...resource.evidence_ids],
    })),
    risks: risks.map((risk) => ({
      risk_id: risk.risk_id,
      description_ko: risk.description_ko,
      evidence_ids: [...risk.evidence_ids],
    })),
    evidence: [...evidenceIds].map((evidenceId) => {
      const evidence = KO_ZH_CORE_REALIZATION_PACK.evidence.find((item) => item.evidence_id === evidenceId);
      return {
        evidence_id: evidenceId,
        claim_scope_ko: evidence?.claim_scope_ko ?? "확인 필요",
      };
    }),
  };
}

export function buildMissionLineageMeta(args: {
  direction: LanguageDirection;
  speechAct: SpeechActUI;
  targetFeature: string;
}): MissionLineageMeta {
  const scope = buildMissionLineageScope(args);
  return {
    coverage_status: scope.coverage_status,
    realization_pack_id: scope.realization_pack_id,
    realization_pack_version: scope.realization_pack_version,
    rule_scope_ids: scope.rule_scope_ids,
    risk_scope_ids: scope.risk_scope_ids,
    evidence_scope_ids: scope.evidence_scope_ids,
  };
}
