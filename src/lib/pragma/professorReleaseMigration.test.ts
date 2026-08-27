import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260826125000_professor_release_and_expert_archive.sql"),
  "utf8",
);
const learnerMaterializer = migration.slice(
  migration.indexOf("CREATE OR REPLACE FUNCTION public.materialize_pragma_learner_improvement_candidates"),
);

describe("professor release and expert archive migration", () => {
  it("makes professor-finalized review the learner release endpoint", () => {
    expect(migration).toContain("scenarios_learner_select_professor_reviewed_course_mission");
    expect(migration).toContain("mission_content->'authoring'->>'stage' = 'professor_finalized'");
    expect(migration).toContain("lineage.stage = 'reviewed'");
  });

  it("freezes expert application writes while preserving records", () => {
    expect(migration).toContain("'release_mission'");
    expect(migration).toContain("'assign_mission_expert_review'");
    expect(migration).toContain("REVOKE ALL ON FUNCTION");
    expect(migration).toContain("REVOKE INSERT, UPDATE, DELETE ON");
    expect(migration).not.toMatch(/DROP\s+TABLE/i);
    expect(migration).not.toMatch(/DELETE\s+FROM/i);
    expect(migration).not.toMatch(/TRUNCATE/i);
  });

  it("materializes only consented learner dissent in the current improvement path", () => {
    expect(learnerMaterializer).toContain("event.event_type = 'learner_dissent_submitted'");
    expect(learnerMaterializer).toContain("profile.consent_data_use = true");
    expect(learnerMaterializer).not.toContain("mission_expert_reviews");
    expect(learnerMaterializer).not.toContain("pragma_gold_expert");
    expect(learnerMaterializer).not.toContain("gold_regression_drift");
  });
});
