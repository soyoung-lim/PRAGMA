import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/pragma/promoteMission", () => ({ promoteCore: vi.fn() }));

import { runMissionBatch, type MissionBatchCore } from "@/lib/pragma/missionBatchRun";

function core(id: string, missionStatus: string | null = null): MissionBatchCore {
  return {
    scenario_id: id,
    speech_act: "request",
    learner_level: "intermediate",
    domain: "school",
    mode: "translation",
    source_modality: "written",
    theme_code: "campus_study",
    topic_code: "deadline_extension",
    language_direction: "ko_zh",
    generation_run_id: "run-1",
    generation_item_key: `key-${id}`,
    mission_status: missionStatus,
    core_content: {},
  };
}

describe("resumable mission batch", () => {
  it("reuses promoted rows and calls the generator only for pending cores", async () => {
    const promote = vi.fn(async () => ({ ok: true, quality: { verdict: "pass" } } as never));
    const results = await runMissionBatch(
      [core("generated", "generated"), core("pending"), core("reviewed", "reviewed")],
      { promote, concurrency: 3 },
    );

    expect(promote).toHaveBeenCalledTimes(1);
    expect(promote).toHaveBeenCalledWith(expect.objectContaining({ scenario_id: "pending" }));
    expect(results.map((item) => [item.scenarioId, item.ok, item.reused])).toEqual([
      ["generated", true, true],
      ["pending", true, false],
      ["reviewed", true, true],
    ]);
  });

  it("keeps failures isolated so a later run can retry only pending rows", async () => {
    const promote = vi.fn(async (item: { scenario_id: string }) =>
      item.scenario_id === "bad"
        ? { ok: false, error: "quality unavailable" }
        : { ok: true, quality: { verdict: "warning" } },
    );
    const results = await runMissionBatch([core("good"), core("bad")], { promote: promote as never });
    expect(results).toEqual([
      expect.objectContaining({ scenarioId: "good", ok: true, qualityVerdict: "warning" }),
      expect.objectContaining({ scenarioId: "bad", ok: false, error: "quality unavailable" }),
    ]);
  });
});
