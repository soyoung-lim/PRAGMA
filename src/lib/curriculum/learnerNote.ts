import { buildCanDoSuggestions } from "@/lib/curriculum/canDoGuide";
import type { LearnerCourseWeek } from "@/lib/curriculum/learnerCourse";
import {
  CHANNEL_UI,
  DIRECTION_LABEL,
  DOMAIN,
  type LanguageDirection,
  type PdrBurden,
  type PdrDistance,
  type PdrPower,
} from "@/lib/pragma/enums";
import {
  FEATURE_CODES_BY_ACT,
  getTargetFeature,
} from "@/lib/pragma/targetFeatures";

export interface LearnerNoteContextCue {
  label: string;
  value: string;
}

export interface LearnerNoteFeature {
  code: string;
  version: string;
  label: string;
  definition: string;
  resources: string[];
  comparisonLabels: string[];
  distinguishFrom: string[];
  principle: string;
  counterRule: string;
}

export interface WeeklyLearnerNote {
  weekNo: number;
  title: string;
  directionLabel: string;
  canDos: string[];
  canDoSource: "instructor" | "default";
  competencyFocus: string | null;
  contextCues: LearnerNoteContextCue[];
  features: LearnerNoteFeature[];
}

const POWER_CONTEXT: Record<PdrPower, string> = {
  higher: "상대가 결정권을 더 가진 관계",
  equal: "서로 비슷한 지위의 관계",
  lower: "내가 결정권을 더 가진 관계",
};

const DISTANCE_CONTEXT: Record<PdrDistance, string> = {
  close: "서로 친밀한 사이",
  acquaintance: "알지만 아직 친밀하지 않은 사이",
  formal: "처음 만나거나 아직 거리가 먼 사이",
};

const BURDEN_CONTEXT: Record<PdrBurden, string> = {
  low: "상대의 시간·노력 부담이 작은 일",
  mid: "상대가 어느 정도 조정해야 하는 일",
  high: "상대의 시간·노력 부담이 큰 일",
};

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function featureCodesForWeek(week: LearnerCourseWeek): string[] {
  const assigned = week.scenarios.flatMap((scenario) =>
    scenario.target_feature ? [scenario.target_feature] : [],
  );
  const defaults = week.speech_act
    ? [...FEATURE_CODES_BY_ACT[week.speech_act]]
    : [];
  return unique([...assigned, ...defaults]);
}

function contextCuesForWeek(week: LearnerCourseWeek): LearnerNoteContextCue[] {
  const cues: LearnerNoteContextCue[] = [];
  if (week.domain) cues.push({ label: "장면", value: DOMAIN[week.domain] });
  if (week.channel) cues.push({ label: "방식", value: CHANNEL_UI[week.channel] });
  if (week.pdr_power) cues.push({ label: "관계", value: POWER_CONTEXT[week.pdr_power] });
  if (week.pdr_distance) cues.push({ label: "거리", value: DISTANCE_CONTEXT[week.pdr_distance] });
  if (week.pdr_imposition) cues.push({ label: "부담", value: BURDEN_CONTEXT[week.pdr_imposition] });
  return cues;
}

export function buildWeeklyLearnerNote(
  week: LearnerCourseWeek,
  direction: LanguageDirection,
): WeeklyLearnerNote {
  const instructorCanDos = week.can_do.map((item) => item.trim()).filter(Boolean).slice(0, 2);
  const defaultCanDos = buildCanDoSuggestions(
    {
      speech_act: week.speech_act,
      domain: week.domain,
      channel: week.channel,
    },
    direction,
  );

  const features = featureCodesForWeek(week).flatMap((code): LearnerNoteFeature[] => {
    const feature = getTargetFeature(code);
    if (!feature) return [];
    const zhToKo = direction === "zh_ko";
    return [{
      code: feature.code,
      version: feature.version,
      label: feature.learner_label,
      definition:
        zhToKo && feature.operational_definition_zh_ko
          ? feature.operational_definition_zh_ko
          : feature.operational_definition,
      resources:
        zhToKo && feature.relevant_resources_zh_ko?.length
          ? feature.relevant_resources_zh_ko
          : feature.relevant_resources,
      comparisonLabels: feature.band_schema.map((band) => band.label_ko),
      distinguishFrom:
        zhToKo && feature.excluded_confounds_zh_ko?.length
          ? feature.excluded_confounds_zh_ko
          : feature.excluded_confounds,
      principle: feature.closing_principle_ko,
      counterRule:
        zhToKo && feature.counter_rule_note_zh_ko
          ? feature.counter_rule_note_zh_ko
          : feature.counter_rule_note,
    }];
  });

  return {
    weekNo: week.week_no,
    title: week.title,
    directionLabel: DIRECTION_LABEL[direction],
    canDos: instructorCanDos.length > 0 ? instructorCanDos : defaultCanDos,
    canDoSource: instructorCanDos.length > 0 ? "instructor" : "default",
    competencyFocus: week.competency_focus?.trim() || null,
    contextCues: contextCuesForWeek(week),
    features,
  };
}
