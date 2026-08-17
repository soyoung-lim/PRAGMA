import { describe, expect, it } from "vitest";

import { buildMissionLearningTrace } from "@/lib/mission/missionLearningTrace";
import type { RuntimeFeedback } from "@/lib/pragma/feedbackSchema";

const feedback: RuntimeFeedback = {
  schema_version: "feedback_v1",
  rubric_version: "request@1",
  verdicts: {
    semantic_fidelity: "preserved",
    grammatical_accuracy: "clean",
    pragmatic_appropriateness: { feature_code: "request", band_code: "too_direct" },
  },
  revision_scope: "feature",
  blocks: {
    meaning_ko: "미팅 장소를 바꿔 달라는 뜻은 유지됐습니다.",
    grammar: [],
    feature_ko: "이 상황에서는 이미 결정된 지시처럼 들릴 수 있습니다.",
    alternatives: [],
  },
  uncertainty_flags: [],
  provenance: { model: "test", prompt_version: "feedback_v1", generated_at: "2026-08-17T00:00:00Z" },
};

describe("mission completion learning trace", () => {
  it("summarizes the problem, preserved meaning, new-problem scan, and learner dissent", () => {
    const rows = buildMissionLearningTrace({
      feedback,
      revisionDecision: "revise",
      revisionRecheck: {
        schema_version: "revision_recheck_v1",
        status: "reflected",
        priority_target: "feature",
        target_reflected: true,
        meaning_preserved: true,
        meaning_status: "preserved",
        new_problem_dimensions: [],
        scan_count: 1,
        checked_at: "2026-08-17T01:00:00Z",
        feedback_snapshot: feedback,
      },
      additionalRevisionUsed: false,
      dissent: {
        kind: "learner_dissent",
        at: "feedback",
        conditions: ["feature"],
        reason_ko: "이 관계에서는 조금 더 직접적이어도 된다고 생각했습니다.",
        created_at: "2026-08-17T01:00:00Z",
      },
    });

    expect(rows.map((row) => row.label)).toEqual([
      "이번에 살펴본 문제",
      "수정하면서 지킨 뜻",
      "수정 뒤 다시 본 점",
      "AI와 다르게 본 점",
    ]);
    expect(rows[2].body).toContain("새 문제가 발견되지 않았습니다");
    expect(rows[3].body).toContain("상대에게 주는 인상");
  });

  it("does not present the first recheck as a check of an additional final revision", () => {
    const rows = buildMissionLearningTrace({
      feedback,
      revisionDecision: "revise",
      revisionRecheck: null,
      additionalRevisionUsed: true,
      dissent: null,
    });

    expect(rows[1].body).toContain("자동 재확인을 다시 실행하지 않았습니다");
    expect(rows[2].body).toContain("최종 문장의 새 문제 여부");
  });
});
