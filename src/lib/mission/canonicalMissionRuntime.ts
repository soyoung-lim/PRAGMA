import { LEVEL, SPEECH_ACT_UI, type ChannelUI } from "@/lib/pragma/enums";
import type { Pdr } from "@/lib/pragma/coreSchema";
import { getTargetFeature } from "@/lib/pragma/targetFeatures";
import type { RunnableMission } from "@/lib/mission/missionDb";
import type {
  BestWorstQuest,
  ChoiceOption,
  DctQuest,
  MissionContext,
  MissionQuest,
  CanonicalMissionViewModel,
  ReasonQuest,
} from "@/lib/mission/canonicalMissionPreview";

/** DB 저장 스키마를 현재 승인된 MPJ5 + DCT1 화면 계약으로 투영한다. */

const APPROPRIATENESS_OPTIONS: ChoiceOption[] = [
  { id: "very_appropriate", label: "매우 적절" },
  { id: "somewhat_appropriate", label: "다소 적절" },
  { id: "somewhat_inappropriate", label: "다소 부적절" },
  { id: "very_inappropriate", label: "매우 부적절" },
];

const POWER_LABEL: Record<Pdr["p"], string> = {
  speaker_lower: "상대 높음",
  equal: "동등",
  speaker_higher: "내가 높음",
};

const DISTANCE_LABEL: Record<Pdr["d"], string> = {
  close: "친밀",
  acquaintance: "아는 사이",
  distant: "초면",
};

const BURDEN_LABEL: Record<Pdr["r"], string> = {
  low: "부담 낮음",
  mid: "부담 보통",
  high: "부담 높음",
};

const CHANNEL_LABEL: Record<ChannelUI, MissionContext["channel"]> = {
  email: "이메일",
  messenger: "위챗",
  facetoface: "대면",
  phone: "전화",
};

const LESSON_LABELS = [
  "첫인상 판단",
  "맥락 대비 판단",
  "판단하고 고쳐보기",
  "이유 찾기",
  "여러 초안 비교",
] as const;

type RuntimeMpjCommon = {
  type: string;
  situation_ko: string;
  relation_ko: string;
  channel?: ChannelUI;
  pdr: Pdr;
  source: string;
  preceding_turn?: string | null;
  explanation_ko: string;
  recommended_example: string;
};

type RuntimeScale = RuntimeMpjCommon & {
  type: "scale4";
  target: string;
  highlights: string[];
  accepted_scale_codes: string[];
  reference_scale_code?: string;
};

type RuntimeJudge = RuntimeMpjCommon & {
  type: "judge3";
  target: string;
  highlights: string[];
  accepted_band_codes: string[];
};

type RuntimeFixChoice = RuntimeMpjCommon & {
  type: "fix_choice";
  target: string;
  highlights: string[];
  accepted_band_codes: string[];
  corrections: Array<{ text: string; is_valid: boolean; note_ko: string }>;
};

type RuntimeReasonConf = RuntimeMpjCommon & {
  type: "reason_conf";
  target: string;
  highlights: string[];
  accepted_band_codes: string[];
  reasons: Array<{ id: string; text_ko: string }>;
  accepted_reason_ids: string[];
};

type RuntimeReason = RuntimeMpjCommon & {
  type: "reason";
  target: string;
  highlights: string[];
  problem_band_code: string;
  reasons: Array<{
    id: string;
    text_ko: string;
    kind: "primary" | "pragmatic_misconception" | "meaning_grammar_context";
  }>;
  accepted_reason_id: string;
};

type RuntimeMultiJudge = RuntimeMpjCommon & {
  type: "multi_judge";
  candidates: Array<{ text: string; accepted_band_codes: string[]; note_ko: string }>;
};

export class UnsupportedCanonicalMissionRuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedCanonicalMissionRuntimeError";
  }
}

function contextFrom(input: {
  situation_ko: string;
  relation_ko: string;
  channel?: ChannelUI;
  sourceModality?: "written" | "spoken";
  pdr: Pdr;
  preceding_turn?: string | null;
}): MissionContext {
  const fallbackChannel: MissionContext["channel"] = input.sourceModality === "spoken" ? "대면" : "위챗";
  return {
    situation: input.situation_ko,
    relation: input.relation_ko,
    channel: input.channel ? CHANNEL_LABEL[input.channel] : fallbackChannel,
    pdr: {
      p: POWER_LABEL[input.pdr.p],
      d: DISTANCE_LABEL[input.pdr.d],
      r: BURDEN_LABEL[input.pdr.r],
    },
    precedingTurn: input.preceding_turn ?? undefined,
  };
}

function assertBand(code: string, options: ChoiceOption[]): string {
  if (!options.some((option) => option.id === code)) {
    throw new UnsupportedCanonicalMissionRuntimeError(`미션의 판정 대역이 화용 초점 카탈로그와 맞지 않습니다(${code}).`);
  }
  return code;
}

function runtimeFeedbackMode(pdr: Pdr): DctQuest["feedback"]["mode"] {
  return pdr.p === "speaker_lower" || pdr.d === "distant" || pdr.r === "high"
    ? "needs_mitigation"
    : "avoid_over_mitigation";
}

/** DB 미션을 현재 정본의 다섯 판단 활동 + DCT 흐름에 투영한다. */
export function adaptRunnableMissionToCanonical(runnable: RunnableMission): CanonicalMissionViewModel {
  const { mission } = runnable;
  if (mission.direction !== "ko_zh") {
    throw new UnsupportedCanonicalMissionRuntimeError("정본 실행기의 첫 실데이터 연결은 한→중 미션만 지원합니다.");
  }
  if (mission.production_task.mode !== "translation") {
    throw new UnsupportedCanonicalMissionRuntimeError("정본 실행기의 첫 실데이터 연결은 번역 미션만 지원합니다.");
  }
  if (!runnable.speech_act) {
    throw new UnsupportedCanonicalMissionRuntimeError("화행 정보가 없는 미션은 정본 실행기에 연결할 수 없습니다.");
  }
  const feature = getTargetFeature(mission.unit.target_feature);
  if (!feature || feature.speech_act !== runnable.speech_act) {
    throw new UnsupportedCanonicalMissionRuntimeError("미션 화행과 화용 초점 카탈로그가 맞지 않습니다.");
  }
  const bandOptions: ChoiceOption[] = feature.band_schema.map((band) => ({
    id: band.code,
    label: band.label_ko.replace(/\s*\([^)]*\)\s*$/, ""),
  }));

  const common = (index: number, item: RuntimeMpjCommon) => ({
    id: `A${index + 1}`,
    module: "A" as const,
    shortLabel: LESSON_LABELS[index],
    title: LESSON_LABELS[index],
    context: contextFrom({
      situation_ko: item.situation_ko,
      relation_ko: item.relation_ko,
      channel: item.channel,
      pdr: item.pdr,
      preceding_turn: item.preceding_turn,
    }),
    source: item.source,
  });

  const toBestWorst = (
    multiJudge: RuntimeMultiJudge,
  ): BestWorstQuest => {
    const acceptedBestIds = multiJudge.candidates
      .map((candidate, index) => candidate.accepted_band_codes.includes(feature.within_band_code) ? `A5-${index}` : null)
      .filter((id): id is string => Boolean(id));
    const acceptedWorstIds = multiJudge.candidates
      .map((candidate, index) => candidate.accepted_band_codes.includes(feature.within_band_code) ? null : `A5-${index}`)
      .filter((id): id is string => Boolean(id));
    const recommendedBestIndex = multiJudge.candidates.findIndex(
      (candidate) => candidate.text === multiJudge.recommended_example,
    );
    const bestId = recommendedBestIndex >= 0 ? `A5-${recommendedBestIndex}` : acceptedBestIds[0];
    const worstId = acceptedWorstIds[0];
    if (!bestId || !worstId) {
      throw new UnsupportedCanonicalMissionRuntimeError("여러 초안 비교에 BEST/WORST 참고 대역이 없습니다.");
    }
    return {
      ...common(4, multiJudge),
      kind: "best_worst",
      prompt: "가장 적절한 번역과 가장 부적절한 번역을 하나씩 고르세요.",
      candidates: multiJudge.candidates.map((candidate, index) => {
        const id = `A5-${index}`;
        return {
          id,
          text: candidate.text,
          role: id === bestId ? "best" : id === worstId ? "worst" : "middle",
          note: candidate.note_ko,
        };
      }) satisfies BestWorstQuest["candidates"],
      bestId,
      worstId,
      acceptedBestIds,
      acceptedWorstIds,
      feedback: multiJudge.explanation_ko,
    };
  };

  let quests: MissionQuest[];
  let contrastBefore: string;
  let contrastAfter: string;
  let lessonPoints: CanonicalMissionViewModel["lessonPoints"];

  if (mission.schema_version === "mission_v2") {
    const [rawScale, rawContrast, rawFixChoice, rawReason, rawMultiJudge] = mission.mpj_items;
    if (
      rawScale.type !== "scale4" ||
      rawContrast.type !== "judge3" ||
      rawFixChoice.type !== "fix_choice" ||
      rawReason.type !== "reason_conf" ||
      rawMultiJudge.type !== "multi_judge"
    ) {
      throw new UnsupportedCanonicalMissionRuntimeError("MPJ5 문항 순서가 최신 연결 계약과 맞지 않습니다.");
    }
    const scale = rawScale as unknown as RuntimeScale;
    const contrast = rawContrast as unknown as RuntimeJudge;
    const fixChoice = rawFixChoice as unknown as RuntimeFixChoice;
    const reason = rawReason as unknown as RuntimeReasonConf;
    const multiJudge = rawMultiJudge as unknown as RuntimeMultiJudge;
    const reasonKinds: ReasonQuest["reasons"][number]["kind"][] = [
      "primary",
      "pragmatic_misconception",
      "meaning_grammar_context",
      "meaning_grammar_context",
    ];
    quests = [
      {
        ...common(0, scale),
        kind: "scale",
        prompt: "이 번역안은 이 상황에 얼마나 적절한가요?",
        target: scale.target,
        options: APPROPRIATENESS_OPTIONS,
        referenceAnswer: scale.accepted_scale_codes[0],
        acceptedAnswers: scale.accepted_scale_codes,
        targetHighlights: scale.highlights,
        feedback: scale.explanation_ko,
      },
      {
        ...common(1, contrast),
        kind: "scale",
        prompt: "이 번역안은 이 상황에 맞나요?",
        target: contrast.target,
        options: bandOptions,
        referenceAnswer: assertBand(contrast.accepted_band_codes[0], bandOptions),
        acceptedAnswers: contrast.accepted_band_codes.map((code) => assertBand(code, bandOptions)),
        targetHighlights: contrast.highlights,
        feedback: contrast.explanation_ko,
      },
      {
        ...common(2, fixChoice),
        kind: "fix_choice",
        prompt: "이 상황에서 이 표현은 어떻게 들리나요?",
        target: fixChoice.target,
        judgmentOptions: bandOptions,
        referenceJudgment: assertBand(fixChoice.accepted_band_codes[0], bandOptions),
        corrections: fixChoice.corrections.map((candidate, index) => ({
          id: `A3-${index}`,
          text: candidate.text,
          valid: candidate.is_valid,
          note: candidate.note_ko,
        })),
        targetHighlights: fixChoice.highlights,
        feedback: fixChoice.explanation_ko,
      },
      {
        ...common(3, reason),
        kind: "reason",
        prompt: "이 표현이 상황에 맞지 않는 이유가 무엇인지 고르세요.",
        target: reason.target,
        judgmentOptions: bandOptions,
        referenceJudgment: assertBand(reason.accepted_band_codes[0], bandOptions),
        reasons: reason.reasons.map((item, index) => ({
          id: item.id,
          text: item.text_ko,
          kind: reason.accepted_reason_ids.includes(item.id)
            ? "primary"
            : reasonKinds[index] ?? "meaning_grammar_context",
        })),
        acceptedReasonId: reason.accepted_reason_ids[0],
        acceptedReasonIds: reason.accepted_reason_ids,
        targetHighlights: reason.highlights,
        feedback: reason.explanation_ko,
      },
      toBestWorst(multiJudge),
    ];
    contrastBefore = scale.situation_ko;
    contrastAfter = contrast.situation_ko;
    lessonPoints = mission.mpj_items.map((item, index) => ({
      questId: `A${index + 1}`,
      label: LESSON_LABELS[index],
      text: item.explanation_ko,
      highlights: "highlights" in item && Array.isArray(item.highlights)
        ? item.highlights as string[]
        : undefined,
    }));
  } else if (mission.schema_version === "mission_v5" && mission.mpj_items.length === 5) {
    const [rawScale, rawContrast, rawFixChoice, rawReason, rawMultiJudge] = mission.mpj_items;
    if (
      rawScale.type !== "scale4" ||
      rawContrast.type !== "judge3" ||
      rawFixChoice.type !== "fix_choice" ||
      rawReason.type !== "reason" ||
      rawMultiJudge.type !== "multi_judge"
    ) {
      throw new UnsupportedCanonicalMissionRuntimeError("네이티브 MPJ5 문항 순서가 정본 연결 계약과 맞지 않습니다.");
    }
    const scale = rawScale as unknown as RuntimeScale;
    const contrast = rawContrast as unknown as RuntimeJudge;
    const fixChoice = rawFixChoice as unknown as RuntimeFixChoice;
    const reason = rawReason as unknown as RuntimeReason;
    const multiJudge = rawMultiJudge as unknown as RuntimeMultiJudge;
    quests = [
      {
        ...common(0, scale),
        kind: "scale",
        prompt: "이 번역안은 이 상황에 얼마나 적절한가요?",
        target: scale.target,
        options: APPROPRIATENESS_OPTIONS,
        referenceAnswer: scale.reference_scale_code,
        acceptedAnswers: scale.accepted_scale_codes,
        targetHighlights: scale.highlights,
        feedback: scale.explanation_ko,
      },
      {
        ...common(1, contrast),
        kind: "scale",
        prompt: "앞 장면과 비교했을 때 이 표현은 상황에 맞나요?",
        target: contrast.target,
        options: bandOptions,
        referenceAnswer: assertBand(contrast.accepted_band_codes[0], bandOptions),
        acceptedAnswers: contrast.accepted_band_codes.map((code) => assertBand(code, bandOptions)),
        targetHighlights: contrast.highlights,
        feedback: contrast.explanation_ko,
      },
      {
        ...common(2, fixChoice),
        kind: "fix_choice",
        prompt: "이 상황에서 이 표현은 어떻게 들리나요?",
        target: fixChoice.target,
        judgmentOptions: bandOptions,
        referenceJudgment: assertBand(fixChoice.accepted_band_codes[0], bandOptions),
        corrections: fixChoice.corrections.map((candidate, index) => ({
          id: `A3-${index}`,
          text: candidate.text,
          valid: candidate.is_valid,
          note: candidate.note_ko,
        })),
        targetHighlights: fixChoice.highlights,
        feedback: fixChoice.explanation_ko,
      },
      {
        ...common(3, reason),
        kind: "reason",
        prompt: "이 표현이 상황에 맞지 않는 가장 큰 이유를 고르세요.",
        target: reason.target,
        judgmentOptions: bandOptions,
        referenceJudgment: assertBand(reason.problem_band_code, bandOptions),
        reasons: reason.reasons.map((item) => ({
          id: item.id,
          text: item.text_ko,
          kind: item.kind,
        })),
        acceptedReasonId: reason.accepted_reason_id,
        targetHighlights: reason.highlights,
        feedback: reason.explanation_ko,
      },
      toBestWorst(multiJudge),
    ];
    contrastBefore = scale.situation_ko;
    contrastAfter = contrast.situation_ko;
    lessonPoints = mission.mpj_items.map((item, index) => ({
      questId: `A${index + 1}`,
      label: LESSON_LABELS[index],
      text: item.explanation_ko,
      highlights: "highlights" in item && Array.isArray(item.highlights)
        ? item.highlights
        : undefined,
    }));
  } else if (mission.schema_version === "mission_v4" || mission.schema_version === "mission_v5") {
    const [rawScale, rawFixChoice, rawReason, rawMultiJudge] = mission.mpj_items;
    if (
      rawScale.type !== "scale4" ||
      rawFixChoice.type !== "fix_choice" ||
      rawReason.type !== "reason" ||
      rawMultiJudge.type !== "multi_judge"
    ) {
      throw new UnsupportedCanonicalMissionRuntimeError("과도기 MPJ 문항 순서가 연결 계약과 맞지 않습니다.");
    }
    const scale = rawScale as unknown as RuntimeScale;
    const fixChoice = rawFixChoice as unknown as RuntimeFixChoice;
    const reason = rawReason as unknown as RuntimeReason;
    const multiJudge = rawMultiJudge as unknown as RuntimeMultiJudge;
    const referenceJudgment = assertBand(fixChoice.accepted_band_codes[0], bandOptions);
    quests = [
      {
        ...common(0, scale),
        kind: "scale",
        prompt: "이 번역안은 이 상황에 얼마나 적절한가요?",
        target: scale.target,
        options: APPROPRIATENESS_OPTIONS,
        referenceAnswer: scale.reference_scale_code,
        acceptedAnswers: scale.accepted_scale_codes,
        targetHighlights: scale.highlights,
        feedback: scale.explanation_ko,
      },
      {
        ...common(1, fixChoice),
        kind: "scale",
        prompt: "앞 장면과 비교했을 때 이 표현은 상황에 맞나요?",
        target: fixChoice.target,
        options: bandOptions,
        referenceAnswer: referenceJudgment,
        acceptedAnswers: fixChoice.accepted_band_codes.map((code) => assertBand(code, bandOptions)),
        targetHighlights: fixChoice.highlights,
        feedback: fixChoice.explanation_ko,
      },
      {
        ...common(2, fixChoice),
        kind: "fix_choice",
        prompt: "방금 판단한 표현을 상황에 맞게 고쳐 보세요.",
        target: fixChoice.target,
        judgmentOptions: bandOptions,
        referenceJudgment,
        judgmentQuestId: "A2",
        corrections: fixChoice.corrections.map((candidate, index) => ({
          id: `A3-${index}`,
          text: candidate.text,
          valid: candidate.is_valid,
          note: candidate.note_ko,
        })),
        targetHighlights: fixChoice.highlights,
        feedback: fixChoice.explanation_ko,
      },
      {
        ...common(3, reason),
        kind: "reason",
        prompt: "이 표현이 상황에 맞지 않는 가장 큰 이유를 고르세요.",
        target: reason.target,
        judgmentOptions: bandOptions,
        referenceJudgment: assertBand(reason.problem_band_code, bandOptions),
        reasons: reason.reasons.map((item) => ({
          id: item.id,
          text: item.text_ko,
          kind: item.kind,
        })),
        acceptedReasonId: reason.accepted_reason_id,
        targetHighlights: reason.highlights,
        feedback: reason.explanation_ko,
      },
      toBestWorst(multiJudge),
    ];
    contrastBefore = scale.situation_ko;
    contrastAfter = fixChoice.situation_ko;
    lessonPoints = [
      { questId: "A1", label: LESSON_LABELS[0], text: scale.explanation_ko, highlights: scale.highlights },
      { questId: "A2", label: LESSON_LABELS[1], text: fixChoice.explanation_ko, highlights: fixChoice.highlights },
      {
        questId: "A3",
        label: LESSON_LABELS[2],
        text: fixChoice.corrections.filter((item) => item.is_valid).map((item) => item.note_ko).join(" / "),
        highlights: fixChoice.corrections.filter((item) => item.is_valid).map((item) => item.text),
      },
      { questId: "A4", label: LESSON_LABELS[3], text: reason.explanation_ko, highlights: reason.highlights },
      { questId: "A5", label: LESSON_LABELS[4], text: multiJudge.explanation_ko },
    ];
  } else {
    throw new UnsupportedCanonicalMissionRuntimeError(
      `정본 실데이터 연결이 아직 지원하지 않는 스키마입니다(${mission.schema_version}).`,
    );
  }

  const task = mission.production_task;
  const dctContext = contextFrom({
    situation_ko: task.situation_ko,
    relation_ko: task.relation_ko,
    channel: task.channel,
    sourceModality: task.source_modality,
    pdr: task.pdr,
    preceding_turn: task.preceding_turn,
  });
  const referenceAnswer = task.reference_alternatives[0].text;
  const requestParts: DctQuest["requestParts"] = {
    headAct: { label: "이번 번역에서 전달할 핵심 발화", sourceText: task.source_text },
    supportiveMoves: [],
  };
  const feedback: DctQuest["feedback"] = {
    mode: runtimeFeedbackMode(task.pdr),
    issue: task.reference_alternatives[0].note_ko,
    action: mission.unit.closing_ko,
    success: "원문의 핵심 의미와 상황에 맞는 표현을 함께 확인했습니다.",
    alternatives: task.reference_alternatives.map((alternative) => ({
      text: alternative.text,
      note: alternative.note_ko,
    })),
  };

  quests.push(
    {
      id: "A-DCT",
      module: "A",
      shortLabel: "번역하기",
      title: "상황 번역하기",
      kind: "dct",
      context: dctContext,
      source: task.source_text,
      prompt: "이 말을 중국어로 옮겨 보세요.",
      vocabularyHints: (task.vocabulary_hints ?? []).filter(
        (hint): hint is { source: string; target: string } =>
          typeof hint.source === "string" && typeof hint.target === "string",
      ),
      referenceAnswer,
      requestParts,
      feedback,
    },
    {
      id: "A-FEEDBACK",
      module: "A",
      shortLabel: "피드백·다듬기",
      title: "번역 피드백과 다듬기",
      kind: "dct_feedback",
      dctId: "A-DCT",
      context: dctContext,
      source: task.source_text,
      referenceAnswer,
      requestParts,
      feedback,
    },
  );

  return {
    scenarioId: runnable.scenario_id,
    metaLabel: "실제 미션",
    weekNo: 0,
    speechAct: SPEECH_ACT_UI[runnable.speech_act],
    level: runnable.learner_level ? LEVEL[runnable.learner_level] : "수준 정보 없음",
    supportLevel: runnable.learner_level === "beginner_intermediate"
      ? "beginner"
      : runnable.learner_level === "advanced"
        ? "advanced"
        : "intermediate",
    activityMode: "translation",
    direction: "한국어 → 중국어",
    contrast: {
      before: contrastBefore,
      after: contrastAfter,
      changedDimensions: [],
      note: "첫인상 판단과 맥락 대비 판단에서 상황에 따라 달라지는 적절성을 비교합니다.",
    },
    summaryPrinciple: mission.unit.closing_ko,
    lessonPoints,
    quests,
  };
}
