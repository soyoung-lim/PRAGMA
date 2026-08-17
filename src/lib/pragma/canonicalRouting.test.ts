import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

const CURRENT_CANONICALS = [
  "docs/contracts/PRAGMA_생성계약_정본.md",
  "docs/product/PRAGMA_학습자구조_정본.md",
  "docs/product/PRAGMA_관리자구조_정본.md",
] as const;

const PUBLIC_MISSION_EXPLANATION_SCREENS = [
  "src/pages/Architecture.tsx",
  "src/pages/Roadmap.tsx",
] as const;

function topLevelMarkdown(directory: string) {
  return readdirSync(join(ROOT, directory), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name);
}

function markdownFiles(directory: string): string[] {
  return readdirSync(join(ROOT, directory), { withFileTypes: true }).flatMap((entry) => {
    const relativePath = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return markdownFiles(relativePath);
    return entry.isFile() && entry.name.endsWith(".md") ? [relativePath] : [];
  });
}

describe("canonical document routing", () => {
  it("keeps one date-free current path for each canonical type", () => {
    for (const relativePath of CURRENT_CANONICALS) {
      expect(existsSync(join(ROOT, relativePath)), relativePath).toBe(true);
    }

    const datedCurrentPattern = /_정본_\d{4}-\d{2}-\d{2}\.md$/;
    expect(topLevelMarkdown("docs/contracts").filter((name) => datedCurrentPattern.test(name))).toEqual([]);
    expect(topLevelMarkdown("docs/product").filter((name) => datedCurrentPattern.test(name))).toEqual([]);
  });

  it("keeps the manifest, Claude, and Codex pointed at the same paths", () => {
    const routingDocs = ["docs/CANONICAL.md", "CLAUDE.md", "AGENTS.md"].map((path) => ({
      path,
      content: readFileSync(join(ROOT, path), "utf8"),
    }));

    for (const relativePath of CURRENT_CANONICALS) {
      for (const routingDoc of routingDocs) {
        expect(routingDoc.content, `${routingDoc.path} missing ${relativePath}`).toContain(relativePath);
      }
    }
  });

  it("marks legacy dated documents as historical and non-normative", () => {
    const manifest = readFileSync(join(ROOT, "docs/CANONICAL.md"), "utf8");
    const contractHistory = readFileSync(join(ROOT, "docs/contracts/history/README.md"), "utf8");
    const productHistory = readFileSync(join(ROOT, "docs/product/history/README.md"), "utf8");

    expect(manifest).toContain("history/legacy/");
    expect(manifest).toContain("현재 구현 근거로 사용하지 않는다");
    expect(contractHistory).toContain("정확한 동결 시점을 보장하지");
    expect(productHistory).toContain("정확한 동결 시점을 보장하지");
  });

  it("keeps retired canonical paths out of current routing documents", () => {
    const retiredPaths = [
      "docs/contracts/PRAGMA_생성계약_v1_2026-07-23.md",
      "docs/contracts/PRAGMA_생성계약_정본_2026-07-28.md",
      "docs/contracts/PRAGMA_생성계약_정본_2026-07-29.md",
      "docs/product/PRAGMA_학습자구조_정본_2026-07-28.md",
      "docs/product/PRAGMA_학습자구조_정본_2026-07-29.md",
      "docs/product/PRAGMA_관리자구조_정본_2026-07-28.md",
      "docs/product/PRAGMA_관리자구조_정본_2026-07-29.md",
    ];
    const currentRoutingDocs = ["AGENTS.md", "CLAUDE.md", ...markdownFiles("docs")].filter(
      (path) => !path.includes("/history/"),
    );

    for (const path of currentRoutingDocs) {
      const content = readFileSync(join(ROOT, path), "utf8");
      for (const retiredPath of retiredPaths) {
        expect(content, `${path} still references ${retiredPath}`).not.toContain(retiredPath);
      }
    }
  });

  it("keeps the current mission contract explicit about mission_v6 MPJ4 + DCT1", () => {
    const manifest = readFileSync(join(ROOT, "docs/CANONICAL.md"), "utf8");
    const contract = readFileSync(join(ROOT, CURRENT_CANONICALS[0]), "utf8");

    expect(manifest).toContain("MPJ4 + DCT1 + 수정 재확인");
    expect(contract).toContain("mission_v6` = **MPJ4 + DCT1 + 수정 재확인**");
    expect(contract).not.toMatch(/현행[^\n]*MPJ5|MPJ5\s*\+\s*DCT1[^\n]*(유지|변경 금지|바뀌지 않았다)/);
  });

  it("makes public mission explanations consume the MPJ item-count constant", () => {
    for (const relativePath of PUBLIC_MISSION_EXPLANATION_SCREENS) {
      const content = readFileSync(join(ROOT, relativePath), "utf8");
      expect(content, `${relativePath} must import the canonical count`).toContain("MPJ_ITEM_COUNT");
      expect(content, `${relativePath} must not hardcode current MPJ5 copy`).not.toMatch(
        /MPJ\s*5|다섯\s*(가지\s*)?(예시|문항)|5개\s*(예시|문항)/,
      );
    }
  });
});
