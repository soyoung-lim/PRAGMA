import type { LearnerDissent } from "@/lib/mission/missionAttemptRow";
import type {
  RevisionDecision,
  RevisionRecheckResult,
} from "@/lib/mission/missionFlow";
import type { RuntimeFeedback } from "@/lib/pragma/feedbackSchema";

export interface MissionLearningTraceRow {
  label: string;
  body: string;
}

const DISSENT_LABELS: Record<string, string> = {
  relationship: "관계·친밀도",
  burden: "부탁의 부담",
  preceding: "앞선 대화 흐름",
  experience: "실제 사용 경험",
  situation: "상황 해석",
  meaning: "뜻 전달",
  grammar: "문법 판단",
  feature: "상대에게 주는 인상",
  alternative: "참고 표현",
};

function feedbackFocus(feedback: RuntimeFeedback): string {
  const grammar = feedback.blocks.grammar?.[0];
  switch (feedback.revision_scope) {
    case "meaning":
      return feedback.blocks.meaning_ko;
    case "grammar":
      return grammar?.explanation_ko ?? feedback.blocks.meaning_ko;
    case "feature":
      return feedback.blocks.feature_ko;
    case "clear":
      return feedback.blocks.feature_ko || "이 상황에서 뜻과 표현이 안정적으로 전달되는지 확인했습니다.";
  }
}

function meaningTrace(
  feedback: RuntimeFeedback,
  recheck: RevisionRecheckResult | null,
  additionalRevisionUsed: boolean,
): string {
  if (additionalRevisionUsed) {
    return "한 번 더 고친 최종 문장은 자동 재확인을 다시 실행하지 않았습니다.";
  }
  if (!recheck) return feedback.blocks.meaning_ko;
  if (recheck.meaning_status === "preserved") {
    return "재확인에서는 원문의 핵심 의미와 화행 목적이 보존된 것으로 나타났습니다.";
  }
  if (recheck.meaning_status === "target_not_yet_reflected") {
    return "재확인에서는 기존의 의미 문제가 아직 일부 남은 것으로 나타났습니다.";
  }
  return "재확인에서는 수정 중 새로운 의미 문제가 생긴 것으로 나타났습니다.";
}

function newProblemTrace(
  recheck: RevisionRecheckResult | null,
  additionalRevisionUsed: boolean,
): string {
  if (additionalRevisionUsed) {
    return "추가 수정은 두 번째 자동 재확인을 하지 않았으므로, 최종 문장의 새 문제 여부는 별도로 살펴봐야 합니다.";
  }
  if (!recheck) return "자동 재확인 결과가 없어 새 문제 여부를 확정하지 않았습니다.";
  if (recheck.new_problem_dimensions.length === 0) {
    return "재확인에서는 뜻·문법·상대에게 주는 인상에서 새 문제가 발견되지 않았습니다.";
  }
  const labels = recheck.new_problem_dimensions.map((dimension) => ({
    meaning: "뜻 전달",
    grammar: "문법",
    pragmatic: "상대에게 주는 인상",
  })[dimension]);
  return `재확인에서는 수정 뒤 ${labels.join("·")}에 새로 살펴볼 문제가 나타났습니다.`;
}

export function buildMissionLearningTrace(input: {
  feedback: RuntimeFeedback | null;
  revisionDecision: RevisionDecision | null;
  revisionRecheck: RevisionRecheckResult | null;
  additionalRevisionUsed: boolean;
  dissent: LearnerDissent | null;
}): MissionLearningTraceRow[] {
  const { feedback, revisionDecision, revisionRecheck, additionalRevisionUsed, dissent } = input;
  if (!feedback) return [];

  const rows: MissionLearningTraceRow[] = [
    {
      label: feedback.revision_scope === "clear" ? "이번에 확인한 점" : "이번에 살펴본 문제",
      body: feedbackFocus(feedback),
    },
    {
      label: "수정하면서 지킨 뜻",
      body: meaningTrace(feedback, revisionRecheck, additionalRevisionUsed),
    },
  ];

  if (revisionDecision === "revise") {
    rows.push({
      label: "수정 뒤 다시 본 점",
      body: newProblemTrace(revisionRecheck, additionalRevisionUsed),
    });
  }

  if (dissent) {
    const conditions = dissent.conditions
      .map((condition) => DISSENT_LABELS[condition] ?? condition)
      .join("·");
    rows.push({
      label: "AI와 다르게 본 점",
      body: [conditions, dissent.reason_ko].filter(Boolean).join(" — "),
    });
  }

  return rows;
}
