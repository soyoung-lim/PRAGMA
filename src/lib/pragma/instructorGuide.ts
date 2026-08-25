import type { Pdr } from "@/lib/pragma/coreSchema";
import type { MissionRuntime, MpjItemRuntime } from "@/lib/pragma/missionSchema";

const ITEM_TITLE: Record<string, string> = {
  scale4: "첫인상 판단",
  judge3: "맥락 대비 판단",
  fix_choice: "판단하고 고쳐보기",
  reason_conf: "판단 근거 찾기",
  reason: "판단 근거 찾기",
  multi_judge: "여러 초안 비교",
};

const PDR_AXIS = {
  p: { short: "P", label: "힘의 관계" },
  d: { short: "D", label: "사회적 거리" },
  r: { short: "R", label: "부담" },
} as const;

const PDR_VALUE_KO = {
  speaker_lower: "화자가 낮음",
  equal: "동등",
  speaker_higher: "화자가 높음",
  close: "친밀",
  acquaintance: "지인",
  distant: "초면·먼 관계",
  low: "낮음",
  mid: "중간",
  high: "높음",
} as const;

type PdrAxis = keyof typeof PDR_AXIS;

export type InstructorGuideCandidate = {
  text: string;
  noteKo: string;
  judgmentKo?: string;
};

export type InstructorGuideItem = {
  id: number;
  titleKo: string;
  situationKo: string;
  source: string;
  designIntentKo: string;
  candidates: InstructorGuideCandidate[];
};

export type InstructorGuideContrast = {
  verified: boolean;
  preservedKo: string[];
  changedKo?: string;
  firstSituationKo: string;
  secondSituationKo: string;
};

export type InstructorMissionGuide = {
  speechActKo: string;
  itemFocusKo: string;
  situationKo: string;
  relationKo: string;
  pdrKo: string[];
  mpjItems: InstructorGuideItem[];
  misconceptionKo?: string;
  coreReasonKo?: string;
  contrast: InstructorGuideContrast;
  microscope: {
    expression: string;
    source: string;
    functionAndEffectKo: string;
    adjustmentExample: string;
  };
  dct: {
    situationKo: string;
    sourceText: string;
    alternatives: Array<{ text: string; noteKo: string }>;
  };
  recontextualization: {
    situationKo: string;
    relationKo: string;
    promptKo: string;
  };
};

function pdrValueKo(value: string): string {
  return PDR_VALUE_KO[value as keyof typeof PDR_VALUE_KO] ?? value;
}

export function formatPdr(pdr: Pdr): string[] {
  return (["p", "d", "r"] as PdrAxis[]).map(
    (axis) => `${PDR_AXIS[axis].short} · ${PDR_AXIS[axis].label}: ${pdrValueKo(pdr[axis])}`,
  );
}

function comparePdr(first: Pdr, second: Pdr): InstructorGuideContrast {
  const axes = ["p", "d", "r"] as PdrAxis[];
  const changed = axes.filter((axis) => first[axis] !== second[axis]);
  const preserved = axes
    .filter((axis) => first[axis] === second[axis])
    .map((axis) => `${PDR_AXIS[axis].short}(${pdrValueKo(first[axis])})`);
  const changedAxis = changed[0];
  return {
    verified: changed.length === 1,
    preservedKo: preserved,
    ...(changed.length === 1
      ? {
          changedKo: `${PDR_AXIS[changedAxis].short}(${PDR_AXIS[changedAxis].label}): ${pdrValueKo(first[changedAxis])} → ${pdrValueKo(second[changedAxis])}`,
        }
      : {}),
    firstSituationKo: "",
    secondSituationKo: "",
  };
}

function candidatesOf(item: MpjItemRuntime): InstructorGuideCandidate[] {
  if (item.type === "fix_choice") {
    return item.corrections.map((candidate) => ({
      text: candidate.text,
      noteKo: candidate.note_ko,
      judgmentKo: candidate.is_valid ? "이 맥락에서 적정" : "조정 필요",
    }));
  }
  if (item.type === "multi_judge") {
    return item.candidates.map((candidate) => ({
      text: candidate.text,
      noteKo: candidate.note_ko,
    }));
  }
  return [{
    text: item.target,
    noteKo: item.explanation_ko,
  }];
}

function reasonSignals(items: MpjItemRuntime[]): { misconceptionKo?: string; coreReasonKo?: string } {
  const reason = items.find((item) => item.type === "reason" || item.type === "reason_conf");
  if (!reason) return {};
  if (reason.type === "reason") {
    return {
      misconceptionKo: reason.reasons.find((candidate) => candidate.kind === "pragmatic_misconception")?.text_ko,
      coreReasonKo: reason.reasons.find((candidate) => candidate.id === reason.accepted_reason_id)?.text_ko,
    };
  }
  return {
    misconceptionKo: reason.reasons.find((candidate) => !reason.accepted_reason_ids.includes(candidate.id))?.text_ko,
    coreReasonKo: reason.reasons.find((candidate) => reason.accepted_reason_ids.includes(candidate.id))?.text_ko,
  };
}

function microscopeOf(items: MpjItemRuntime[]) {
  const item = items.find((candidate) => candidate.type === "reason")
    ?? items.find((candidate) => candidate.type !== "multi_judge" && candidate.highlights.length > 0)
    ?? items[0];
  const expression = item.type === "multi_judge"
    ? item.candidates[0]?.text ?? "—"
    : item.highlights[0] ?? item.target;
  const adjustmentExample = item.recommended_example;
  return {
    expression,
    source: item.source,
    functionAndEffectKo: item.explanation_ko,
    adjustmentExample,
  };
}

/**
 * 승인된 미션 JSON을 별도 저장 구조 없이 교수자 수업자료로 투영한다.
 * 데이터에 없는 반대 맥락이나 학습자 사례는 사실처럼 생성하지 않는다.
 */
export function buildInstructorMissionGuide(
  mission: MissionRuntime,
  speechActKo = "화행",
): InstructorMissionGuide {
  const items = [...mission.mpj_items] as MpjItemRuntime[];
  const first = items[0];
  const second = items[1] ?? first;
  const contrast = comparePdr(first.pdr, second.pdr);
  contrast.firstSituationKo = first.situation_ko;
  contrast.secondSituationKo = second.situation_ko;

  const productionPdr = mission.production_task.pdr;
  const recontextItem = items.find((item) => comparePdr(item.pdr, productionPdr).verified) ?? first;
  const signals = reasonSignals(items);

  return {
    speechActKo,
    itemFocusKo: mission.unit.learner_label,
    situationKo: mission.production_task.situation_ko,
    relationKo: mission.production_task.relation_ko,
    pdrKo: formatPdr(productionPdr),
    mpjItems: items.map((item) => ({
      id: item.id,
      titleKo: ITEM_TITLE[item.type] ?? item.type,
      situationKo: item.situation_ko,
      source: item.source,
      designIntentKo: item.explanation_ko,
      candidates: candidatesOf(item),
    })),
    ...signals,
    contrast,
    microscope: microscopeOf(items),
    dct: {
      situationKo: mission.production_task.situation_ko,
      sourceText: mission.production_task.source_text,
      alternatives: mission.production_task.reference_alternatives.map((alternative) => ({
        text: alternative.text,
        noteKo: alternative.note_ko,
      })),
    },
    recontextualization: {
      situationKo: recontextItem.situation_ko,
      relationKo: recontextItem.relation_ko,
      promptKo: `같은 ${speechActKo}이라도 이 관계와 부담에서는 어떤 표현 자원을 더하거나 덜어야 하는지 비교하세요.`,
    },
  };
}
