import { describe, expect, it } from "vitest";

import { buildMissionAttemptRow } from "@/lib/mission/missionAttemptRow";
import { SAMPLE_MISSION_V1 } from "@/lib/mission/missionV1Sample";
import { SAMPLE_MISSION_V6 } from "@/lib/mission/missionV6Sample";
import { deriveRevisionRecheck } from "@/lib/mission/missionFlow";
import type { RuntimeFeedback } from "@/lib/pragma/feedbackSchema";
import { normalizeMission } from "@/lib/pragma/missionSchema";
import { POLICY_VERSION } from "@/lib/research/versions";

function sampleMissionV2() {
  const normalized = normalizeMission(SAMPLE_MISSION_V1);
  if (!normalized.ok || !normalized.data) throw new Error("sample mission normalization failed");
  return normalized.data;
}

const feedback: RuntimeFeedback = {
  schema_version: "feedback_v1",
  rubric_version: "request_mitigation_optionality@1",
  verdicts: {
    semantic_fidelity: "preserved",
    grammatical_accuracy: "clean",
    pragmatic_appropriateness: {
      feature_code: "request_mitigation_optionality",
      band_code: "within_band",
    },
  },
  revision_scope: "clear",
  blocks: {
    meaning_ko: "핵심 뜻이 유지되었습니다.",
    grammar: [],
    feature_ko: "이 상황에서 선택권을 충분히 남겼습니다.",
    alternatives: [],
  },
  uncertainty_flags: [{ dimension: "pragmatic", reason: "맥락에 따라 변이가 가능함" }],
  provenance: {
    model: "test-model",
    prompt_version: "feedback_v1",
    generated_at: "2026-07-27T01:03:00.000Z",
  },
};

describe("mission attempt row", () => {
  it("stamps the canonical research policy version", () => {
    const row = buildMissionAttemptRow({
      mission: sampleMissionV2(),
      scenarioId: "11111111-1111-1111-1111-111111111111",
      speechAct: "request",
      level: "intermediate",
      firstResponse: "처음 답",
      revisedResponse: "고친 답",
      startedAtIso: "2026-07-27T01:00:00.000Z",
    }, "profile-1", "user-1", "2026-07-27T01:05:00.000Z");

    expect(row.policy_ver).toBe(POLICY_VERSION);
    expect(row).toMatchObject({
      profile_id: "profile-1",
      auth_user_id: "user-1",
      source_lang: "ko",
      target_lang: "zh",
      first_response: "처음 답",
      revised_response: "고친 답",
      completed_at: "2026-07-27T01:05:00.000Z",
    });
  });

  it("uses a stable synthetic mission id for an unsaved sample", () => {
    const mission = sampleMissionV2();
    const row = buildMissionAttemptRow({
      mission,
      scenarioId: null,
      speechAct: null,
      level: null,
      firstResponse: "답",
      revisedResponse: "답",
      startedAtIso: "2026-07-27T01:00:00.000Z",
    }, "profile-1", "user-1");

    expect(row.mission_id).toBe(`sample:${mission.unit.target_feature}`);
    expect(row.cell_id).toBeNull();
  });

  it("persists the feedback shown to the learner without a schema migration", () => {
    const row = buildMissionAttemptRow({
      mission: sampleMissionV2(),
      scenarioId: "11111111-1111-1111-1111-111111111111",
      speechAct: "request",
      level: "intermediate",
      firstResponse: "처음 답",
      revisedResponse: "고친 답",
      feedback,
      startedAtIso: "2026-07-27T01:00:00.000Z",
    }, "profile-1", "user-1");

    expect(row.semantic_fidelity_status).toBe("pass");
    expect(row.revision_target_selected).toBe("clear");
    expect(row.revision_target_source).toBe("system_assigned");
    expect(row.target_feature_observed).toMatchObject({
      schema_version: "feedback_v1",
      revision_scope: "clear",
      uncertainty_flags: [{ dimension: "pragmatic" }],
      provenance: { model: "test-model" },
    });
  });

  it("stores unscored MPJ best/worst choices in a versioned context envelope", () => {
    const row = buildMissionAttemptRow({
      mission: sampleMissionV2(),
      scenarioId: "11111111-1111-1111-1111-111111111111",
      speechAct: "request",
      level: "intermediate",
      firstResponse: "처음 답",
      revisedResponse: "고친 답",
      startedAtIso: "2026-07-29T01:00:00.000Z",
      mpjResponses: [
        {
          item_id: 5,
          item_type: "multi_judge",
          best_candidate_indexes: [1, 2],
          most_inappropriate_candidate_index: 4,
          completed_at: "2026-07-29T01:02:00.000Z",
        },
      ],
      productionSupport: {
        kind: "translation_vocabulary_hints",
        available: true,
        opened: true,
        opened_at: "2026-07-29T01:03:00.000Z",
      },
    }, "profile-1", "user-1");

    expect(row.context_judgment).toMatchObject({
      schema_version: "mpj_response_v1",
      mission_schema_version: "mission_v2",
      learner_dissent: null,
      responses: [
        {
          item_type: "multi_judge",
          best_candidate_indexes: [1, 2],
          most_inappropriate_candidate_index: 4,
        },
      ],
      production_support: {
        kind: "translation_vocabulary_hints",
        available: true,
        opened: true,
      },
    });
  });

  it("stores mission_v6 choices, revision decision, and the one-scan recheck", () => {
    const recheck = deriveRevisionRecheck(
      "feature",
      feedback,
      "within_band",
      "2026-08-17T01:04:00.000Z",
    );
    const row = buildMissionAttemptRow({
      mission: SAMPLE_MISSION_V6,
      scenarioId: "11111111-1111-1111-1111-111111111111",
      speechAct: "request",
      level: "intermediate",
      firstResponse: "把会议地点改到我们公司附近。",
      revisedResponse: "能把会议地点改到我们公司附近吗？",
      feedback: { ...feedback, revision_scope: "feature" },
      startedAtIso: "2026-08-17T01:00:00.000Z",
      revisionDecision: "revise",
      recheckedResponse: "能把会议地点改到我们公司附近吗？",
      revisionRecheck: recheck,
      mpjResponses: [{
        item_id: 4,
        item_type: "multi_judge",
        judgment_frame: "reference_non_scored",
        scored: false,
        elapsed_ms: 42_000,
        judgment_response_count: 4,
        candidate_band_codes: ["within_band", "too_direct", "too_indirect", "within_band"],
        completed_at: "2026-08-17T01:02:00.000Z",
      }],
    }, "profile-1", "user-1");

    expect(row.context_judgment).toMatchObject({
      schema_version: "mission_response_v2",
      mission_schema_version: "mission_v6",
      responses: [{
        judgment_frame: "reference_non_scored",
        scored: false,
        elapsed_ms: 42_000,
        judgment_response_count: 4,
        candidate_band_codes: ["within_band", "too_direct", "too_indirect", "within_band"],
      }],
      revision: {
        decision: "revise",
        recheck: { status: "reflected", scan_count: 1 },
        additional_revision_used: false,
      },
    });
    expect(row.revision_target_selected).toBe("feature");
  });
});
