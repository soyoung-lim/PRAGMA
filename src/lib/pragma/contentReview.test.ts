import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_MISSION_V5_NATIVE } from "@/lib/mission/missionV4Sample";
import { buildContentReviewDomain } from "./contentReviewDomain";
import { buildReviewPrompt, instructionalMission, nextReviewStage, reviewHash, validateAdjudication, validateReviewResult,
  type ContentReviewRun, type ReviewResult } from "../../../supabase/functions/_shared/contentReview";
import { callContentReviewer } from "../../../supabase/functions/_shared/contentReviewProvider";

const snapshot = { content: { source: "请您参加活动。" }, criteria: { version: "test" } };
const finding = { severity: "warning", where: "/content/source", quote: "请您参加活动。", issue_ko: "지적", reason_ko: "이유", suggestion_ko: "제안" };
const audit = validateReviewResult({ verdict: "warning", summary_ko: "확인", findings: [finding] }, snapshot, "claude");
const run = () => ({ id: "test", snapshot, rules: { verdict: "pass", findings: [], summary_ko: "규칙" },
  openai_review: { result: { verdict: "pass", summary_ko: "OPENAI_PRIVATE_VERDICT", findings: [] } },
  claude_review: { result: audit }, adjudication: null, approved_at: null,
} as unknown as ContentReviewRun);
beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto);
  // The Edge runtime supplies timeout; jsdom 20 does not. Transport is mocked.
  vi.stubGlobal("AbortSignal", { timeout: () => new AbortController().signal });
});
afterEach(() => vi.unstubAllGlobals());

describe("current content five-stage review", () => {
  it("keeps Claude independent and gives OpenAI the actual audit for adjudication", () => {
    const independent = buildReviewPrompt("claude", snapshot, run());
    expect(independent.user).not.toContain("OPENAI_PRIVATE_VERDICT");
    expect(independent.user).not.toContain("claude-1");
    const reconsider = buildReviewPrompt("adjudication", snapshot, run());
    expect(reconsider.user).toContain("OPENAI_PRIVATE_VERDICT");
    expect(reconsider.user).toContain("claude-1");
  });

  it("requires exactly one reasoned disposition per Claude finding, including rejection", () => {
    const decision = { finding_id: "claude-1", decision: "reject", rationale_ko: "원문에 참여 행위가 명시됨", proposed_change_ko: "", needs_professor: true,
      evidence_path: "/content/source", evidence_quote: "参加活动" };
    expect(validateAdjudication({ summary_ko: "확인", decisions: [decision] }, audit, snapshot).decisions[0].decision).toBe("reject");
    for (const decisions of [[], [decision, decision], [{ ...decision, finding_id: "invented" }], [{ ...decision, rationale_ko: "" }]]) {
      expect(() => validateAdjudication({ summary_ko: "확인", decisions }, audit, snapshot)).toThrow();
    }
    expect(audit.findings[0].issue_ko).toBe("지적");
  });

  it("rejects invented evidence and inconsistent pass verdicts", () => {
    expect(() => validateReviewResult({ verdict: "warning", summary_ko: "확인", findings: [{ ...finding, quote: "없는 원문" }] }, snapshot, "claude")).toThrow();
    expect(() => validateReviewResult({ verdict: "warning", summary_ko: "확인", findings: [{ ...finding, where: "/content/missing" }] }, snapshot, "claude")).toThrow();
    expect(() => validateReviewResult({ verdict: "pass", summary_ko: "확인", findings: [finding] }, snapshot, "claude")).toThrow();
  });

  it("hashes instructional changes but not finalization metadata or object key order", async () => {
    const first = { mpj_items: [{ text: "초안" }], production_task: { source: "원문" }, authoring: { stage: "draft" } };
    const final = { ...first, authoring: { stage: "professor_finalized" }, item_lineage: { data: "attribution" } };
    expect(await reviewHash(instructionalMission(first))).toBe(await reviewHash(instructionalMission(final)));
    expect(await reviewHash({ b: 2, a: 1 })).toBe(await reviewHash({ a: 1, b: 2 }));
    expect(await reviewHash(instructionalMission(first))).not.toBe(await reviewHash(instructionalMission({ ...first, mpj_items: [{ text: "수정" }] })));
  });

  it("does not infer professor approval from model completion", () => {
    expect(nextReviewStage(null)).toBe("rules");
    expect(nextReviewStage({ ...run(), openai_review: null, claude_review: null })).toBe("openai");
    expect(nextReviewStage({ ...run(), claude_review: null })).toBe("claude");
    expect(nextReviewStage(run())).toBe("adjudication");
    expect(nextReviewStage({ ...run(), adjudication: { result: {} } as any })).toBe("professor");
  });

  it("covers raw MPJ5, DCT and core while stripping prior critic findings", () => {
    const domain = buildContentReviewDomain("mission", { scenario: { speech_act: "request", learner_level: "intermediate", mode: "translation",
      core_content: { situation_ko: "상황", quality_check: { summary: "CORE_PRIOR_JUDGMENT" } },
      mission_content: { ...SAMPLE_MISSION_V5_NATIVE, quality_check: { summary: "MISSION_PRIOR_JUDGMENT" } },
    } });
    expect(JSON.stringify(domain.snapshot)).not.toContain("PRIOR_JUDGMENT");
    const content = domain.snapshot.content as any;
    expect(content.mission.mpj_items).toHaveLength(5);
    expect(content.mission.production_task).toEqual(SAMPLE_MISSION_V5_NATIVE.production_task);
    expect(content.context.core_content.situation_ko).toBe("상황");
  });

  it("blocks incomplete weeks and reviews shared original plus unique private notes", () => {
    const source = { outline: { id: "course", title: "수업", level: "intermediate", language_direction: "ko_zh", course_mode: "translation", target_interpreting_week_count: 0 },
      week: { week_no: 2, title: "요청", type: "regular", speech_act: "request", can_do: ["학습목표"] },
      assignments: [{ scenario_id: "m1", week_no: 2, position: 0 }],
      scenarios: [{ scenario_id: "m1", mission_status: "reviewed", mode: "translation", core_content: { situation_ko: "상황입니다.", source_text: "원문" } }],
    };
    const domain = buildContentReviewDomain("weekly_material", source);
    expect(domain.rules.verdict).toBe("fail");
    const content = domain.snapshot.content as any;
    expect(content.public_material.sections[0].items).toContain("학습목표");
    expect(content.instructor_only.features.length).toBeGreaterThan(0);
    expect(content.public_material).not.toHaveProperty("instructor_only");
    expect(domain.dependencies).toEqual(["m1"]);
  });

  it("saves successful provider metadata and never silently retries truncation or refusal", async () => {
    const output: ReviewResult = { verdict: "pass", summary_ko: "지적 없음", findings: [] };
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "reply-1", model: "gpt-test", usage: { total_tokens: 123 },
      choices: [{ finish_reason: "stop", message: { content: JSON.stringify(output) } }] })));
    const result = await callContentReviewer({ stage: "openai", run: run(), apiKey: "test", model: "gpt-test", fetcher });
    expect(result.response_id).toBe("reply-1");
    expect(result.input_hash).toMatch(/^[0-9a-f]{64}$/);
    for (const stop_reason of ["max_tokens", "refusal"]) {
      fetcher.mockResolvedValue(new Response(JSON.stringify({ id: "c", model: "claude-test", stop_reason, content: [] })));
      await expect(callContentReviewer({ stage: "claude", run: run(), apiKey: "test", model: "claude-test", fetcher })).rejects.toThrow();
    }
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});
