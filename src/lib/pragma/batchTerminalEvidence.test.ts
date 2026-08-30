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
        criticFindings: [{ code: "R27", path: "mpj_items[4].situation_ko", severity: "fail", finding: "scene mismatch" }],
        topology: {
          firstPassResult: "fail",
          finalResult: "pass",
          attempts: 2,
          regenerationCount: 1,
          findings: [{ attempt: 1, code: "R27", path: "y.situation_ko", message: "duplicate" }],
        },
        initialR27Findings: [{ code: "R27", path: "mpj_items[4].situation_ko", message: "duplicate" }],
        r27RepairAttempted: true,
        postRepairDeterministicResult: "pass",
        postRepairDeterministicFindings: [],
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
    expect(record.topology_regeneration_count).toBe(1);
    expect(record.topology_deterministic_finding[0]?.path).toBe("y.situation_ko");
    expect(record.full_mission_initial_r27).toHaveLength(1);
    expect(record.r27_repair_attempted).toBe(true);
    expect(record.critic_finding[0]?.finding).toBe("scene mismatch");
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

  it("records a failed optional repair without mislabelling it as no operation", () => {
    const record = missionTerminalEvidence("run-09", {
      scenarioId: "scenario-2",
      generationItemKey: "ko_zh|request|intermediate|school|translation|equal|close|mid|theme|topic|-|-|120",
      ok: true,
      reused: false,
      qualityVerdict: "warning",
      terminal: {
        terminalStage: "eligible",
        itemCandidatePaths: [],
        deterministicFailureCodes: [],
        criticVerdict: "warning",
        criticFindingCodes: [],
        attemptNo: 1,
        regenerationCount: 0,
        operation: "mission_item_repair_or_candidate_regeneration",
        operationResult: "failed",
        operationError: "optional repair rejected",
        infrastructureError: false,
        providerStatus: "UNKNOWN",
        finalOutcome: "eligible",
      },
    }, "2026-08-30T00:00:00.000Z");

    expect(record.repair_fallback_operation).toBe("mission_item_repair_or_candidate_regeneration");
    expect(record.repair_fallback_result).toBe("failed");
    expect(record.terminal_error).toBe("optional repair rejected");
  });
});
