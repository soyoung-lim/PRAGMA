import { useEffect, useRef, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import {
  COURSE_BACKUP_SCOPE,
  courseBackupFilename,
  parseCourseBackup,
  summarizeCourseBackup,
  type CourseBackupFile,
} from "@/lib/backup/courseBackup";
import {
  downloadCourseBackup,
  fetchCourseBackup,
  listBackupCourses,
  restoreCourseBackup,
  type CourseSummary,
} from "@/lib/backup/courseBackupApi";

type Notice = { tone: "ok" | "error" | "info"; text: string };

const NOTICE_STYLE: Record<Notice["tone"], string> = {
  ok: "border-emerald-200 bg-emerald-50 text-emerald-900",
  error: "border-rose-200 bg-rose-50 text-rose-900",
  info: "border-sky-200 bg-sky-50 text-sky-950",
};

const LEVEL_LABEL: Record<string, string> = {
  beginner_intermediate: "입문·중급",
  intermediate: "중급",
  advanced: "고급",
};
const DIRECTION_LABEL: Record<string, string> = { ko_zh: "한→중", zh_ko: "중→한" };
const DOMAIN_LABEL: Record<string, string> = { daily: "일상", school: "학업", work: "직무" };

const describeCourse = (course: CourseSummary) =>
  [
    course.title,
    LEVEL_LABEL[course.level ?? ""] ?? course.level,
    DIRECTION_LABEL[course.language_direction ?? ""] ?? course.language_direction,
    DOMAIN_LABEL[course.domain ?? ""] ?? course.domain,
  ]
    .filter(Boolean)
    .join(" · ");

const Page = () => {
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [backupNotice, setBackupNotice] = useState<Notice | null>(null);
  const [restoreNotice, setRestoreNotice] = useState<Notice | null>(null);
  const [pendingFile, setPendingFile] = useState<CourseBackupFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    listBackupCourses()
      .then((rows) => {
        if (cancelled) return;
        setCourses(rows);
        setSelectedId((current) => current || (rows[0]?.id ?? ""));
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setBackupNotice({
          tone: "error",
          text: error instanceof Error ? error.message : "교과목 목록을 불러오지 못했습니다.",
        });
      })
      .finally(() => {
        if (!cancelled) setLoadingCourses(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const runBackup = async () => {
    if (!selectedId) return;
    setBackingUp(true);
    setBackupNotice(null);
    try {
      const file = await fetchCourseBackup(selectedId, {
        projectRef: import.meta.env.VITE_SUPABASE_PROJECT_ID ?? null,
      });
      downloadCourseBackup(file);
      const summary = summarizeCourseBackup(file);
      setBackupNotice({
        tone: "ok",
        text: `${courseBackupFilename(file)} 파일을 내려받았습니다. 주차 ${summary.weekCount}개 · 미션 배정 ${summary.assignmentCount}건 · 학습 미션 ${summary.scenarioCount}건.`,
      });
    } catch (error) {
      setBackupNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "백업에 실패했습니다.",
      });
    } finally {
      setBackingUp(false);
    }
  };

  const onFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setPendingFile(null);
    setRestoreNotice(null);
    if (!file) return;
    try {
      const parsed = parseCourseBackup(await file.text());
      const summary = summarizeCourseBackup(parsed);
      setPendingFile(parsed);
      setRestoreNotice({
        tone: "info",
        text: `확인했습니다 — 「${summary.title}」 · 주차 ${summary.weekCount}개 · 미션 배정 ${summary.assignmentCount}건 · 백업 시각 ${summary.exportedAt.slice(0, 16).replace("T", " ")}. 복원하려면 아래 버튼을 누르세요.`,
      });
    } catch (error) {
      setRestoreNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "백업 파일을 읽지 못했습니다.",
      });
    }
  };

  const runRestore = async () => {
    if (!pendingFile) return;
    setRestoring(true);
    setRestoreNotice(null);
    try {
      const outcome = await restoreCourseBackup(pendingFile);
      if (outcome.safetyBackup) {
        // 복원 직전 상태를 먼저 파일로 남긴다(되돌릴 수 있게).
        downloadCourseBackup(
          outcome.safetyBackup,
          `pragma-course-backup-복원직전-${outcome.safetyBackup.manifest.exported_at.slice(0, 10)}.json`,
        );
      }
      const scenarioNote = outcome.scenariosInserted > 0
        ? ` 없던 학습 미션 ${outcome.scenariosInserted}건을 새로 넣었습니다.`
        : " 학습 미션은 모두 이미 있어 건드리지 않았습니다.";
      setRestoreNotice({
        tone: "ok",
        text: `복원했습니다 — 주차 ${outcome.weeksRestored}개 · 미션 배정 ${outcome.assignmentsRestored}건.${scenarioNote}${outcome.safetyBackup ? " 복원 직전 상태도 파일로 내려받았습니다." : ""}`,
      });
      setPendingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      const rows = await listBackupCourses();
      setCourses(rows);
    } catch (error) {
      setRestoreNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "복원에 실패했습니다.",
      });
    } finally {
      setRestoring(false);
    }
  };

  return (
    <AdminShell
      title="수업 데이터 백업·복원"
      description="내가 편성한 교과목의 15주 수업 구성을 파일로 내려받고, 그 파일로 다시 되돌립니다."
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-1 text-base font-semibold">데이터 백업</h2>
          <p className="mb-4 text-sm leading-6 text-muted-foreground">
            이 교과목에 편성된 15주 수업 구성, 시나리오·미션, 검수·승인 상태를 백업합니다.
            인증정보와 API key는 포함하지 않습니다.
          </p>

          <label className="mb-1.5 block text-sm font-medium" htmlFor="backup-course">
            백업할 교과목
          </label>
          <select
            id="backup-course"
            className="mb-4 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
            disabled={loadingCourses || courses.length === 0}
          >
            {loadingCourses && <option value="">불러오는 중…</option>}
            {!loadingCourses && courses.length === 0 && <option value="">편성된 교과목이 없습니다</option>}
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {describeCourse(course)}
              </option>
            ))}
          </select>

          <Button onClick={runBackup} disabled={!selectedId || backingUp}>
            {backingUp ? "백업하는 중…" : "백업하기"}
          </Button>

          {backupNotice && (
            <p className={`mt-4 rounded-lg border px-4 py-3 text-sm leading-6 ${NOTICE_STYLE[backupNotice.tone]}`}>
              {backupNotice.text}
            </p>
          )}

          <div className="mt-5 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div>
              <h3 className="mb-1.5 font-semibold">파일에 담기는 것</h3>
              <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
                {COURSE_BACKUP_SCOPE.included.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-1.5 font-semibold">담기지 않는 것</h3>
              <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
                {COURSE_BACKUP_SCOPE.excluded.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-1 text-base font-semibold">데이터 복원</h2>
          <p className="mb-4 text-sm leading-6 text-muted-foreground">
            백업 파일을 올리면 형식을 먼저 확인합니다. 복원은 백업 시점의 편성을 되살리며,
            다른 교과목이나 학습자 기록은 지우지 않습니다.
          </p>

          <label className="mb-1.5 block text-sm font-medium" htmlFor="restore-file">
            백업 파일
          </label>
          <input
            id="restore-file"
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={onFileSelected}
            className="mb-4 block w-full text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm"
          />

          <Button onClick={runRestore} disabled={!pendingFile || restoring} variant="secondary">
            {restoring ? "복원하는 중…" : "복원하기"}
          </Button>

          {restoreNotice && (
            <p className={`mt-4 rounded-lg border px-4 py-3 text-sm leading-6 ${NOTICE_STYLE[restoreNotice.tone]}`}>
              {restoreNotice.text}
            </p>
          )}

          <p className="mt-5 text-sm leading-6 text-muted-foreground">
            복원하기를 누르면 <strong>복원 직전 상태</strong>가 자동으로 한 번 더 파일로 저장됩니다.
            되돌리고 싶으면 그 파일을 다시 복원하면 됩니다.
          </p>
        </section>
      </div>
    </AdminShell>
  );
};

export default Page;
