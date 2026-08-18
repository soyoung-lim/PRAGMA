// 교과목 백업·복원의 데이터 접근 계층.
//
// RLS 전제: 이 경로는 admin 전용이다. 접근 통제를 여기서 다시 구현하지 않는다.
//
// ⚠️ 원자성 한계(curriculum/api.ts·composer.ts와 동일): 여러 PostgREST 요청은 하나의
//    트랜잭션이 아니다. 복원은 삭제를 하지 않고 upsert·부족분 insert만 하므로,
//    중간 실패는 "일부만 복원된 상태"로 남을 뿐 기존 데이터를 지우지 않는다.
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

export interface BackupTable {
  select(columns: string): BackupSelectBuilder;
  upsert(rows: BackupRow[], options?: { onConflict?: string }): PromiseLike<BackupQueryResponse<null>>;
  insert(rows: BackupRow[]): PromiseLike<BackupQueryResponse<null>>;
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
  updated_at: string | null;
};

/** 백업 대상 선택용 교과목 목록(최근 수정 순). */
export async function listBackupCourses(client?: BackupDbClient): Promise<CourseSummary[]> {
  const db = await resolveDb(client);
  const { data, error } = await db
    .from("curriculum_outlines")
    .select("id, title, level, language_direction, domain, updated_at")
    .order("updated_at", { ascending: false });
  if (error) fail("교과목 목록 조회 실패", error);
  return (data ?? []) as unknown as CourseSummary[];
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
 * 백업 파일을 복원한다. **삭제는 하지 않는다.**
 *  - 교과목: id 기준 upsert(있으면 백업 시점 값으로 되돌리고, 없으면 생성)
 *  - 주차 편성: (outline_id, week_no) 기준 upsert
 *  - 미션 배정: (outline_id, week_no, scenario_id) 기준 upsert
 *  - 학습 미션 본문: 없는 것만 insert(기존 미션의 검수·승인 상태는 덮어쓰지 않는다)
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

  return {
    outlineId,
    weeksRestored: weeks.length,
    assignmentsRestored: assignments.length,
    scenariosInserted,
    scenariosAlreadyPresent,
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
