import { describe, expect, it } from "vitest";
import {
  buildMissionCourseIndex,
  EMPTY_FILTERS,
  filterMissionLogs,
  hasActiveFilter,
  type FilterableLog,
} from "./missionLogFilter";

const log = (over: Partial<FilterableLog> & { mission_id: string }): FilterableLog => ({
  speech_act: "request",
  mission_completed: true,
  profiles: { full_name: "김학생", email: "kim@example.com", anonymous_participant_id: "P-01" },
  ...over,
});

const rows: FilterableLog[] = [
  log({ mission_id: "m-1" }),
  log({ mission_id: "m-2", speech_act: "refusal", mission_completed: false, profiles: { full_name: "이학생", email: "lee@example.com", anonymous_participant_id: "P-02" } }),
  log({ mission_id: "sample:request", profiles: null }),
];

const index = buildMissionCourseIndex([
  { outline_id: "course-a", scenario_id: "m-1" },
  { outline_id: "course-b", scenario_id: "m-1" },
  { outline_id: "course-b", scenario_id: "m-2" },
]);

describe("buildMissionCourseIndex", () => {
  it("한 미션이 여러 교과목에 편성되면 모두 담는다", () => {
    expect(index.get("m-1")).toEqual(new Set(["course-a", "course-b"]));
  });

  it("빈 값이 섞여도 무시한다", () => {
    const built = buildMissionCourseIndex([{ outline_id: "", scenario_id: "x" }, { outline_id: "c", scenario_id: "" }]);
    expect(built.size).toBe(0);
  });
});

describe("filterMissionLogs", () => {
  it("필터가 없으면 전체를 그대로 돌려준다", () => {
    expect(filterMissionLogs(rows, EMPTY_FILTERS, index)).toHaveLength(3);
  });

  it("이름·이메일·가명 참여자 ID 어느 쪽으로도 검색된다", () => {
    const byName = filterMissionLogs(rows, { ...EMPTY_FILTERS, query: "이학생" }, index);
    expect(byName.map((row) => row.mission_id)).toEqual(["m-2"]);
    const byEmail = filterMissionLogs(rows, { ...EMPTY_FILTERS, query: "KIM@" }, index);
    expect(byEmail.map((row) => row.mission_id)).toEqual(["m-1"]);
    const byPid = filterMissionLogs(rows, { ...EMPTY_FILTERS, query: "p-02" }, index);
    expect(byPid.map((row) => row.mission_id)).toEqual(["m-2"]);
  });

  it("프로필이 없는 기록은 검색어가 있으면 제외된다", () => {
    const found = filterMissionLogs(rows, { ...EMPTY_FILTERS, query: "학생" }, index);
    expect(found.map((row) => row.mission_id)).toEqual(["m-1", "m-2"]);
  });

  it("완료 여부로 나눈다", () => {
    expect(filterMissionLogs(rows, { ...EMPTY_FILTERS, completion: "completed" }, index)).toHaveLength(2);
    expect(filterMissionLogs(rows, { ...EMPTY_FILTERS, completion: "in_progress" }, index).map((r) => r.mission_id))
      .toEqual(["m-2"]);
  });

  it("화행으로 좁힌다", () => {
    expect(filterMissionLogs(rows, { ...EMPTY_FILTERS, speechAct: "refusal" }, index).map((r) => r.mission_id))
      .toEqual(["m-2"]);
  });

  it("교과목은 편성표에서 파생해 좁히고, 편성에 없는 기록은 '교과목 미상'으로 모인다", () => {
    expect(filterMissionLogs(rows, { ...EMPTY_FILTERS, courseId: "course-a" }, index).map((r) => r.mission_id))
      .toEqual(["m-1"]);
    expect(filterMissionLogs(rows, { ...EMPTY_FILTERS, courseId: "course-b" }, index).map((r) => r.mission_id))
      .toEqual(["m-1", "m-2"]);
    expect(filterMissionLogs(rows, { ...EMPTY_FILTERS, courseId: "unknown" }, index).map((r) => r.mission_id))
      .toEqual(["sample:request"]);
  });

  it("여러 필터는 함께 적용된다", () => {
    const found = filterMissionLogs(
      rows,
      { query: "이", completion: "in_progress", courseId: "course-b", speechAct: "refusal" },
      index,
    );
    expect(found.map((row) => row.mission_id)).toEqual(["m-2"]);
  });

  it("편성표를 못 불러와도(빈 index) 교과목 외 필터는 계속 동작한다", () => {
    const empty = new Map();
    expect(filterMissionLogs(rows, { ...EMPTY_FILTERS, speechAct: "request" }, empty)).toHaveLength(2);
  });
});

describe("hasActiveFilter", () => {
  it("기본값은 비활성, 하나라도 바뀌면 활성", () => {
    expect(hasActiveFilter(EMPTY_FILTERS)).toBe(false);
    expect(hasActiveFilter({ ...EMPTY_FILTERS, query: "  " })).toBe(false);
    expect(hasActiveFilter({ ...EMPTY_FILTERS, query: "김" })).toBe(true);
    expect(hasActiveFilter({ ...EMPTY_FILTERS, completion: "completed" })).toBe(true);
  });
});
