import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ADMIN_NAV_GROUPS,
  ADMIN_PRIORITY_LINKS,
  adminMobileNavValue,
} from "@/lib/admin/adminNavigation";

const REQUIRED_ENTRY_PATHS = [
  "/admin/review",
  "/admin/package",
  "/admin/learners",
  "/admin/data-backup",
  "/admin/decision-traces",
  "/admin/export",
] as const;

describe("admin navigation reachability", () => {
  it("keeps every restored operations/research entry in the shared navigation source", () => {
    expect(ADMIN_PRIORITY_LINKS.map((item) => item.to)).toEqual(REQUIRED_ENTRY_PATHS);
    const allPaths = ADMIN_NAV_GROUPS.flatMap((group) => group.items).map((item) => item.to);
    expect(new Set(allPaths).size).toBe(allPaths.length);
    expect(allPaths).not.toContain("/admin/question-designer");
    expect(allPaths).not.toContain("/admin/research-qa/calibration");
    expect(ADMIN_NAV_GROUPS.map((group) => group.header)).toEqual([
      "1. 콘텐츠 설계·생성 기준",
      "2. 학습 콘텐츠 제작",
      "3. 강의 준비·운영",
      "4. 학습 기록·연구 자료",
    ]);
    // Sixteen sidebar items plus the standalone dashboard link = seventeen.
    expect(ADMIN_NAV_GROUPS.flatMap((group) => group.items)).toHaveLength(16);
    const standards = ADMIN_NAV_GROUPS.find((group) => group.header === "1. 콘텐츠 설계·생성 기준");
    expect(standards?.items.map((item) => item.label)).toEqual([
      "HSK 3.0 어휘 코퍼스",
      "생성 계약·개발 프롬프트",
    ]);
    const production = ADMIN_NAV_GROUPS.find((group) => group.header === "2. 학습 콘텐츠 제작");
    expect(production?.items.map((item) => item.to)).toEqual([
      "/admin/authentic",
      "/admin/generator",
      "/admin/batch",
      "/admin/library",
      "/admin/assembly",
      "/admin/review-criteria",
      "/admin/review",
    ]);
    const operations = ADMIN_NAV_GROUPS.find((group) => group.header === "3. 강의 준비·운영");
    expect(operations?.items.map((item) => item.to)).toEqual([
      "/admin/composer",
      "/admin/learners",
      "/admin/package",
      "/admin/class-responses",
      "/admin/data-backup",
    ]);
    const research = ADMIN_NAV_GROUPS.find((group) => group.header === "4. 학습 기록·연구 자료");
    expect(research?.items.map((item) => item.to)).toEqual([
      "/admin/decision-traces",
      "/admin/export",
    ]);
  });

  it("keeps a route or compatibility route for every restored entry", () => {
    const app = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");
    for (const path of REQUIRED_ENTRY_PATHS) {
      expect(app, `missing route ${path}`).toContain(`path="${path}"`);
    }
    expect(app).toContain('path="/admin/review"');
    expect(app).toContain('path="/admin/review-criteria"');
    expect(app).toContain('const AdminReviewCriteria = lazy(() => import("./pages/admin/AdminReviewCriteria.tsx"))');
    expect(app).toContain('const AdminExport = lazy(() => import("./pages/admin/AdminExport.tsx"))');
    expect(app).toContain('const AdminDataBackup = lazy(() => import("./pages/admin/AdminDataBackup.tsx"))');
    expect(app).toContain('path="/admin/export" element={<RequireAdmin><AdminExport />');
    expect(app).toContain('path="/admin/data-backup" element={<RequireAdmin><AdminDataBackup />');
    expect(app).toContain('path="/admin/research-qa/calibration"');
    expect(app).toContain('path="/prototype/research-qa-calibration"');
    expect(app).toContain('to="/admin/research-qa/final-review"');
    expect(app).not.toContain('path="/admin/analytics"');
    expect(app).not.toContain('path="/admin/archive"');
    expect(app).not.toContain('path="/admin/question-designer"');
    expect(app).not.toContain("AdminQualityOverview");
    expect(app).toContain('path="/admin/research-qa"');
    expect(app).toContain('to="/admin/research-qa/final-review"');

    const shell = readFileSync(resolve(process.cwd(), "src/components/AdminShell.tsx"), "utf8");
    expect(shell).not.toContain("item.separated");

    const missionLogs = readFileSync(
      resolve(process.cwd(), "src/pages/admin/AdminDecisionTraces.tsx"),
      "utf8",
    );
    expect(missionLogs).toContain('.from("learner_mission_logs")');
    expect(missionLogs).not.toContain('.from("decision_traces")');

    const exportPage = readFileSync(
      resolve(process.cwd(), "src/pages/admin/AdminExport.tsx"),
      "utf8",
    );
    expect(exportPage).toContain("동의·가명화 필터");
    expect(exportPage).not.toContain("약 40명");
  });

  it("keeps the mobile selector on the canonical target for compatibility paths", () => {
    expect(adminMobileNavValue("/admin/review")).toBe("/admin/review");
    expect(adminMobileNavValue("/admin/review-criteria")).toBe("/admin/review-criteria");
    expect(adminMobileNavValue("/admin/research-qa/releases")).toBe("/admin/review");
    expect(adminMobileNavValue("/admin/research-qa/calibration")).toBe("");
    const production = ADMIN_NAV_GROUPS.find((group) => group.header === "2. 학습 콘텐츠 제작");
    expect(production?.items.at(-1)?.to).toBe("/admin/review");
    expect(ADMIN_NAV_GROUPS.some((group) => group.header.includes("품질관리"))).toBe(false);
    expect(adminMobileNavValue("/admin/generator")).toBe("/admin/generator");
    expect(adminMobileNavValue("/admin/authentic")).toBe("/admin/authentic");
    expect(adminMobileNavValue("/admin/batch")).toBe("/admin/batch");
    expect(adminMobileNavValue("/admin/data-backup")).toBe("/admin/data-backup");
    expect(adminMobileNavValue("/admin/decision-traces")).toBe("/admin/decision-traces");
    expect(adminMobileNavValue("/admin/export")).toBe("/admin/export");
  });
});
