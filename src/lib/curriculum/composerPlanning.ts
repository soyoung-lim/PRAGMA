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
}

export interface AutoFillResult {
  assignments: AssignMap;
  filledWeeks: number;
  totalAssigned: number;
}

/**
 * 15주 골격의 화행 주차를 검토 완료 미션으로 채운다.
 * 테마만 후보 부족 시 완화하며 검토상태·화행·수준·방향·강좌 내 중복 금지는 유지한다.
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
  } = options;
  const assignments: AssignMap = {};
  const usedIds = new Set<string>();
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
    if (candidates.length < slots) {
      candidates = cores.filter(isBaseEligible);
    }

    const picked = pickByRatio(candidates, slots, interpretingRatio);
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
