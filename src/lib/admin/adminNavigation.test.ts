import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ADMIN_NAV_GROUPS,
  ADMIN_PRIORITY_LINKS,
  adminMobileNavValue,
} from "@/lib/admin/adminNavigation";

const REQUIRED_ENTRY_PATHS = [
  "/admin/research-qa/final-review",
  "/admin/package",
  "/admin/learners",
  "/admin/decision-traces",
  "/admin/research-qa/improvements",
  "/admin/export",
] as const;

describe("admin navigation reachability", () => {
  it("keeps every restored operations/research entry in the shared navigation source", () => {
    expect(ADMIN_PRIORITY_LINKS.map((item) => item.to)).toEqual(REQUIRED_ENTRY_PATHS);
    const allPaths = ADMIN_NAV_GROUPS.flatMap((group) => group.items).map((item) => item.to);
    expect(new Set(allPaths).size).toBe(allPaths.length);
  });

  it("keeps a route or compatibility route for every restored entry", () => {
    const app = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");
    for (const path of REQUIRED_ENTRY_PATHS) {
      expect(app, `missing route ${path}`).toContain(`path="${path}"`);
    }
    expect(app).toContain('path="/admin/review"');
    expect(app).toContain('to="/admin/research-qa/final-review"');
    expect(app).not.toContain('path="/admin/analytics"');
    expect(app).not.toContain('path="/admin/archive"');
    expect(app).not.toContain("AdminQualityOverview");
    expect(app).toContain('path="/admin/research-qa"');
    expect(app).toContain('to="/admin/research-qa/final-review"');

    const missionLogs = readFileSync(
      resolve(process.cwd(), "src/pages/admin/AdminDecisionTraces.tsx"),
      "utf8",
    );
    expect(missionLogs).toContain('.from("learner_mission_logs")');
    expect(missionLogs).not.toContain('.from("decision_traces")');
  });

  it("keeps the mobile selector on the canonical target for compatibility paths", () => {
    expect(adminMobileNavValue("/admin/review")).toBe("/admin/research-qa/final-review");
    expect(adminMobileNavValue("/admin/generator")).toBe("/admin/generator");
    expect(adminMobileNavValue("/admin/batch")).toBe("/admin/batch");
    expect(adminMobileNavValue("/admin/decision-traces")).toBe("/admin/decision-traces");
    expect(adminMobileNavValue("/admin/export")).toBe("/admin/export");
  });
});
