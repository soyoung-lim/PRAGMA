import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(
  path.join(process.cwd(), "src", "App.tsx"),
  "utf8",
);

describe("production route invariants", () => {
  it("keeps the approved learner lounge active", () => {
    expect(appSource).toContain(
      '<Route path="/learner/lounge" element={<RequireApproved><LoungeHub /></RequireApproved>} />',
    );
    expect(appSource).toContain(
      '<Route path="/learner/lounge/:module" element={<RequireApproved><LoungeModulePage /></RequireApproved>} />',
    );
    expect(appSource).not.toContain(
      '<Route path="/learner/lounge" element={<Navigate to="/learner/course"',
    );
  });

  it("keeps the approved backup and research export routes active", () => {
    expect(appSource).toContain(
      '<Route path="/admin/export" element={<RequireAdmin><AdminExport /></RequireAdmin>} />',
    );
    expect(appSource).toContain(
      '<Route path="/admin/data-backup" element={<RequireAdmin><AdminDataBackup /></RequireAdmin>} />',
    );
  });
});
