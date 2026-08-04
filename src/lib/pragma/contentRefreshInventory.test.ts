import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { CURRENT_CONTENT_RELEASE_ID } from "../../../supabase/functions/_shared/contentRelease";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/queries/content_refresh_inventory.sql"),
  "utf8",
);

describe("content refresh inventory SQL", () => {
  it("tracks the same candidate ID as the runtime manifest", () => {
    expect(sql).toContain(CURRENT_CONTENT_RELEASE_ID);
  });

  it("is read-only and audits every scenario dependency before refresh", () => {
    const executable = sql
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("--"))
      .join("\n");

    expect(executable).not.toMatch(/\b(delete|update|insert|truncate|drop|alter)\b/i);
    for (const table of [
      "curriculum_week_scenarios",
      "package_items",
      "assessment_form_items",
      "learner_mission_logs",
      "scenario_feedback",
      "scenario_candidates",
    ]) {
      expect(executable).toContain(table);
    }
  });
});
