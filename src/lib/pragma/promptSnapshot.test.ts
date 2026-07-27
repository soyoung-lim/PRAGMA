import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { PROMPT_SNAPSHOT } from "@/lib/pragma/promptSnapshot.generated";

function prompt(key: string) {
  const entry = PROMPT_SNAPSHOT.prompts.find((item) => item.key === key);
  if (!entry) throw new Error(`프롬프트 스냅샷에 ${key}가 없습니다.`);
  return entry;
}

describe("prompt snapshot integrity", () => {
  it("matches the current Edge source", () => {
    const source = readFileSync(
      resolve(process.cwd(), PROMPT_SNAPSHOT.edge_source),
      "utf8",
    );
    const sourceHash = createHash("sha256").update(source).digest("hex");

    expect(PROMPT_SNAPSHOT.edge_source_sha256).toBe(sourceHash);
  });

  it("keeps written and spoken feedback on the same diagnostic rubric", () => {
    const written = prompt("feedback.system");
    const spoken = prompt("feedback.system.spoken");

    expect(spoken.text).toBe(written.text);
    expect(spoken.sha256).toBe(written.sha256);
    expect(written.text).toContain("학습자가 방금 제출한 중국어 산출");
    expect(written.text).toContain(
      "달라진 요청 강도·선택권은 ③에서만 판정한다",
    );
  });
});
