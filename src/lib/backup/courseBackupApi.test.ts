import { beforeEach, describe, expect, it } from "vitest";

import { parseCourseBackup, serializeCourseBackup, type BackupRow } from "@/lib/backup/courseBackup";
import {
  fetchCourseBackup,
  fetchCourseBackupCounts,
  fetchCourseCompareBasis,
  listBackupCourses,
  restoreCourseBackup,
} from "@/lib/backup/courseBackupApi";
import { createFakeBackupDb, type FakeTables } from "@/lib/backup/fakeBackupDb";

const OUTLINE_ID = "11111111-0000-0000-0000-000000000001";
const OTHER_OUTLINE_ID = "11111111-0000-0000-0000-000000000002";

const seedTables = (): FakeTables => ({
  curriculum_outlines: [
    {
      id: OUTLINE_ID,
      title: "비즈니스 한중 통번역",
      level: "intermediate",
      language_direction: "ko_zh",
      domain: "work",
      industry: "trade",
      week_count: 15,
      status: "published",
      updated_at: "2026-08-18T00:00:00.000Z",
    },
    {
      id: OTHER_OUTLINE_ID,
      title: "다른 교강사 교과목",
      level: "advanced",
      language_direction: "zh_ko",
      domain: "school",
      week_count: 15,
      status: "draft",
      updated_at: "2026-08-17T00:00:00.000Z",
    },
  ],
  curriculum_weeks: [
    ...Array.from({ length: 15 }, (_, index) => ({
      id: `week-${index + 1}`,
      outline_id: OUTLINE_ID,
      week_no: index + 1,
      type: index === 0 ? "orientation" : index === 7 ? "midterm" : index === 14 ? "final" : "regular",
      title: `${index + 1}주차`,
      speech_act: index === 1 ? "request" : null,
    })),
    { id: "other-week-1", outline_id: OTHER_OUTLINE_ID, week_no: 1, type: "regular", title: "손대면 안 되는 주차" },
  ],
  curriculum_week_scenarios: [
    { id: "assign-1", outline_id: OUTLINE_ID, week_no: 2, scenario_id: "scenario-1", position: 0, slot_role: "primary" },
    { id: "assign-2", outline_id: OUTLINE_ID, week_no: 3, scenario_id: "scenario-2", position: 0, slot_role: "primary" },
    { id: "other-assign", outline_id: OTHER_OUTLINE_ID, week_no: 1, scenario_id: "scenario-3", position: 0, slot_role: "primary" },
  ],
  scenarios: [
    { scenario_id: "scenario-1", title: "납기 연장 요청", review_status: "approved", mission_status: "released", mission_reviewed_by: "user-1" },
    { scenario_id: "scenario-2", title: "회의 일정 조정 요청", review_status: "approved", mission_status: "released", mission_reviewed_by: "user-1" },
    { scenario_id: "scenario-3", title: "다른 교과목 미션", review_status: "generated", mission_status: null },
  ],
  // 학습자 기록 — 이번 백업이 건드리지 않아야 하는 테이블
  learner_mission_logs: [{ id: "log-1", learner_id: "learner-1", mission_id: "scenario-1", payload: { take: 1 } }],
});

describe("교과목 백업 조회", () => {
  let tables: FakeTables;
  beforeEach(() => {
    tables = seedTables();
  });

  it("선택한 교과목의 편성·배정·미션만 담는다", async () => {
    const db = createFakeBackupDb(tables);
    const file = await fetchCourseBackup(OUTLINE_ID, { db, projectRef: "test-ref" });

    expect(file.manifest.item_counts).toEqual({
      curriculum_outlines: 1,
      curriculum_weeks: 15,
      curriculum_week_scenarios: 2,
      scenarios: 2,
    });
    expect(file.data.curriculum_weeks.every((row) => row.outline_id === OUTLINE_ID)).toBe(true);
    expect(file.data.scenarios.map((row) => row.scenario_id).sort()).toEqual(["scenario-1", "scenario-2"]);
    // 다른 교과목의 미션은 들어가지 않는다.
    expect(file.data.scenarios.some((row) => row.scenario_id === "scenario-3")).toBe(false);
  });

  it("백업 파일에 학습자 기록과 검수자 식별자가 없다", async () => {
    const db = createFakeBackupDb(tables);
    const file = await fetchCourseBackup(OUTLINE_ID, { db });
    const text = serializeCourseBackup(file);

    expect(Object.keys(file.data)).toEqual([
      "curriculum_outlines",
      "curriculum_weeks",
      "curriculum_week_scenarios",
      "scenarios",
    ]);
    expect(text).not.toContain("learner_mission_logs");
    expect(text).not.toContain("mission_reviewed_by");
    expect(text).not.toContain("learner-1");
  });

  it("없는 교과목은 명확히 실패한다", async () => {
    const db = createFakeBackupDb(tables);
    await expect(fetchCourseBackup("no-such-id", { db })).rejects.toThrow(/교과목을 찾을 수 없습니다/);
  });

  it("백업 전 개수 미리보기는 선택한 교과목만 센다", async () => {
    const db = createFakeBackupDb(tables);
    // scenario-1·2는 각각 한 번씩 배정돼 있고, scenario-3은 다른 교과목 것이다.
    expect(await fetchCourseBackupCounts(OUTLINE_ID, db)).toEqual({ weeks: 15, assignments: 2, scenarios: 2 });
  });

  it("복원 전 비교 기준은 현재 주차 수와 배정 키만 읽는다", async () => {
    const db = createFakeBackupDb(tables);
    const basis = await fetchCourseCompareBasis(OUTLINE_ID, db);
    expect(basis.exists).toBe(true);
    expect(basis.weeks).toBe(15);
    expect(basis.assignmentKeys.sort()).toEqual(["2:scenario-1", "3:scenario-2"]);
  });

  it("없는 교과목의 비교 기준은 exists=false로 돌려준다", async () => {
    const db = createFakeBackupDb(tables);
    expect(await fetchCourseCompareBasis("no-such-id", db)).toEqual({
      exists: false,
      weeks: 0,
      assignmentKeys: [],
    });
  });

  it("교과목 목록은 최근 수정 순이다", async () => {
    const db = createFakeBackupDb(tables);
    const rows = await listBackupCourses(db);
    expect(rows.map((row) => row.id)).toEqual([OUTLINE_ID, OTHER_OUTLINE_ID]);
  });
});

describe("backup → 변경 → restore 왕복", () => {
  let tables: FakeTables;
  beforeEach(() => {
    tables = seedTables();
  });

  const findOutline = (id: string) => tables.curriculum_outlines.find((row) => row.id === id) as BackupRow;
  const findWeek = (outlineId: string, weekNo: number) =>
    tables.curriculum_weeks.find((row) => row.outline_id === outlineId && row.week_no === weekNo) as BackupRow;

  it("교과목명·주차 편성을 바꾼 뒤 복원하면 원래 값이 돌아온다", async () => {
    const db = createFakeBackupDb(tables);
    const backup = await fetchCourseBackup(OUTLINE_ID, { db });

    // 안전한 테스트 변경 — 교과목명과 2주차 편성
    findOutline(OUTLINE_ID).title = "바꿔 버린 교과목명";
    findWeek(OUTLINE_ID, 2).title = "바꿔 버린 2주차";
    findWeek(OUTLINE_ID, 2).speech_act = "refusal";

    // 파일을 직렬화·재파싱해서 실제 업로드 경로와 같은 값을 복원에 쓴다.
    const outcome = await restoreCourseBackup(parseCourseBackup(serializeCourseBackup(backup)), { db });

    expect(findOutline(OUTLINE_ID).title).toBe("비즈니스 한중 통번역");
    expect(findWeek(OUTLINE_ID, 2).title).toBe("2주차");
    expect(findWeek(OUTLINE_ID, 2).speech_act).toBe("request");
    expect(outcome.weeksRestored).toBe(15);
    expect(outcome.assignmentsRestored).toBe(2);
  });

  it("15주 편성과 미션 연결 관계가 복원 뒤에도 살아 있다", async () => {
    const db = createFakeBackupDb(tables);
    const backup = await fetchCourseBackup(OUTLINE_ID, { db });

    await restoreCourseBackup(backup, { db });

    const weeks = tables.curriculum_weeks.filter((row) => row.outline_id === OUTLINE_ID);
    expect(weeks).toHaveLength(15);
    const assignments = tables.curriculum_week_scenarios.filter((row) => row.outline_id === OUTLINE_ID);
    expect(assignments.map((row) => `${row.week_no}:${row.scenario_id}`).sort()).toEqual([
      "2:scenario-1",
      "3:scenario-2",
    ]);
  });

  it("[T3] 관계없는 데이터를 지우지 않는다", async () => {
    const db = createFakeBackupDb(tables);
    const backup = await fetchCourseBackup(OUTLINE_ID, { db });

    // 정리 단계가 실제로 도는 상황(현재에만 있는 배정)에서 확인한다.
    tables.curriculum_week_scenarios.push({
      id: "assign-extra",
      outline_id: OUTLINE_ID,
      week_no: 7,
      scenario_id: "scenario-2",
      position: 0,
      slot_role: "primary",
    });
    await restoreCourseBackup(backup, { db });

    expect(findOutline(OTHER_OUTLINE_ID).title).toBe("다른 교강사 교과목");
    expect(findWeek(OTHER_OUTLINE_ID, 1).title).toBe("손대면 안 되는 주차");
    expect(tables.curriculum_week_scenarios.some((row) => row.id === "other-assign")).toBe(true);
    expect(tables.learner_mission_logs).toHaveLength(1);
    expect(tables.scenarios).toHaveLength(3);
  });

  it("기존 미션의 검수·승인 상태를 덮어쓰지 않는다", async () => {
    const db = createFakeBackupDb(tables);
    const backup = await fetchCourseBackup(OUTLINE_ID, { db });

    // 백업 이후 교수자가 미션 상태를 바꿨다면, 복원은 그것을 되돌리지 않는다.
    (tables.scenarios.find((row) => row.scenario_id === "scenario-1") as BackupRow).mission_status = "reviewed";
    const outcome = await restoreCourseBackup(backup, { db });

    expect(outcome.scenariosInserted).toBe(0);
    expect(outcome.scenariosAlreadyPresent).toBe(2);
    expect((tables.scenarios.find((row) => row.scenario_id === "scenario-1") as BackupRow).mission_status).toBe("reviewed");
  });

  it("미션이 없는 환경(다른 설치본)으로 복원하면 미션 본문까지 새로 만든다", async () => {
    const emptyTables: FakeTables = {
      curriculum_outlines: [],
      curriculum_weeks: [],
      curriculum_week_scenarios: [],
      scenarios: [],
    };
    const source = createFakeBackupDb(seedTables());
    const backup = await fetchCourseBackup(OUTLINE_ID, { db: source });

    const target = createFakeBackupDb(emptyTables);
    const outcome = await restoreCourseBackup(backup, { db: target });

    expect(outcome.scenariosInserted).toBe(2);
    expect(emptyTables.curriculum_outlines).toHaveLength(1);
    expect(emptyTables.curriculum_weeks).toHaveLength(15);
    expect(emptyTables.curriculum_week_scenarios).toHaveLength(2);
    expect(outcome.safetyBackup).toBeNull();
  });

  it("복원 직전 상태를 안전 백업으로 돌려준다", async () => {
    const db = createFakeBackupDb(tables);
    const backup = await fetchCourseBackup(OUTLINE_ID, { db });
    findOutline(OUTLINE_ID).title = "복원 직전 이름";

    const outcome = await restoreCourseBackup(backup, { db });

    expect(outcome.safetyBackup?.data.curriculum_outlines[0].title).toBe("복원 직전 이름");
  });

  it("[T1] 백업 이후 추가된 배정은 복원이 정리한다(exact snapshot)", async () => {
    const db = createFakeBackupDb(tables);
    const backup = await fetchCourseBackup(OUTLINE_ID, { db });

    // 백업 = A,B / 현재 = A,B,C
    tables.curriculum_week_scenarios.push({
      id: "assign-3",
      outline_id: OUTLINE_ID,
      week_no: 4,
      scenario_id: "scenario-2",
      position: 0,
      slot_role: "primary",
    });

    const outcome = await restoreCourseBackup(backup, { db });

    // 복원 후 = A,B
    expect(tables.curriculum_week_scenarios.some((row) => row.id === "assign-3")).toBe(false);
    expect(outcome.assignmentsRemoved).toBe(1);
    expect(
      tables.curriculum_week_scenarios
        .filter((row) => row.outline_id === OUTLINE_ID)
        .map((row) => `${row.week_no}:${row.scenario_id}`)
        .sort(),
    ).toEqual(["2:scenario-1", "3:scenario-2"]);
  });

  it("[T4] 배정이 정리돼도 공유 시나리오 본문은 남는다", async () => {
    const db = createFakeBackupDb(tables);
    const backup = await fetchCourseBackup(OUTLINE_ID, { db });

    tables.curriculum_week_scenarios.push({
      id: "assign-3",
      outline_id: OUTLINE_ID,
      week_no: 5,
      scenario_id: "scenario-3",
      position: 0,
      slot_role: "primary",
    });
    await restoreCourseBackup(backup, { db });

    // 배정만 사라지고 scenarios 3건은 그대로다.
    expect(tables.curriculum_week_scenarios.some((row) => row.id === "assign-3")).toBe(false);
    expect(tables.scenarios.map((row) => row.scenario_id).sort()).toEqual([
      "scenario-1",
      "scenario-2",
      "scenario-3",
    ]);
  });

  it("[T5] 배정이 정리돼도 학습자 수행기록은 그대로다", async () => {
    const db = createFakeBackupDb(tables);
    const backup = await fetchCourseBackup(OUTLINE_ID, { db });
    const before = JSON.stringify(tables.learner_mission_logs);

    tables.curriculum_week_scenarios.push({
      id: "assign-3",
      outline_id: OUTLINE_ID,
      week_no: 6,
      scenario_id: "scenario-1",
      position: 0,
      slot_role: "primary",
    });
    await restoreCourseBackup(backup, { db });

    expect(JSON.stringify(tables.learner_mission_logs)).toBe(before);
  });

  it("백업에 없는 주차도 이 교과목 안에서만 정리한다", async () => {
    const db = createFakeBackupDb(tables);
    const backup = await fetchCourseBackup(OUTLINE_ID, { db });

    tables.curriculum_weeks.push({ id: "week-16", outline_id: OUTLINE_ID, week_no: 16, type: "regular", title: "덧붙은 16주차" });
    const outcome = await restoreCourseBackup(backup, { db });

    expect(outcome.weeksRemoved).toBe(1);
    expect(tables.curriculum_weeks.filter((row) => row.outline_id === OUTLINE_ID)).toHaveLength(15);
    // 다른 교과목 주차는 건드리지 않는다.
    expect(tables.curriculum_weeks.some((row) => row.id === "other-week-1")).toBe(true);
  });
});
