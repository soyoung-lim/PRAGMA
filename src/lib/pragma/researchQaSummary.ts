import { SPEECH_ACT_UI } from "@/lib/pragma/enums";
import {
  ENGINEERING_SEED_GATE,
  EXPERT_RELEASE_GATE,
  observationsFromExpectedLabels,
  runGoldRegression,
} from "@/lib/pragma/goldRegression";
import { ITEM_LINEAGE_SCHEMA_VERSION } from "@/lib/pragma/itemLineage";
import { PROMPT_SNAPSHOT } from "@/lib/pragma/promptSnapshot.generated";
import { KO_ZH_CORE_REALIZATION_PACK } from "@/lib/pragma/realizationPack";
import { SEED_GOLD_CASES } from "@/lib/pragma/seedGoldSet";

export const FINAL_CORPUS_TARGET_MINIMUM = 500;

export function buildResearchQaSummary() {
  const pack = KO_ZH_CORE_REALIZATION_PACK;
  const candidates = SEED_GOLD_CASES.flatMap((item) => item.candidates);
  const engineeringRegression = runGoldRegression(
    SEED_GOLD_CASES,
    observationsFromExpectedLabels(SEED_GOLD_CASES, ["researcher_seed"]),
    ENGINEERING_SEED_GATE,
  );
  const expertReleaseRegression = runGoldRegression(
    SEED_GOLD_CASES,
    [],
    EXPERT_RELEASE_GATE,
  );

  return {
    pack: {
      id: pack.pack_id,
      version: pack.version,
      status: pack.status,
      covered_speech_acts: pack.scope.speech_acts,
      covered_speech_act_count: pack.scope.speech_acts.length,
      total_speech_act_count: Object.keys(SPEECH_ACT_UI).length,
      rule_count: pack.resources.length,
      risk_count: pack.risks.length,
    },
    evidence: {
      total_count: pack.evidence.length,
      active_count: pack.evidence.filter((item) => item.lifecycle_status === "active").length,
      source_verified_count: pack.evidence.filter(
        (item) => item.verification_status === "source_verified",
      ).length,
      items: pack.evidence,
    },
    calibration: {
      dataset_class: "test_only" as const,
      version: SEED_GOLD_CASES[0]?.version ?? "unknown",
      case_count: SEED_GOLD_CASES.length,
      candidate_count: candidates.length,
      pending_semantic_count: candidates.filter(
        (item) => item.semantic_fidelity === "pending_researcher_review",
      ).length,
      researcher_approved_count: SEED_GOLD_CASES.filter(
        (item) => item.review.status === "researcher_approved",
      ).length,
      expert_approved_count: SEED_GOLD_CASES.filter(
        (item) => item.review.status === "expert_approved",
      ).length,
      engineering_regression: engineeringRegression,
      expert_release_regression: expertReleaseRegression,
    },
    final_corpus: {
      dataset_class: "final_release" as const,
      status: "not_generated" as const,
      current_item_count: 0,
      target_minimum: FINAL_CORPUS_TARGET_MINIMUM,
      generation_gate:
        "규칙·문헌·전문가 기준·생성계약 lock과 calibration 승인 뒤 새 release로 전량 신규 생성",
    },
    lineage: {
      schema_version: ITEM_LINEAGE_SCHEMA_VERSION,
      mission_prompt_version: "mission_v4_separate_item_lineage",
      attribution_prompt_version: "item_lineage_attribution_v2",
      maximum_batch_size: 5,
      warning_unattributed_ratio: 0.2,
      prompt_count: PROMPT_SNAPSHOT.prompts.length,
      prompt_surface_hash: PROMPT_SNAPSHOT.core_surface_hash,
    },
  };
}

export const RESEARCH_QA_SUMMARY = buildResearchQaSummary();

