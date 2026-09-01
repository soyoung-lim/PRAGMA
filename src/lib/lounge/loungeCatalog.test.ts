import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  CULTURE_ITEMS,
  DECODE_ITEMS,
  LITERAL_ITEMS,
  LOUNGE_ITEMS,
  loungeItemsFor,
} from "@/lib/lounge/loungeCatalog";

const sourceFiles = (root: string): string[] => readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
  const path = join(root, entry.name);
  if (entry.isDirectory()) {
    if (path.endsWith(join("src", "lib", "lounge"))) return [];
    return sourceFiles(path);
  }
  if (!/\.(ts|tsx)$/.test(entry.name) || /\.(test|spec)\.(ts|tsx)$/.test(entry.name)) return [];
  if (entry.name === "LoungeHub.tsx" || entry.name === "LoungeModulePage.tsx") return [];
  return [path];
});

describe("static learner lounge catalog", () => {
  it("ships exactly ten independent items per module", () => {
    expect(DECODE_ITEMS).toHaveLength(10);
    expect(CULTURE_ITEMS).toHaveLength(10);
    expect(LITERAL_ITEMS).toHaveLength(10);
    expect(LOUNGE_ITEMS).toHaveLength(30);
    expect(loungeItemsFor("decode")).toBe(DECODE_ITEMS);
    expect(loungeItemsFor("culture")).toBe(CULTURE_ITEMS);
    expect(loungeItemsFor("literal")).toBe(LITERAL_ITEMS);
  });

  it("keeps ids and learner-facing source texts unique", () => {
    expect(new Set(LOUNGE_ITEMS.map((item) => item.id)).size).toBe(30);
    expect(new Set(LOUNGE_ITEMS.map((item) => item.source_text)).size).toBe(30);
  });

  it("gives every item a resolvable reference choice without publishing drafts", () => {
    for (const item of LOUNGE_ITEMS) {
      expect(item.choices.length).toBeGreaterThanOrEqual(3);
      expect(item.choices.some((choice) => choice.id === item.answer_id)).toBe(true);
      expect(item.review_status).not.toBe("draft");
    }
  });

  it("separates each module's evidence fields", () => {
    for (const item of DECODE_ITEMS) {
      expect(item.module).toBe("decode");
      expect(item.meaning).toBeTruthy();
      expect(item.why).toBeTruthy();
      expect(item.contrast).toBeTruthy();
    }
    for (const item of CULTURE_ITEMS) {
      expect(item.module).toBe("culture");
      expect(item.verified_facts.length).toBeGreaterThanOrEqual(2);
      expect(item.cultural_context).toBeTruthy();
      expect(item.translation_interpretation).toBeTruthy();
      expect(item.source_refs.some((source) => source.url?.startsWith("https://"))).toBe(true);
      expect(item.source_refs.every((source) => source.checked_at === "2026-09-01")).toBe(true);
    }
    for (const item of LITERAL_ITEMS) {
      expect(item.module).toBe("literal");
      expect(item.issue_layer).toBeTruthy();
      expect(item.adjusted_translation).toBeTruthy();
      expect(item.why_awkward).toBeTruthy();
    }
  });

  it("keeps culture code about cultural practices rather than numeric or slang decoding", () => {
    expect(CULTURE_ITEMS[0].source_text).toContain("春运");
    expect(CULTURE_ITEMS.map((item) => `${item.title} ${item.source_text}`).join("\n"))
      .not.toMatch(/520|YYDS|破防/);
  });

  it("keeps literal traps at the word and collocation layer", () => {
    expect(LITERAL_ITEMS[0].source_text).toContain("발표");
    expect(LITERAL_ITEMS.every((item) => item.language_direction === "ko_zh")).toBe(true);
    expect(LITERAL_ITEMS.every((item) => item.choices.find((choice) => choice.id === item.answer_id)?.label === item.adjusted_translation)).toBe(true);
    expect(LITERAL_ITEMS.map((item) => item.prompt).join("\n")).not.toMatch(/잘못|어색|직역|끌린|그대로/);
    expect(new Set(LITERAL_ITEMS.map((item) => item.issue_layer)))
      .toEqual(new Set(["false_friend", "collocation", "word_sense"]));
  });

  it("does not copy lounge source texts into the core app source", () => {
    const nonLoungeSource = sourceFiles(join(process.cwd(), "src"))
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");
    for (const item of LOUNGE_ITEMS) {
      expect(nonLoungeSource).not.toContain(item.source_text);
    }
  });

  it("keeps the new lounge runtime free of storage and backend clients", () => {
    const runtimeFiles = [
      "src/lib/lounge/loungeCatalog.ts",
      "src/lib/lounge/loungeTypes.ts",
      "src/lib/lounge/decodeItems.ts",
      "src/lib/lounge/cultureItems.ts",
      "src/lib/lounge/literalItems.ts",
      "src/pages/learner/LoungeHub.tsx",
      "src/pages/learner/LoungeModulePage.tsx",
    ];
    const runtimeSource = runtimeFiles.map((path) => readFileSync(join(process.cwd(), path), "utf8")).join("\n");
    expect(runtimeSource).not.toMatch(/supabase|localStorage|sessionStorage|useQuery|useMutation/);
  });
});
