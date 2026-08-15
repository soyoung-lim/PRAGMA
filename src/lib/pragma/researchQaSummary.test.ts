import { describe, expect, it } from "vitest";

import { FINAL_CORPUS_TARGET_MINIMUM, buildResearchQaSummary } from "./researchQaSummary";

describe("research QA summary", () => {
  it("keeps calibration assets visibly separate from the future final corpus", () => {
    const summary = buildResearchQaSummary();
    expect(summary.calibration.dataset_class).toBe("test_only");
    expect(summary.calibration.case_count).toBe(30);
    expect(summary.calibration.candidate_count).toBe(90);
    expect(summary.calibration.pending_semantic_count).toBe(90);
    expect(summary.final_corpus.status).toBe("not_generated");
    expect(summary.final_corpus.current_item_count).toBe(0);
    expect(summary.final_corpus.target_minimum).toBe(FINAL_CORPUS_TARGET_MINIMUM);
    expect(summary.final_corpus.planned_item_count).toBe(504);
    expect(summary.final_corpus.plan_version).toContain("504");
  });

  it("reports current evidence lifecycle, regression, and lineage contracts", () => {
    const summary = buildResearchQaSummary();
    expect(summary.evidence.active_count).toBe(summary.evidence.total_count);
    expect(summary.evidence.source_verified_count).toBe(5);
    expect(summary.calibration.engineering_regression.gate_status).toBe("pass");
    expect(summary.calibration.expert_release_regression.gate_status).toBe("not_runnable");
    expect(summary.lineage.maximum_batch_size).toBe(5);
    expect(summary.lineage.prompt_count).toBe(19);
  });
});
