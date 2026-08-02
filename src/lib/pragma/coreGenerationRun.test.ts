import { describe, expect, it } from "vitest";

import { createCoreGenerationRunId } from "@/lib/pragma/coreGenerationRun";

describe("createCoreGenerationRunId", () => {
  it("같은 생성 조건을 다시 실행해도 새 run id를 만든다", () => {
    const ids = ["run-a", "run-b"];
    const nextUuid = () => ids.shift() ?? "unexpected";

    expect(createCoreGenerationRunId(nextUuid)).toBe("gen-run-a");
    expect(createCoreGenerationRunId(nextUuid)).toBe("gen-run-b");
  });
});
