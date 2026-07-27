import {
  FeedbackDraftSchema,
  deriveRevisionScope,
  reconcileFeedback,
  stripPhantomAnchors,
  stripVacuousAlternatives,
  validatePragmaticCodes,
  type RevisionScope,
  type RuntimeFeedback,
} from "@/lib/pragma/feedbackSchema";
import type { TargetFeature } from "@/lib/pragma/targetFeatures";

type FeedbackFeature = Pick<TargetFeature, "code" | "band_schema" | "within_band_code">;

export type FeedbackNormalizationResult =
  | { ok: true; feedback: RuntimeFeedback; issues: string[] }
  | { ok: false; error: string };

function missingPrimaryGuidance(
  scope: RevisionScope,
  blocks: {
    meaning_ko?: string;
    grammar?: Array<{ explanation_ko?: string }>;
    feature_ko?: string;
  },
): string | null {
  if (scope === "meaning" && !blocks.meaning_ko?.trim()) return "의미 판정 설명이 비어 있음";
  if (scope === "grammar" && !blocks.grammar?.[0]?.explanation_ko?.trim()) return "문법 판정 설명이 비어 있음";
  if (scope === "feature" && !blocks.feature_ko?.trim()) return "화용 판정 설명이 비어 있음";
  return null;
}

/**
 * Edge의 비신뢰 JSON을 학습자 화면에서 사용할 수 있는 runtime_feedback으로 바꾼다.
 * 네트워크와 분리해 모든 거부·교정 경로를 결정론적으로 회귀 테스트할 수 있게 한다.
 */
export function normalizeFeedbackResponse(
  raw: unknown,
  answer: string,
  feature: FeedbackFeature,
): FeedbackNormalizationResult {
  const parsed = FeedbackDraftSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: `피드백 형식 불일치: ${parsed.error.issues[0]?.message ?? ""}` };
  }

  const pragmaticCodeIssue = validatePragmaticCodes(
    parsed.data.verdicts,
    feature.code,
    feature.band_schema.map((band) => band.code),
  );
  if (pragmaticCodeIssue) {
    return { ok: false, error: `피드백 판정 코드 불일치: ${pragmaticCodeIssue}` };
  }

  const { verdicts, blocks, issues } = reconcileFeedback(parsed.data);
  const anchorIssues = stripPhantomAnchors(blocks, answer);
  const alternativeIssues = stripVacuousAlternatives(blocks, answer);
  const revision_scope = deriveRevisionScope(verdicts, feature.within_band_code);
  const guidanceIssue = missingPrimaryGuidance(revision_scope, blocks);
  if (guidanceIssue) {
    // 핵심 카드가 빈 상태로 학습자에게 노출되는 것보다 카탈로그 원리문장 폴백이 안전하다.
    return { ok: false, error: `피드백 근거 불충분: ${guidanceIssue}` };
  }
  const envelope = raw as {
    rubric_version?: unknown;
    provenance?: { model?: unknown; prompt_version?: unknown; generated_at?: unknown };
  };
  const provenance = envelope?.provenance;

  return {
    ok: true,
    feedback: {
      schema_version: "feedback_v1",
      rubric_version: typeof envelope?.rubric_version === "string" ? envelope.rubric_version : "",
      verdicts,
      revision_scope,
      blocks,
      uncertainty_flags: parsed.data.uncertainty_flags,
      provenance: {
        model: typeof provenance?.model === "string" ? provenance.model : "",
        prompt_version:
          typeof provenance?.prompt_version === "string" ? provenance.prompt_version : "feedback_v1",
        generated_at: typeof provenance?.generated_at === "string" ? provenance.generated_at : "",
      },
    },
    issues: [...issues, ...anchorIssues, ...alternativeIssues],
  };
}
