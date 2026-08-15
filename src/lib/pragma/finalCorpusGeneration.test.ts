import { describe, expect, it } from "vitest";

import {
  FINAL_CORPUS_QUOTA_504,
  buildBatchPlan,
} from "@/lib/pragma/batchPlan";
import {
  FINAL_CORPUS_PLAN_VERSION,
  FINAL_CORPUS_TARGET_COUNT,
  buildFinalCorpusPlanSnapshot,
} from "@/lib/pragma/finalCorpusGeneration";

describe("authoritative final corpus plan", () => {
  it("serializes the approved plan as 504 unique post-lock item identities", () => {
    const snapshot = buildFinalCorpusPlanSnapshot(buildBatchPlan(FINAL_CORPUS_QUOTA_504));

    expect(snapshot.plan_version).toBe(FINAL_CORPUS_PLAN_VERSION);
    expect(snapshot.target_count).toBe(FINAL_CORPUS_TARGET_COUNT);
    expect(snapshot.items).toHaveLength(504);
    expect(new Set(snapshot.items.map((item) => item.item_key)).size).toBe(504);
    expect(new Set(snapshot.items.map((item) => item.ordinal)).size).toBe(504);
    expect(new Set(snapshot.items.map((item) => item.speech_act)).size).toBe(9);
    for (const speechAct of new Set(snapshot.items.map((item) => item.speech_act))) {
      expect(snapshot.items.filter((item) => item.speech_act === speechAct)).toHaveLength(56);
    }
  });

  it("refuses to label a smoke plan as the final corpus", () => {
    expect(() => buildFinalCorpusPlanSnapshot(buildBatchPlan())).toThrow(/504/);
  });
});
