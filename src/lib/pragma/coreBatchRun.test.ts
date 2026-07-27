import { describe, expect, it } from "vitest";
import type { BatchCell } from "@/lib/pragma/batchPlan";
import {
  coreGenerationItemKey,
  runCoreBatch,
} from "@/lib/pragma/coreBatchRun";

const cell = (overrides: Partial<BatchCell> = {}): BatchCell => ({
  speech_act_ui: "request",
  level: "intermediate",
  domain: "work",
  mode: "translation",
  industry: "trade_distribution",
  pdr_power: "equal",
  pdr_distance: "acquaintance",
  pdr_burden: "mid",
  theme_code: "career_workplace",
  topic_code: "work_request",
  situation_seed_ko: "직장 관계에서 생기는 요청 상황",
  direction: "ko_zh",
  count: 1,
  ...overrides,
});

describe("core batch resume", () => {
  it("모든 연구 축과 반복 index로 안정적인 item key를 만든다", () => {
    const base = cell();
    expect(coreGenerationItemKey(base, 0)).toBe(coreGenerationItemKey(cell(), 0));
    expect(coreGenerationItemKey(base, 0)).not.toBe(
      coreGenerationItemKey(cell({ direction: "zh_ko" }), 0),
    );
    expect(coreGenerationItemKey(base, 0)).not.toBe(
      coreGenerationItemKey(cell({ mode: "stt_interpreting" }), 0),
    );
    expect(coreGenerationItemKey(base, 0)).not.toBe(
      coreGenerationItemKey(cell({ pdr_power: "higher" }), 0),
    );
    expect(coreGenerationItemKey(base, 0)).not.toBe(
      coreGenerationItemKey(base, 1),
    );
  });

  it("같은 run ID의 저장 완료 항목은 AI 호출 없이 완료로 처리한다", async () => {
    const cells = [
      cell(),
      cell({ mode: "stt_interpreting", topic_code: "work_request_spoken" }),
    ];
    const existingItems = new Map(
      cells.map((item, index) => [
        coreGenerationItemKey(item, index),
        {
          scenarioId: `scenario-${index}`,
          coreContent: { situation_ko: `기존 상황 ${index}` },
        },
      ]),
    );
    const progress: number[] = [];

    const result = await runCoreBatch(cells, {
      runId: "core_test",
      existingItems,
      onProgress: (done) => progress.push(done),
    });

    expect(result).toHaveLength(2);
    expect(result.every((item) => item.ok && item.reused)).toBe(true);
    expect(result.map((item) => item.scenarioId)).toEqual([
      "scenario-0",
      "scenario-1",
    ]);
    expect(result.map((item) => item.coreContent?.situation_ko)).toEqual([
      "기존 상황 0",
      "기존 상황 1",
    ]);
    expect(progress).toEqual([1, 2]);
  });
});
