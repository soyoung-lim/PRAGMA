import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  MISSION_RULE_CATALOG,
  MISSION_RULE_IDS,
  RETIRED_MISSION_RULE_IDS,
} from "@/lib/pragma/missionRuleCatalog";

describe("mission rule catalogue", () => {
  it("keeps R1-R33, the R1c core subrule and retired R22 explicit", () => {
    expect(MISSION_RULE_CATALOG).toHaveLength(33);
    expect(MISSION_RULE_IDS).toHaveLength(34);
    expect(new Set(MISSION_RULE_IDS).size).toBe(MISSION_RULE_IDS.length);
    expect(MISSION_RULE_CATALOG.map((entry) => entry.displayId)).toEqual([
      "R1 / R1c",
      ...Array.from({ length: 32 }, (_, index) => `R${index + 2}`),
    ]);
    expect(RETIRED_MISSION_RULE_IDS).toEqual(["R22"]);
  });

  it("matches every row of the canonical generation-contract table", () => {
    const contract = readFileSync(
      resolve(process.cwd(), "docs/contracts/PRAGMA_생성계약_정본.md"),
      "utf8",
    );
    const section = contract.split("### 6.5 결정론적 규칙 R1–R33 현행 인벤토리")[1]?.split("\n## 7.")[0];
    expect(section).toBeTruthy();
    const rows = section!
      .split("\n")
      .map((line) => line.trimEnd().match(/^\| (R[^|]+) \| (.+) \| (.+) \|$/))
      .filter((match): match is RegExpMatchArray => Boolean(match))
      .map((match) => ({ displayId: match[1].trim(), check: match[2].trim(), verdict: match[3].trim() }));

    expect(rows).toEqual(
      MISSION_RULE_CATALOG.map(({ displayId, check, verdict }) => ({ displayId, check, verdict })),
    );
  });

  it("does not let implementation findings invent catalogue IDs", () => {
    const source = readFileSync(resolve(process.cwd(), "src/lib/pragma/missionRules.ts"), "utf8");
    const used = [...source.matchAll(/add\(v,\s*"(R(?:1c|[1-9]|[12][0-9]|3[0-3]))"/g)].map(
      (match) => match[1],
    );
    expect(used.length).toBeGreaterThan(0);
    expect(used.filter((id) => !MISSION_RULE_IDS.includes(id as (typeof MISSION_RULE_IDS)[number]))).toEqual([]);
    expect(used).not.toContain("R22");
  });
});
