// 교과목 백업·복원의 데이터 접근 계층.
//
// RLS 전제: 이 경로는 admin 전용이다. 접근 통제를 여기서 다시 구현하지 않는다.
//
// ⚠️ 원자성 한계(curriculum/api.ts·composer.ts와 동일): 여러 PostgREST 요청은 하나의
//    트랜잭션이 아니다. 복원은 upsert·부족분 insert를 먼저 끝내고 **정리(삭제)를 마지막에**
//    두므로, 중간 실패는 "일부만 복원된 상태"로 남을 뿐 편성이 비는 구간은 생기지 않는다.
//    모든 실패는 예외로 던지며 성공으로 보고하지 않는다.

import {
  assertNoSecrets,
  buildCourseBackup,
  courseBackupFilename,
  serializeCourseBackup,
  type BackupRow,
  type CourseBackupFile,
} from "./courseBackup";

export type BackupQueryResponse<T> = { data: T | null; error: { message?: string } | null };

export interface BackupSelectBuilder extends PromiseLike<BackupQueryResponse<BackupRow[]>> {
  eq(column: string, value: unknown): BackupSelectBuilder;
  in(column: string, values: readonly unknown[]): BackupSelectBuilder;
  order(column: string, options?: { ascending?: boolean }): BackupSelectBuilder;
  maybeSingle(): PromiseLike<BackupQueryResponse<BackupRow>>;
}

export interface BackupDeleteBuilder extends PromiseLike<BackupQueryResponse<null>> {
  in(column: string, values: readonly unknown[]): BackupDeleteBuilder;
  eq(column: string, value: unknown): BackupDeleteBuilder;
}

export interface BackupTable {
  select(columns: string): BackupSelectBuilder;
  upsert(rows: BackupRow[], options?: { onConflict?: string }): PromiseLike<BackupQueryResponse<null>>;
  insert(rows: BackupRow[]): PromiseLike<BackupQueryResponse<null>>;
  delete(): BackupDeleteBuilder;
}

export interface BackupDbClient {
  from(table: string): BackupTable;
}

// 브라우저 클라이언트는 localStorage에 의존하므로 **모듈 최상단에서 import하지 않는다**
// (Node에서 도는 scripts/course-backup.ts가 같은 로직을 재사용할 수 있어야 한다).
// 앱에서 db를 넘기지 않으면 그때 동적으로 가져온다.
let cachedBrowserDb: BackupDbClient | null = null;

async function resolveDb(db?: BackupDbClient): Promise<BackupDbClient> {
  if (db) return db;
  if (!cachedBrowserDb) {
    const { supabase } = await import("@/integrations/supabase/client");
    cachedBrowserDb = supabase as unknown as BackupDbClient;
  }
  return cachedBrowserDb;
}

const fail = (label: string, error: { message?: string } | null): never => {
  throw new Error(`${label}: ${error?.message ?? "알 수 없는 오류"}`);
};

export type CourseSummary = {
  id: string;
  title: string;
  level: string | null;
  language_direction: string | null;
  domain: string | null;
  /** 화면 요약 표시용(선택한 교과목이 무엇인지 확인시키는 용도). */
  industry: string | null;
  week_count: number | null;
  updated_at: string | null;
};

/** 백업 대상 선택용 교과목 목록(최근 수정 순). */
export async function listBackupCourses(client?: BackupDbClient): Promise<CourseSummary[]> {
  const db = await resolveDb(client);
  const { data, error } = await db
    .from("curriculum_outlines")
    .select("id, title, level, language_direction, domain, industry, week_count, updated_at")
    .order("updated_at", { ascending: false });
  if (error) fail("교과목 목록 조회 실패", error);
  return (data ?? []) as unknown as CourseSummary[];
}

export type CourseBackupCounts = {
  weeks: number;
  assignments: number;
  scenarios: number;
};

/**
 * 백업 버튼을 누르기 전 「무엇이 담기는지」를 보여 주기 위한 가벼운 집계.
 * 백업 파일을 만들지 않고 개수만 센다(본문은 가져오지 않는다).
 */
export async function fetchCourseBackupCounts(
  outlineId: string,
  client?: BackupDbClient,
): Promise<CourseBackupCounts> {
  const db = await resolveDb(client);

  const { data: weeks, error: weeksError } = await db
    .from("curriculum_weeks")
    .select("week_no")
    .eq("outline_id", outlineId);
  if (weeksError) fail("주차 편성 수 조회 실패", weeksError);

  const { data: assignments, error: assignmentsError } = await db
    .from("curriculum_week_scenarios")
    .select("scenario_id")
    .eq("outline_id", outlineId);
  if (assignmentsError) fail("미션 배정 수 조회 실패", assignmentsError);

  const assignmentRows = assignments ?? [];
  return {
    weeks: (weeks ?? []).length,
    assignments: assignmentRows.length,
    scenarios: new Set(assignmentRows.map((row) => String(row.scenario_id))).size,
  };
}

export type CourseCompareBasis = {
  /** 이 교과목이 지금 이 환경에 있는가(없으면 복원이 새로 만든다). */
  exists: boolean;
  weeks: number;
  /** `주차:시나리오` 키 목록 — 복원이 추가할 배정을 정확히 세기 위한 것. */
  assignmentKeys: string[];
};

/**
 * 복원 직전 비교용 현재 상태. **개수와 키만** 읽는다(본문·필드 비교는 하지 않는다).
 * 복원은 삭제를 하지 않으므로 「추가될 것」만 셀 수 있고, 그것만 화면에 쓴다.
 */
export async function fetchCourseCompareBasis(
  outlineId: string,
  client?: BackupDbClient,
): Promise<CourseCompareBasis> {
  const db = await resolveDb(client);

  const { data: outline, error: outlineError } = await db
    .from("curriculum_outlines")
    .select("id")
    .eq("id", outlineId)
    .maybeSingle();
  if (outlineError) fail("현재 교과목 확인 실패", outlineError);
  if (!outline) return { exists: false, weeks: 0, assignmentKeys: [] };

  const { data: weeks, error: weeksError } = await db
    .from("curriculum_weeks")
    .select("week_no")
    .eq("outline_id", outlineId);
  if (weeksError) fail("현재 주차 편성 확인 실패", weeksError);

  const { data: assignments, error: assignmentsError } = await db
    .from("curriculum_week_scenarios")
    .select("week_no, scenario_id")
    .eq("outline_id", outlineId);
  if (assignmentsError) fail("현재 미션 배정 확인 실패", assignmentsError);

  return {
    exists: true,
    weeks: (weeks ?? []).length,
    assignmentKeys: (assignments ?? []).map((row) => `${String(row.week_no)}:${String(row.scenario_id)}`),
  };
}

export type FetchCourseBackupOptions = {
  db?: BackupDbClient;
  exportedAt?: Date;
  appVersion?: string | null;
  projectRef?: string | null;
};

/** 한 교과목의 편성·배정·시나리오를 읽어 백업 파일 구조로 만든다. */
export async function fetchCourseBackup(
  outlineId: string,
  options: FetchCourseBackupOptions = {},
): Promise<CourseBackupFile> {
  const db = await resolveDb(options.db);

  const { data: outline, error: outlineError } = await db
    .from("curriculum_outlines")
    .select("*")
    .eq("id", outlineId)
    .maybeSingle();
  if (outlineError) fail("교과목 조회 실패", outlineError);
  if (!outline) throw new Error(`교과목을 찾을 수 없습니다: ${outlineId}`);

  const { data: weeks, error: weeksError } = await db
    .from("curriculum_weeks")
    .select("*")
    .eq("outline_id", outlineId)
    .order("week_no", { ascending: true });
  if (weeksError) fail("주차 편성 조회 실패", weeksError);

  const { data: assignments, error: assignmentsError } = await db
    .from("curriculum_week_scenarios")
    .select("*")
    .eq("outline_id", outlineId)
    .order("week_no", { ascending: true })
    .order("position", { ascending: true });
  if (assignmentsError) fail("주차별 미션 배정 조회 실패", assignmentsError);

  const scenarioIds = Array.from(
    new Set((assignments ?? []).map((row) => String(row.scenario_id)).filter((id) => id.length > 0)),
  );

  let scenarios: BackupRow[] = [];
  if (scenarioIds.length > 0) {
    const { data: scenarioRows, error: scenarioError } = await db
      .from("scenarios")
      .select("*")
      .in("scenario_id", scenarioIds);
    if (scenarioError) fail("학습 미션 조회 실패", scenarioError);
    scenarios = scenarioRows ?? [];
  }

  const file = buildCourseBackup({
    outline,
    weeks: weeks ?? [],
    assignments: assignments ?? [],
    scenarios,
    exportedAt: options.exportedAt,
    appVersion: options.appVersion ?? null,
    projectRef: options.projectRef ?? null,
  });
  // 내보내기 직전 검사 — 하나라도 걸리면 파일을 만들지 않는다.
  assertNoSecrets(file);
  return file;
}

export type RestoreOutcome = {
  outlineId: string;
  weeksRestored: number;
  assignmentsRestored: number;
  scenariosInserted: number;
  scenariosAlreadyPresent: number;
  /** 백업 시점에 없어 정리한 배정·주차 수(선택한 교과목 범위 안에서만). */
  assignmentsRemoved: number;
  weeksRemoved: number;
  /** 복원 직전 상태를 담은 안전 백업. 대상 교과목이 없던 경우 null. */
  safetyBackup: CourseBackupFile | null;
};

/** 자연키 복원 대상에서 대리키(id)를 뺀다 — 기존 행의 PK를 건드리지 않기 위해서다. */
const withoutSurrogateId = (row: BackupRow): BackupRow => {
  const { id: _id, ...rest } = row;
  return rest;
};

export type RestoreCourseBackupOptions = {
  db?: BackupDbClient;
  /** 복원 직전 현재 상태를 자동 백업한다(기본 true). */
  createSafetyBackup?: boolean;
};

/**
 * 백업 파일을 복원한다. 선택한 교과목의 **편성 관계만** 백업 시점과 정확히 맞춘다.
 *  - 교과목: id 기준 upsert(있으면 백업 시점 값으로 되돌리고, 없으면 생성)
 *  - 주차 편성: (outline_id, week_no) 기준 upsert
 *  - 미션 배정: (outline_id, week_no, scenario_id) 기준 upsert
 *  - 학습 미션 본문: 없는 것만 insert — **공유 정본이므로 절대 지우지 않는다**
 *  - 마지막에, 이 outline_id 안에서 백업에 없는 배정·주차 행만 제거한다.
 *    (두 테이블은 outline_id 종속이고 이를 FK로 참조하는 테이블이 없다.
 *     편성기 saveWeekAssignments와 같은 정리 방식이다.)
 *
 * 순서 = upsert·insert 먼저, 삭제는 마지막. 중간에 실패해도 편성이 빈 구간은 생기지 않는다.
 */
export async function restoreCourseBackup(
  file: CourseBackupFile,
  options: RestoreCourseBackupOptions = {},
): Promise<RestoreOutcome> {
  const db = await resolveDb(options.db);
  const outline = file.data.curriculum_outlines[0];
  const outlineId = String(outline.id);

  let safetyBackup: CourseBackupFile | null = null;
  if (options.createSafetyBackup !== false) {
    const { data: existing, error: existingError } = await db
      .from("curriculum_outlines")
      .select("id")
      .eq("id", outlineId)
      .maybeSingle();
    if (existingError) fail("복원 전 상태 확인 실패", existingError);
    if (existing) {
      safetyBackup = await fetchCourseBackup(outlineId, { db });
    }
  }

  const { error: outlineError } = await db
    .from("curriculum_outlines")
    .upsert([outline], { onConflict: "id" });
  if (outlineError) fail("교과목 복원 실패", outlineError);

  const weeks = file.data.curriculum_weeks.map(withoutSurrogateId);
  if (weeks.length > 0) {
    const { error: weeksError } = await db
      .from("curriculum_weeks")
      .upsert(weeks, { onConflict: "outline_id,week_no" });
    if (weeksError) fail("주차 편성 복원 실패", weeksError);
  }

  // 미션 본문이 먼저 있어야 배정의 외래키가 성립한다.
  const scenarios = file.data.scenarios;
  let scenariosInserted = 0;
  let scenariosAlreadyPresent = 0;
  if (scenarios.length > 0) {
    const scenarioIds = scenarios.map((row) => String(row.scenario_id));
    const { data: presentRows, error: presentError } = await db
      .from("scenarios")
      .select("scenario_id")
      .in("scenario_id", scenarioIds);
    if (presentError) fail("기존 학습 미션 확인 실패", presentError);
    const present = new Set((presentRows ?? []).map((row) => String(row.scenario_id)));
    scenariosAlreadyPresent = present.size;
    const missing = scenarios.filter((row) => !present.has(String(row.scenario_id)));
    if (missing.length > 0) {
      const { error: insertError } = await db.from("scenarios").insert(missing);
      if (insertError) fail("학습 미션 복원 실패", insertError);
      scenariosInserted = missing.length;
    }
  }

  const assignments = file.data.curriculum_week_scenarios.map(withoutSurrogateId);
  if (assignments.length > 0) {
    const { error: assignmentsError } = await db
      .from("curriculum_week_scenarios")
      .upsert(assignments, { onConflict: "outline_id,week_no,scenario_id" });
    if (assignmentsError) fail("미션 배정 복원 실패", assignmentsError);
  }

  // ── 여기서부터 정리 단계 — 백업 시점에 없던 편성 관계만, 이 교과목 안에서만 지운다.
  const assignmentKey = (row: BackupRow) => `${String(row.week_no)}:${String(row.scenario_id)}`;
  const keepAssignments = new Set(file.data.curriculum_week_scenarios.map(assignmentKey));

  const { data: currentAssignments, error: currentAssignmentsError } = await db
    .from("curriculum_week_scenarios")
    .select("id, week_no, scenario_id")
    .eq("outline_id", outlineId);
  if (currentAssignmentsError) fail("현재 미션 배정 확인 실패", currentAssignmentsError);

  const staleAssignmentIds = (currentAssignments ?? [])
    .filter((row) => !keepAssignments.has(assignmentKey(row)))
    .map((row) => row.id);
  if (staleAssignmentIds.length > 0) {
    const { error: removeError } = await db
      .from("curriculum_week_scenarios")
      .delete()
      .in("id", staleAssignmentIds);
    if (removeError) fail("백업에 없는 미션 배정 정리 실패", removeError);
  }

  const keepWeeks = new Set(file.data.curriculum_weeks.map((row) => String(row.week_no)));
  const { data: currentWeeks, error: currentWeeksError } = await db
    .from("curriculum_weeks")
    .select("id, week_no")
    .eq("outline_id", outlineId);
  if (currentWeeksError) fail("현재 주차 편성 확인 실패", currentWeeksError);

  const staleWeekIds = (currentWeeks ?? [])
    .filter((row) => !keepWeeks.has(String(row.week_no)))
    .map((row) => row.id);
  if (staleWeekIds.length > 0) {
    const { error: removeWeekError } = await db.from("curriculum_weeks").delete().in("id", staleWeekIds);
    if (removeWeekError) fail("백업에 없는 주차 편성 정리 실패", removeWeekError);
  }

  return {
    outlineId,
    weeksRestored: weeks.length,
    assignmentsRestored: assignments.length,
    scenariosInserted,
    scenariosAlreadyPresent,
    assignmentsRemoved: staleAssignmentIds.length,
    weeksRemoved: staleWeekIds.length,
    safetyBackup,
  };
}

/** 브라우저에서 백업 파일을 내려받는다. */
export function downloadCourseBackup(file: CourseBackupFile, filename = courseBackupFilename(file)): void {
  const blob = new Blob([serializeCourseBackup(file)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
