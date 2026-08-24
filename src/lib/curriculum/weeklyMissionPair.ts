import type { ComposerCore } from "@/lib/curriculum/composer";
import {
  MISSION_DIAGNOSTIC_DIMENSIONS,
  type MissionDiagnosticDimension,
} from "@/lib/pragma/diagnosticDimensions";

/**
 * 한 화행 주차의 두 완결 미션(A/B)을 식별하는 현재 계약.
 * NULL/undefined인 기존 편성은 역사적 자료로 계속 읽되 이 계약의 정본으로 간주하지 않는다.
 */
export const WEEKLY_MISSION_PAIR_CONTRACT_VERSION = "speech_act_ab_v1" as const;

export const WEEKLY_MISSION_ROLES = ["A", "B"] as const;
export type WeeklyMissionRole = (typeof WEEKLY_MISSION_ROLES)[number];

/** A/B에서 관찰 가능하게 바꿀 수 있는 맥락축. */
export const WEEKLY_CONTEXT_AXES = [
  "counterpart",
  "power",
  "distance",
  "burden",
  "channel",
] as const;
export type WeeklyContextAxis = (typeof WEEKLY_CONTEXT_AXES)[number];

/**
 * target_feature와 별개인 화행 수행의 복수 진단차원.
 * target_feature는 문항 수준 진단·피드백 태그이며 아래 차원을 대신하지 않는다.
 */
export const WEEKLY_DIAGNOSTIC_DIMENSIONS = MISSION_DIAGNOSTIC_DIMENSIONS;
export type WeeklyDiagnosticDimension = MissionDiagnosticDimension;

export interface WeeklyMissionPairAssignment {
  scenario_id: string;
  pair_contract_version?: typeof WEEKLY_MISSION_PAIR_CONTRACT_VERSION | null;
  mission_role?: WeeklyMissionRole | null;
  changed_context_axes?: WeeklyContextAxis[] | null;
  diagnostic_dimensions?: WeeklyDiagnosticDimension[] | null;
}

export type WeeklyMissionPairIssueCode =
  | "pair_contract_mixed"
  | "pair_item_count"
  | "pair_role_order"
  | "pair_changed_axes"
  | "pair_diagnostic_dimensions"
  | "pair_core_axes"
  | "pair_context_incomplete"
  | "pair_context_delta"
  | "pair_coverage_union"
  | "pair_coverage_complement";

export interface WeeklyMissionPairIssue {
  code: WeeklyMissionPairIssueCode;
  scenarioId?: string;
}

const contextAxisSet = new Set<string>(WEEKLY_CONTEXT_AXES);
const diagnosticDimensionSet = new Set<string>(WEEKLY_DIAGNOSTIC_DIMENSIONS);

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function isCurrentAssignment(item: WeeklyMissionPairAssignment): boolean {
  return item.pair_contract_version === WEEKLY_MISSION_PAIR_CONTRACT_VERSION;
}

/** 새 계약을 전혀 주장하지 않는 역사적 편성은 기존 동작을 유지한다. */
export function usesCurrentWeeklyMissionPairContract(
  items: readonly WeeklyMissionPairAssignment[],
): boolean {
  return items.some(isCurrentAssignment);
}

/**
 * DB 쓰기 직전에도 실행 가능한 구조 검사. 코어 본문 없이 검증 가능한 불변조건만 다룬다.
 */
export function weeklyMissionPairShapeIssues(
  items: readonly WeeklyMissionPairAssignment[],
): WeeklyMissionPairIssue[] {
  if (!usesCurrentWeeklyMissionPairContract(items)) return [];

  const issues: WeeklyMissionPairIssue[] = [];
  if (items.some((item) => !isCurrentAssignment(item))) {
    issues.push({ code: "pair_contract_mixed" });
  }
  if (items.length !== 2) issues.push({ code: "pair_item_count" });

  const [missionA, missionB] = items;
  if (missionA?.mission_role !== "A" || missionB?.mission_role !== "B") {
    issues.push({ code: "pair_role_order" });
  }

  for (const item of items.filter(isCurrentAssignment)) {
    const axes = item.changed_context_axes ?? [];
    const distinctAxes = unique(axes);
    const axesAreKnown = axes.every((axis) => contextAxisSet.has(axis));
    const roleAxesAreValid =
      (item.mission_role === "A" && axes.length === 0) ||
      (item.mission_role === "B" && axes.length >= 1 && axes.length <= 2);
    if (!axesAreKnown || distinctAxes.length !== axes.length || !roleAxesAreValid) {
      issues.push({ code: "pair_changed_axes", scenarioId: item.scenario_id });
    }

    const dimensions = item.diagnostic_dimensions ?? [];
    const distinctDimensions = unique(dimensions);
    if (
      dimensions.length < 2 ||
      distinctDimensions.length !== dimensions.length ||
      !dimensions.every((dimension) => diagnosticDimensionSet.has(dimension))
    ) {
      issues.push({
        code: "pair_diagnostic_dimensions",
        scenarioId: item.scenario_id,
      });
    }
  }

  if (missionA && missionB) {
    const aDimensions = new Set(missionA.diagnostic_dimensions ?? []);
    const bDimensions = new Set(missionB.diagnostic_dimensions ?? []);
    const union = new Set([...aDimensions, ...bDimensions]);
    if (union.size < 4) issues.push({ code: "pair_coverage_union" });
    const aAddsCoverage = [...aDimensions].some((value) => !bDimensions.has(value));
    const bAddsCoverage = [...bDimensions].some((value) => !aDimensions.has(value));
    if (!aAddsCoverage || !bAddsCoverage) {
      issues.push({ code: "pair_coverage_complement" });
    }
  }

  return issues;
}

function normalizedContextValue(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

/**
 * 저장 화면에서 코어까지 함께 검사하는 전체 계약. A/B는 같은 화행·수준·언어방향·
 * 수행모드를 유지하고, 명시한 1~2개 맥락축만 실제로 달라야 한다.
 */
export function weeklyMissionPairIssues(
  items: readonly WeeklyMissionPairAssignment[],
  coreById: Record<string, ComposerCore>,
): WeeklyMissionPairIssue[] {
  const issues = weeklyMissionPairShapeIssues(items);
  if (!usesCurrentWeeklyMissionPairContract(items) || items.length !== 2) return issues;

  const [missionA, missionB] = items;
  const coreA = coreById[missionA.scenario_id];
  const coreB = coreById[missionB.scenario_id];
  if (!coreA || !coreB) return issues;

  if (
    coreA.speech_act !== coreB.speech_act ||
    coreA.learner_level !== coreB.learner_level ||
    coreA.direction !== coreB.direction ||
    coreA.mode == null ||
    coreA.mode !== coreB.mode
  ) {
    issues.push({ code: "pair_core_axes" });
  }

  const actualChangedAxes: WeeklyContextAxis[] = [];
  let contextIncomplete = false;
  for (const axis of WEEKLY_CONTEXT_AXES) {
    const aValue = normalizedContextValue(coreA.context[axis]);
    const bValue = normalizedContextValue(coreB.context[axis]);
    if (aValue == null || bValue == null) {
      contextIncomplete = true;
    } else if (aValue !== bValue) {
      actualChangedAxes.push(axis);
    }
  }
  if (contextIncomplete) issues.push({ code: "pair_context_incomplete" });

  const declaredChangedAxes = missionB.changed_context_axes ?? [];
  if (
    !contextIncomplete &&
    (actualChangedAxes.length !== declaredChangedAxes.length ||
      actualChangedAxes.some((axis) => !declaredChangedAxes.includes(axis)))
  ) {
    issues.push({ code: "pair_context_delta" });
  }

  return issues;
}

/** 데이터 레이어의 최종 우회 방지용 검사. */
export function assertCurrentWeeklyMissionPairShapes(
  assignments: readonly (WeeklyMissionPairAssignment & { week_no: number })[],
): void {
  const byWeek = new Map<number, Array<WeeklyMissionPairAssignment & { week_no: number }>>();
  for (const assignment of assignments) {
    const weekItems = byWeek.get(assignment.week_no) ?? [];
    weekItems.push(assignment);
    byWeek.set(assignment.week_no, weekItems);
  }
  const invalidWeeks = [...byWeek.entries()]
    .filter(([, items]) => weeklyMissionPairShapeIssues(items).length > 0)
    .map(([weekNo]) => weekNo);
  if (invalidWeeks.length > 0) {
    throw new Error(`A/B 학습미션 계약 위반: ${invalidWeeks.join(", ")}주차`);
  }
}
