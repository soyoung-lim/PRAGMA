import type { CurriculumWeekRow } from "@/lib/curriculum/types";
import type { ComposerCore } from "@/lib/curriculum/composer";
import { isReviewedMission } from "@/lib/curriculum/composerEligibility";
import type {
  LanguageDirection,
  LearnerLevel,
  SpeechActUI,
} from "@/lib/pragma/enums";
import type { ThemeCode } from "@/lib/pragma/scenarioTopics";

export type AssignedItem = { scenario_id: string; slot_role: string };
export type AssignMap = Record<number, AssignedItem[]>;
type PlanningWeek = Pick<
  CurriculumWeekRow,
  "week_no" | "type" | "speech_act" | "scenario_slots"
>;

export const slotRoleFor = (core: ComposerCore): string =>
  core.mode === "stt_interpreting" ? "interpreting" : "primary";

/** 후보 중 통역 비율을 최대한 맞춰 slots개를 고른다(부족하면 남는 것으로 채움). */
export function pickByRatio(
  candidates: ComposerCore[],
  slots: number,
  interpretingRatio: number,
): ComposerCore[] {
  if (candidates.length <= slots) return candidates.slice(0, slots);
  const interpreting = candidates.filter((core) => core.mode === "stt_interpreting");
  const translation = candidates.filter((core) => core.mode !== "stt_interpreting");
  const wantedInterpreting = Math.min(
    interpreting.length,
    Math.round(slots * interpretingRatio),
  );
  const picked = [
    ...interpreting.slice(0, wantedInterpreting),
    ...translation.slice(0, slots - wantedInterpreting),
  ];
  if (picked.length < slots) {
    const chosen = new Set(picked.map((core) => core.scenario_id));
    for (const core of candidates) {
      if (picked.length >= slots) break;
      if (!chosen.has(core.scenario_id)) picked.push(core);
    }
  }
  return picked.slice(0, slots);
}

export interface AutoFillOptions {
  weeks: PlanningWeek[];
  cores: ComposerCore[];
  level: LearnerLevel;
  direction: LanguageDirection;
  themes: ThemeCode[];
  interpretingRatio: number;
  defaultScenariosPerWeek: number;
  /** 선택 주제가 부족할 때 다른 주제로 넓힐지 여부. 교수자의 명시 조작만 허용한다. */
  allowThemeExpansion?: boolean;
}

export interface AutoFillResult {
  assignments: AssignMap;
  filledWeeks: number;
  totalAssigned: number;
  shortages: Array<{ weekNo: number; missingSlots: number }>;
  expandedThemeWeeks: number[];
}

/**
 * 15주 골격의 화행 주차를 검토 완료 미션으로 채운다.
 * 주제는 기본적으로 엄수한다. 다른 주제로 넓히는 것은 UI에서 교수가 명시적으로
 * 승인해 allowThemeExpansion=true를 넘긴 경우에만 허용한다.
 */
export function buildAutomaticAssignments(options: AutoFillOptions): AutoFillResult {
  const {
    weeks,
    cores,
    level,
    direction,
    themes,
    interpretingRatio,
    defaultScenariosPerWeek,
    allowThemeExpansion = false,
  } = options;
  const assignments: AssignMap = {};
  const usedIds = new Set<string>();
  const shortages: AutoFillResult["shortages"] = [];
  const expandedThemeWeeks: number[] = [];
  let filledWeeks = 0;

  for (const week of weeks) {
    if (week.type !== "regular" || !week.speech_act) continue;
    const act = week.speech_act as SpeechActUI;
    const slots = week.scenario_slots ?? defaultScenariosPerWeek;
    const isBaseEligible = (core: ComposerCore) =>
      isReviewedMission(core) &&
      !usedIds.has(core.scenario_id) &&
      core.speech_act === act &&
      core.learner_level === level &&
      core.direction === direction;

    let candidates = cores.filter(
      (core) =>
        isBaseEligible(core) &&
        (themes.length === 0 ||
          (core.theme_code != null && themes.includes(core.theme_code))),
    );
    if (themes.length > 0 && candidates.length < slots && allowThemeExpansion) {
      candidates = cores.filter(isBaseEligible);
      expandedThemeWeeks.push(week.week_no);
    }

    const picked = pickByRatio(candidates, slots, interpretingRatio);
    if (picked.length < slots) {
      shortages.push({ weekNo: week.week_no, missingSlots: slots - picked.length });
    }
    if (picked.length === 0) continue;
    picked.forEach((core) => usedIds.add(core.scenario_id));
    assignments[week.week_no] = picked.map((core) => ({
      scenario_id: core.scenario_id,
      slot_role: slotRoleFor(core),
    }));
    filledWeeks += 1;
  }

  return {
    assignments,
    filledWeeks,
    totalAssigned: Object.values(assignments).reduce(
      (sum, items) => sum + items.length,
      0,
    ),
    shortages,
    expandedThemeWeeks,
  };
}

export function assignedScenarioIds(assignments: AssignMap): Set<string> {
  return new Set(
    Object.values(assignments).flatMap((items) =>
      items.map((item) => item.scenario_id),
    ),
  );
}

export interface ManualCandidateOptions {
  act: SpeechActUI | null;
  level: LearnerLevel;
  direction: LanguageDirection;
  themes: ThemeCode[];
  assignments: AssignMap;
}

/** 수동 교체 후보도 자동 편성과 같은 절대 조건 및 강좌 전체 중복 금지를 적용한다. */
export function filterManualCandidates(
  candidates: ComposerCore[],
  options: ManualCandidateOptions,
): ComposerCore[] {
  const usedIds = assignedScenarioIds(options.assignments);
  return candidates.filter(
    (core) =>
      isReviewedMission(core) &&
      !usedIds.has(core.scenario_id) &&
      (options.act ? core.speech_act === options.act : true) &&
      core.learner_level === options.level &&
      core.direction === options.direction &&
      (options.themes.length === 0 ||
        (core.theme_code != null && options.themes.includes(core.theme_code))),
  );
}

export function removeAssignment(
  assignments: AssignMap,
  weekNo: number,
  scenarioId: string,
): AssignMap {
  return {
    ...assignments,
    [weekNo]: (assignments[weekNo] ?? []).filter(
      (item) => item.scenario_id !== scenarioId,
    ),
  };
}

/**
 * 검토 완료 미션만 추가한다. 같은 강좌의 어느 주차든 이미 사용된 코어면 거부한다.
 * 반환 참조가 같으면 추가가 거부된 것이다.
 */
export function addAssignment(
  assignments: AssignMap,
  weekNo: number,
  core: ComposerCore,
): AssignMap {
  if (
    !isReviewedMission(core) ||
    assignedScenarioIds(assignments).has(core.scenario_id)
  ) {
    return assignments;
  }
  return {
    ...assignments,
    [weekNo]: [
      ...(assignments[weekNo] ?? []),
      { scenario_id: core.scenario_id, slot_role: slotRoleFor(core) },
    ],
  };
}

export function duplicateScenarioIds(assignments: AssignMap): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const items of Object.values(assignments)) {
    for (const item of items) {
      if (seen.has(item.scenario_id)) duplicates.add(item.scenario_id);
      seen.add(item.scenario_id);
    }
  }
  return [...duplicates];
}

/** 선택한 수준·언어방향과 맞지 않는 기존 배정을 찾아 저장 전에 차단한다. */
export function incompatibleAssignmentIds(
  assignments: AssignMap,
  coreById: Record<string, ComposerCore>,
  level: LearnerLevel,
  direction: LanguageDirection,
): string[] {
  return [...assignedScenarioIds(assignments)].filter((scenarioId) => {
    const core = coreById[scenarioId];
    return !core || core.learner_level !== level || core.direction !== direction;
  });
}

export type AssignmentStructureIssueCode =
  | "missing_core"
  | "unreviewed"
  | "level"
  | "direction"
  | "missing_week"
  | "non_regular_week"
  | "speech_act"
  | "too_many_items";

export interface AssignmentStructureIssue {
  weekNo: number;
  scenarioId?: string;
  code: AssignmentStructureIssueCode;
}

/**
 * 강좌 설정·주차 계획과 실제 미션 배정 사이의 공통 불변조건 검사.
 * Composer 저장과 주차 계획 저장이 같은 검사를 사용해 한쪽 경로의 누수를 막는다.
 */
export function assignmentStructureIssues(
  assignments: AssignMap,
  coreById: Record<string, ComposerCore>,
  weeks: PlanningWeek[],
  level: LearnerLevel,
  direction: LanguageDirection,
  defaultScenariosPerWeek: number,
): AssignmentStructureIssue[] {
  const issues: AssignmentStructureIssue[] = [];
  const weekByNo = new Map(weeks.map((week) => [week.week_no, week]));

  for (const [weekNoText, items] of Object.entries(assignments)) {
    const weekNo = Number(weekNoText);
    const week = weekByNo.get(weekNo);
    if (!week) {
      issues.push({ weekNo, code: "missing_week" });
      continue;
    }
    if (week.type !== "regular") {
      if (items.length > 0) issues.push({ weekNo, code: "non_regular_week" });
      continue;
    }
    const slots = week.scenario_slots ?? defaultScenariosPerWeek;
    if (items.length > slots) issues.push({ weekNo, code: "too_many_items" });

    for (const item of items) {
      const core = coreById[item.scenario_id];
      if (!core) {
        issues.push({ weekNo, scenarioId: item.scenario_id, code: "missing_core" });
        continue;
      }
      if (!isReviewedMission(core)) {
        issues.push({ weekNo, scenarioId: item.scenario_id, code: "unreviewed" });
      }
      if (core.learner_level !== level) {
        issues.push({ weekNo, scenarioId: item.scenario_id, code: "level" });
      }
      if (core.direction !== direction) {
        issues.push({ weekNo, scenarioId: item.scenario_id, code: "direction" });
      }
      if (week.speech_act && core.speech_act !== week.speech_act) {
        issues.push({ weekNo, scenarioId: item.scenario_id, code: "speech_act" });
      }
    }
  }

  return issues;
}
