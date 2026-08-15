import { describe, expect, it } from "vitest";

import { buildMissionLineageMeta } from "./missionLineage";
import { KO_ZH_CORE_PACK_ID, KO_ZH_CORE_REALIZATION_PACK } from "./realizationPack";

describe("mission lineage meta", () => {
  it("links a covered ko→zh feature to versioned rule, risk, and evidence scopes", () => {
    const meta = buildMissionLineageMeta({
      direction: "ko_zh",
      speechAct: "request",
      targetFeature: "request_mitigation_optionality",
    });

    expect(meta.coverage_status).toBe("covered");
    expect(meta.realization_pack_id).toBe(KO_ZH_CORE_PACK_ID);
    expect(meta.realization_pack_version).toBe(KO_ZH_CORE_REALIZATION_PACK.version);
    expect(meta.rule_scope_ids).toContain("RR-KOZH-REQ-MODAL-QUESTION");
    expect(meta.risk_scope_ids).toContain("weak_internal_mitigation");
    expect(meta.evidence_scope_ids).toContain("EV-LI-TAGUCHI-2026-REQUEST-MODIFICATION");
    expect(new Set(meta.evidence_scope_ids).size).toBe(meta.evidence_scope_ids.length);
  });

  it("does not falsely attach the ko→zh pack to uncovered directions or acts", () => {
    expect(
      buildMissionLineageMeta({
        direction: "zh_ko",
        speechAct: "request",
        targetFeature: "request_mitigation_optionality",
      }).coverage_status,
    ).toBe("not_covered");
    expect(
      buildMissionLineageMeta({
        direction: "ko_zh",
        speechAct: "apology",
        targetFeature: "apology_repair",
      }).realization_pack_id,
    ).toBeNull();
  });
});
