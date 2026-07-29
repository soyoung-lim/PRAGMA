import { describe, expect, it } from "vitest";

import { buildMissionAttemptRow } from "@/lib/mission/missionAttemptRow";
import { SAMPLE_MISSION_V1 } from "@/lib/mission/missionV1Sample";
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

  it("stores unscored MPJ responses in a versioned context envelope", () => {
    const missionV4Shape = {
      ...sampleMissionV2(),
      schema_version: "mission_v4",
    } as unknown as ReturnType<typeof sampleMissionV2>;
    const row = buildMissionAttemptRow({
      mission: missionV4Shape,
      scenarioId: "11111111-1111-1111-1111-111111111111",
      speechAct: "request",
      level: "intermediate",
      firstResponse: "처음 답",
      revisedResponse: "고친 답",
      startedAtIso: "2026-07-29T01:00:00.000Z",
      mpjResponses: [
        {
          item_id: 1,
          item_type: "fix_choice",
          band_code: "overdone",
          correction_indexes: [0, 2],
          completed_at: "2026-07-29T01:01:00.000Z",
        },
        {
          item_id: 2,
          item_type: "reason",
          reason_id: "primary",
          confidence: "이 값은 v4에서 폐기돼야 함",
          completed_at: "2026-07-29T01:02:00.000Z",
        },
        {
          item_id: 4,
          item_type: "multi_judge",
          best_candidate_index: 1,
          worst_candidate_index: 4,
          completed_at: "2026-07-29T01:03:00.000Z",
        },
      ],
      productionSupport: {
        kind: "translation_vocabulary_hints",
        available: true,
        opened: true,
        opened_at: "2026-07-29T01:04:00.000Z",
      },
    }, "profile-1", "user-1");

    expect(row.context_judgment).toMatchObject({
      schema_version: "mpj_response_v1",
      mission_schema_version: "mission_v4",
      learner_dissent: null,
      responses: [
        {
          item_type: "fix_choice",
          band_code: "overdone",
          correction_indexes: [0, 2],
        },
        {
          item_type: "reason",
          reason_id: "primary",
        },
        {
          item_type: "multi_judge",
          best_candidate_index: 1,
          worst_candidate_index: 4,
        },
      ],
      production_support: {
        kind: "translation_vocabulary_hints",
        available: true,
        opened: true,
      },
    });
    expect(JSON.stringify(row.context_judgment)).not.toContain("confidence");
  });
});
