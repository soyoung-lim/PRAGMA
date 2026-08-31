import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260829183000_scope_lock_attempt_lineage.sql"),
  "utf8",
);

describe("Scope Lock course attempt lineage migration", () => {
  it("adds the complete course/week/assignment/attempt/hash tuple without deleting legacy rows", () => {
    for (const column of ["course_id", "week_no", "assignment_id", "attempt_id", "content_hash"]) {
      expect(sql).toContain(`ADD COLUMN IF NOT EXISTS ${column}`);
    }
    expect(sql).toContain("assert_learner_course_assignment");
    expect(sql).toContain("assignment.scenario_id = p_scenario_id");
    expect(sql).toContain("lineage.mission_content_hash = p_content_hash");
    expect(sql).not.toMatch(/DELETE FROM public\.(learner_mission_logs|learner_mission_events)/);
  });

  it("writes the same course tuple to the append-only event stream", () => {
    expect(sql).toContain("course_id, week_no, assignment_id, occurred_at");
    expect(sql).toContain("v_course_id, v_week_no, v_assignment_id");
  });
});
