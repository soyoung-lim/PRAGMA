// 학습 수행 기록 화면의 목록 좁히기 — 순수 함수.
//
// 로그 테이블에는 교과목 컬럼이 없다. 교과목은 편성표
// (curriculum_week_scenarios: outline_id × scenario_id)에서 파생하며,
// 한 시나리오가 여러 교과목에 편성될 수 있으므로 집합으로 다룬다.
// 편성에 없는 기록(샘플 미션·편성 삭제분)은 "교과목 미상"으로 남는다.

export interface FilterableLog {
  mission_id: string;
  speech_act: string | null;
  mission_completed: boolean | null;
  profiles: {
    full_name: string | null;
    email: string | null;
    anonymous_participant_id: string | null;
  } | null;
}

export interface MissionLogFilters {
  /** 이름·이메일·가명 참여자 ID 부분 일치(대소문자 무시) */
  query: string;
  /** all | completed | in_progress */
  completion: "all" | "completed" | "in_progress";
  /** all | 교과목 outline id | unknown(편성에 없는 기록) */
  courseId: string;
  /** all | speech_act 코드 */
  speechAct: string;
}

export const EMPTY_FILTERS: MissionLogFilters = {
  query: "",
  completion: "all",
  courseId: "all",
  speechAct: "all",
};

/** mission_id → 그 미션이 편성된 교과목 id 집합. */
export type MissionCourseIndex = Map<string, Set<string>>;

export function buildMissionCourseIndex(
  assignments: Array<{ outline_id: string; scenario_id: string }>,
): MissionCourseIndex {
  const index: MissionCourseIndex = new Map();
  for (const { outline_id, scenario_id } of assignments) {
    if (!scenario_id || !outline_id) continue;
    const existing = index.get(scenario_id);
    if (existing) existing.add(outline_id);
    else index.set(scenario_id, new Set([outline_id]));
  }
  return index;
}

const matchesQuery = (row: FilterableLog, needle: string) => {
  if (!needle) return true;
  const haystack = [
    row.profiles?.full_name,
    row.profiles?.email,
    row.profiles?.anonymous_participant_id,
  ]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
};

export function filterMissionLogs<T extends FilterableLog>(
  rows: T[],
  filters: MissionLogFilters,
  courseIndex: MissionCourseIndex,
): T[] {
  const needle = filters.query.trim().toLowerCase();
  return rows.filter((row) => {
    if (!matchesQuery(row, needle)) return false;

    if (filters.completion === "completed" && !row.mission_completed) return false;
    if (filters.completion === "in_progress" && row.mission_completed) return false;

    if (filters.speechAct !== "all" && row.speech_act !== filters.speechAct) return false;

    if (filters.courseId !== "all") {
      const courses = courseIndex.get(row.mission_id);
      if (filters.courseId === "unknown") {
        if (courses && courses.size > 0) return false;
      } else if (!courses?.has(filters.courseId)) {
        return false;
      }
    }
    return true;
  });
}

export const hasActiveFilter = (filters: MissionLogFilters) =>
  filters.query.trim() !== "" ||
  filters.completion !== "all" ||
  filters.courseId !== "all" ||
  filters.speechAct !== "all";
