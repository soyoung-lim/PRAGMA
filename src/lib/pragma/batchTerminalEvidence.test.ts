import { describe, expect, it } from "vitest";

import {
  coreTerminalEvidence,
  itemIndexFromPlanItemKey,
  missionTerminalEvidence,
} from "./batchTerminalEvidence";

describe("batch terminal evidence", () => {
  it("recovers the plan index and structured boundary terminal cause", () => {
    const record = missionTerminalEvidence("run-09", {
      scenarioId: "scenario-1",
      generationItemKey: "ko_zh|request|intermediate|school|translation|equal|close|mid|theme|topic|-|-|40",
      ok: false,
      reused: false,
      terminal: {
        terminalStage: "relative_boundary",
        itemCandidatePaths: ["mpj_items[4].candidates[3]"],
        deterministicFailureCodes: [],
        criticVerdict: "UNKNOWN",
        criticFindingCodes: [],
        attemptNo: 1,
        regenerationCount: 1,
        operation: "relative_boundary_candidate_fallback",
        operationResult: "failed",
        infrastructureError: false,
        providerStatus: "UNKNOWN",
        finalOutcome: "terminal_dropout",
        stopCode: "relative_boundary_fallback_failed",
        boundaryFallback: { attempted_paths: ["mpj_items[4].candidates[3]"] },
      },
    }, "2026-08-30T00:00:00.000Z");

    expect(record.item_index).toBe(40);
    expect(record.terminal_stage).toBe("relative_boundary");
    expect(record.regeneration_count).toBe(1);
    expect(record.boundary_fallback).toEqual({ attempted_paths: ["mpj_items[4].candidates[3]"] });
  });

  it("separates core deterministic and infrastructure outcomes", () => {
    const deterministic = coreTerminalEvidence("run-09", {
      index: 0,
      cell: {} as never,
      ok: false,
      terminalStage: "core_deterministic",
      deterministicFailureCodes: ["R26"],
    }, "2026-08-30T00:00:00.000Z");
    expect(deterministic.deterministic_failure_code).toEqual(["R26"]);
    expect(deterministic.infrastructure_error).toBe(false);
    expect(itemIndexFromPlanItemKey(null)).toBe("UNKNOWN");
  });
});
