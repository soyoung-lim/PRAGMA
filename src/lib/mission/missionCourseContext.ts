export interface MissionCourseLocation {
  courseId: string;
  weekNo: number;
  assignmentId: string;
}

export type MissionCourseLocationResult =
  | { ok: true; context: MissionCourseLocation | null }
  | { ok: false; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** 직접 미션 URL은 허용하되, 교과목 파라미터가 하나라도 있으면 완전한 귀속 tuple을 강제한다. */
export function parseMissionCourseLocation(search: string): MissionCourseLocationResult {
  const params = new URLSearchParams(search);
  const courseId = params.get("courseId");
  const weekText = params.get("weekNo");
  const assignmentId = params.get("assignmentId");
  if (!courseId && !weekText && !assignmentId) return { ok: true, context: null };
  const weekNo = Number(weekText);
  if (!courseId || !UUID_RE.test(courseId) || !assignmentId || !UUID_RE.test(assignmentId)) {
    return { ok: false, error: "교과목 또는 배치 ID가 올바르지 않습니다." };
  }
  if (!Number.isInteger(weekNo) || weekNo < 1 || weekNo > 15) {
    return { ok: false, error: "교과목 주차가 올바르지 않습니다." };
  }
  return { ok: true, context: { courseId, weekNo, assignmentId } };
}
