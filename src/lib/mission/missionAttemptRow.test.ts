import { describe, expect, it } from "vitest";

import { buildMissionAttemptRow } from "@/lib/mission/missionAttemptRow";
import { SAMPLE_MISSION_V1 } from "@/lib/mission/missionV1Sample";
import { normalizeMission } from "@/lib/pragma/missionSchema";
import { POLICY_VERSION } from "@/lib/research/versions";

function sampleMissionV2() {
  const normalized = normalizeMission(SAMPLE_MISSION_V1);
  if (!normalized.ok || !normalized.data) throw new Error("sample mission normalization failed");
  return normalized.data;
}

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
});
