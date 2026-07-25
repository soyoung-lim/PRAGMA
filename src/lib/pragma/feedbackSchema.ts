// runtime_feedback (feedback_v1) — 학습자 산출에 대한 3층 진단. 생성계약 §4.
//
// 지위(0-q·95): **학습 지원용 질적 피드백**이다. 점수·총점을 산출하지 않고,
// 효과 측정에 쓰지 않는다. 화용층은 단정하지 않으며 복수의 적절한 표현을 전제한다.
//
// 설계상 반드시 지킬 것:
//  ① `revision_scope`는 **모델이 정하지 않는다** — verdicts에서 코드가 도출한다(§4).
//     모델에게 맡기면 "무엇을 고칠 차례인가"가 흔들려 피드백 화면이 일관성을 잃는다.
//  ② 교차 검증(D25) — clean이면 grammar 비어야 하고, impeding_errors면 1건 있어야 한다.
//  ③ 방향 중립 키 — alternatives[].text (계약 §4 원문의 `.zh`는 0-l 양방향 이전 표기.
//     zh_ko에서는 산출이 한국어이므로 언어 고정 키를 쓸 수 없다).
//  ④ uncertainty_flags는 **화면 비노출·로그 전용**(캘리브레이션 표본용, 삭제 금지).

import { z } from "zod";

export const SEMANTIC_FIDELITY = ["preserved", "minor_loss", "distorted"] as const;
export const GRAMMATICAL_ACCURACY = ["clean", "impeding_errors"] as const;
export const REVISION_SCOPES = ["meaning", "grammar", "feature", "clear"] as const;
export type RevisionScope = (typeof REVISION_SCOPES)[number];

const GrammarNoteSchema = z.object({
  // v1.4(0-d·33): error_type·anchor_text는 선택 필드.
  error_type: z
    .enum([
      "function_word",
      "word_order",
      "lexical_choice",
      "collocation",
      "missing_component",
      "redundant_component",
      "other",
    ])
    .optional(),
  /** 답안 내 실제 존재를 검증할 앵커(숫자 offset 없음) */
  anchor_text: z.string().optional(),
  suggested_correction: z.string().min(1),
  explanation_ko: z.string().min(1),
});
export type GrammarNote = z.infer<typeof GrammarNoteSchema>;

export const FeedbackVerdictsSchema = z.object({
  semantic_fidelity: z.enum(SEMANTIC_FIDELITY),
  grammatical_accuracy: z.enum(GRAMMATICAL_ACCURACY),
  pragmatic_appropriateness: z.object({
    feature_code: z.string().min(1),
    band_code: z.string().min(1),
  }),
});
export type FeedbackVerdicts = z.infer<typeof FeedbackVerdictsSchema>;

/** 모델이 돌려주는 형태 — revision_scope 없음(코드가 도출한다). */
export const FeedbackDraftSchema = z.object({
  verdicts: FeedbackVerdictsSchema,
  blocks: z.object({
    meaning_ko: z.string().default(""),
    grammar: z.array(GrammarNoteSchema).max(1).default([]), // lite: 최대 1건(0-b·18)
    feature_ko: z.string().default(""),
    alternatives: z
      .array(z.object({ text: z.string().min(1), note_ko: z.string().default("") }))
      .max(2)
      .default([]),
  }),
  uncertainty_flags: z
    .array(
      z.object({
        dimension: z.enum(["grammar", "pragmatic"]),
        reason: z.string().default(""),
      }),
    )
    .default([]),
});

export const FeedbackSchema = FeedbackDraftSchema.extend({
  schema_version: z.literal("feedback_v1"),
  rubric_version: z.string().default(""),
  revision_scope: z.enum(REVISION_SCOPES),
  provenance: z.object({
    model: z.string().default(""),
    prompt_version: z.string().default(""),
    generated_at: z.string().default(""),
  }),
});
export type RuntimeFeedback = z.infer<typeof FeedbackSchema>;

/**
 * revision_scope 도출 — 코드 소관(§4). 우선순위 = 의미 → 문법 → 화용 → 없음.
 * 근거(0-q·95): 먼저 "상황에서 기능하는가·의도가 전달되는가"를 보고, 그다음
 * 이해를 막는 오류, 마지막으로 화용 인상을 본다. 특정 표현의 유무로 판정하지 않는다.
 */
export function deriveRevisionScope(v: FeedbackVerdicts, withinBandCode: string): RevisionScope {
  if (v.semantic_fidelity !== "preserved") return "meaning";
  if (v.grammatical_accuracy === "impeding_errors") return "grammar";
  if (v.pragmatic_appropriateness.band_code !== withinBandCode) return "feature";
  return "clear";
}

/**
 * 교차 필드 정합(D25). 모델 응답의 흔한 모순을 **버리지 않고 교정**한다 —
 * 피드백 1건이 통째로 사라지는 것보다, 모순된 층만 정리하는 편이 학습자에게 낫다.
 * 반환된 issues는 로그·디버깅용(화면 비노출).
 */
export function reconcileFeedback(draft: z.infer<typeof FeedbackDraftSchema>): {
  verdicts: FeedbackVerdicts;
  blocks: z.infer<typeof FeedbackDraftSchema>["blocks"];
  issues: string[];
} {
  const issues: string[] = [];
  const verdicts = { ...draft.verdicts };
  // zod default()가 채우지만 strict:false 환경이라 타입상 optional — 방어적으로 편다.
  const blocks = { ...draft.blocks, grammar: [...(draft.blocks.grammar ?? [])] };

  if (verdicts.grammatical_accuracy === "clean" && blocks.grammar.length > 0) {
    // 문법이 깨끗하다면서 교정을 단 경우 — 교정을 버린다(감점 근거가 없으므로).
    issues.push("clean인데 grammar가 비어 있지 않아 제거함");
    blocks.grammar = [];
  }
  if (verdicts.grammatical_accuracy === "impeding_errors" && blocks.grammar.length === 0) {
    // 오류가 있다면서 무엇인지 못 대면 판정을 내린다 — 근거 없는 지적을 남기지 않는다.
    issues.push("impeding_errors인데 grammar가 비어 clean으로 강등함");
    verdicts.grammatical_accuracy = "clean";
  }
  return { verdicts, blocks, issues };
}

/** anchor_text가 실제 학습자 답안에 있는지 — 없으면 앵커만 떼고 설명은 남긴다. */
export function stripPhantomAnchors(blocks: { grammar?: GrammarNote[] }, answer: string): string[] {
  const issues: string[] = [];
  for (const g of blocks.grammar ?? []) {
    if (g.anchor_text && !answer.includes(g.anchor_text)) {
      issues.push(`anchor_text "${g.anchor_text}"가 답안에 없어 제거함`);
      delete g.anchor_text;
    }
  }
  return issues;
}

// ── 학습자 화면 라벨 (내부 코드 비노출) ────────────────────────────────
export const SEMANTIC_LABEL: Record<string, string> = {
  preserved: "뜻이 그대로 전달됩니다",
  minor_loss: "일부 뉘앙스가 옅어졌습니다",
  distorted: "뜻이 달라진 부분이 있습니다",
};
export const GRAMMAR_LABEL: Record<string, string> = {
  clean: "이해를 막는 오류 없음",
  impeding_errors: "이해를 방해하는 부분이 있습니다",
};
/** 다듬기 단계에서 "무엇을 볼 차례인가"를 알려주는 라벨. */
export const SCOPE_LABEL: Record<RevisionScope, string> = {
  meaning: "뜻 전달",
  grammar: "이해를 막는 표현",
  feature: "상대에게 주는 인상",
  clear: "특별히 고칠 곳 없음",
};
