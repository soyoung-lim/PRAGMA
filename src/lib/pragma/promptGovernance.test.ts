import { describe, expect, it } from "vitest";

import {
  GENERATION_PROMPT_GROUPS,
  LEARNER_RUNTIME_PROMPT_GROUPS,
  PROMPT_GOVERNANCE_GROUPS,
} from "@/lib/pragma/promptGovernance";
import { PROMPT_SNAPSHOT } from "@/lib/pragma/promptSnapshot.generated";

describe("prompt governance grouping", () => {
  it("assigns every generated prompt snapshot group exactly once", () => {
    const actual = [...new Set(PROMPT_SNAPSHOT.prompts.map((prompt) => prompt.group))].sort();
    expect(new Set(PROMPT_GOVERNANCE_GROUPS).size).toBe(PROMPT_GOVERNANCE_GROUPS.length);
    expect([...PROMPT_GOVERNANCE_GROUPS].sort()).toEqual(actual);
  });

  it("keeps generation-side critics with generation and learner feedback outside content review", () => {
    expect(GENERATION_PROMPT_GROUPS).toContain("review");
    expect(GENERATION_PROMPT_GROUPS).not.toContain("runtime");
    expect(LEARNER_RUNTIME_PROMPT_GROUPS).toEqual(["runtime"]);
  });
});
