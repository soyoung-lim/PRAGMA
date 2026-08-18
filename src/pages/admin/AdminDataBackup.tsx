import { useEffect, useMemo, useRef, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { DIRECTION_LABEL, DOMAIN, INDUSTRY, LEVEL } from "@/lib/pragma/enums";
import type { Domain, IndustrySector, LanguageDirection, LearnerLevel } from "@/lib/pragma/enums";
import {
  COURSE_BACKUP_SCOPE,
  COURSE_BACKUP_SUMMARY,
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

const levelLabel = (value: string | null) => LEVEL[value as LearnerLevel] ?? value ?? null;
const directionLabel = (value: string | null) => DIRECTION_LABEL[value as LanguageDirection] ?? value ?? null;
const domainLabel = (value: string | null) => DOMAIN[value as Domain] ?? value ?? null;
const industryLabel = (value: string | null) => INDUSTRY[value as IndustrySector] ?? value ?? null;

/** 「고급 · 중→한 · 직무 · 15주」 형태의 한 줄 요약. */
const courseTraits = (course: CourseSummary) =>
  [
    levelLabel(course.level),
    directionLabel(course.language_direction),
    domainLabel(course.domain),
    industryLabel(course.industry),
    course.week_count ? `${course.week_count}주` : null,
  ].filter(Boolean) as string[];

const formatStamp = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}. ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};

const ScopeDetails = () => (
  <details className="mt-4 border-t border-border pt-3 text-sm leading-6 text-muted-foreground">
    <summary className="cursor-pointer font-medium text-foreground">백업 범위 자세히 보기</summary>
    <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <h4 className="mb-1.5 font-semibold text-foreground">파일에 담기는 것</h4>
        <ul className="list-disc space-y-1 pl-4">
          {COURSE_BACKUP_SCOPE.included.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <div>
        <h4 className="mb-1.5 font-semibold text-foreground">담기지 않는 것</h4>
        <ul className="list-disc space-y-1 pl-4">
          {COURSE_BACKUP_SCOPE.excluded.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  </details>
);

const PreviewRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between gap-3 py-1">
    <dt className="shrink-0 text-muted-foreground">{label}</dt>
    <dd className="text-right font-medium">{value}</dd>
  </div>
);

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

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedId) ?? null,
    [courses, selectedId],
  );

  const preview = useMemo(() => (pendingFile ? summarizeCourseBackup(pendingFile) : null), [pendingFile]);

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
      setPendingFile(parseCourseBackup(await file.text()));
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
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        {/* 기본 흐름 = 교과목 선택 → 백업. 그래서 이쪽이 주(主)다. */}
        <section className="rounded-xl border-2 border-primary/30 bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">데이터 백업</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {COURSE_BACKUP_SUMMARY.included}
            <br />
            {COURSE_BACKUP_SUMMARY.excluded}
          </p>

          <label className="mb-1.5 mt-5 block text-sm font-medium" htmlFor="backup-course">
            백업할 교과목
          </label>
          <select
            id="backup-course"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
            disabled={loadingCourses || courses.length === 0}
          >
            {loadingCourses && <option value="">불러오는 중…</option>}
            {!loadingCourses && courses.length === 0 && <option value="">편성된 교과목이 없습니다</option>}
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>

          {selectedCourse && (
            <div className="mt-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
              <p className="text-sm font-semibold">{selectedCourse.title}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{courseTraits(selectedCourse).join(" · ")}</p>
            </div>
          )}

          <Button className="mt-5 w-full sm:w-auto" size="lg" onClick={runBackup} disabled={!selectedId || backingUp}>
            {backingUp ? "백업하는 중…" : "백업하기"}
          </Button>

          {backupNotice && (
            <p className={`mt-4 rounded-lg border px-4 py-3 text-sm leading-6 ${NOTICE_STYLE[backupNotice.tone]}`}>
              {backupNotice.text}
            </p>
          )}

          <ScopeDetails />
        </section>

        {/* 복원은 필요할 때만 쓰는 보조 동작 — 한 단계 낮은 위계로 둔다. */}
        <section className="rounded-xl border border-border bg-muted/20 p-5">
          <h2 className="text-base font-semibold">데이터 복원</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            내려받은 백업 파일로 이 수업 구성을 다시 되살립니다.
          </p>

          <label className="mb-1.5 mt-4 block text-sm font-medium" htmlFor="restore-file">
            백업 파일
          </label>
          <input
            id="restore-file"
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={onFileSelected}
            className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm"
          />

          {preview && (
            <div className="mt-4 rounded-lg border border-border bg-card px-4 py-3">
              <p className="mb-2 text-sm font-semibold">이 파일의 내용</p>
              <dl className="divide-y divide-border text-sm">
                <PreviewRow label="교과목" value={preview.title} />
                <PreviewRow
                  label="구성"
                  value={
                    [levelLabel(preview.level), directionLabel(preview.languageDirection), domainLabel(preview.domain)]
                      .filter(Boolean)
                      .join(" · ") || "정보 없음"
                  }
                />
                <PreviewRow label="주차 편성" value={`${preview.weekCount}주`} />
                <PreviewRow label="미션 배정" value={`${preview.assignmentCount}건`} />
                <PreviewRow label="학습 미션" value={`${preview.scenarioCount}건`} />
                <PreviewRow label="백업 시각" value={formatStamp(preview.exportedAt)} />
              </dl>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                다른 교과목과 학습자 수행기록은 변경하지 않습니다.
              </p>
            </div>
          )}

          <Button
            className="mt-4"
            variant="outline"
            onClick={runRestore}
            disabled={!pendingFile || restoring}
          >
            {restoring ? "복원하는 중…" : "복원하기"}
          </Button>

          {restoreNotice && (
            <p className={`mt-4 rounded-lg border px-4 py-3 text-sm leading-6 ${NOTICE_STYLE[restoreNotice.tone]}`}>
              {restoreNotice.text}
            </p>
          )}

          <div className="mt-5 rounded-lg border border-border bg-background px-4 py-3">
            <p className="text-sm font-semibold">복원 전 자동 백업</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              현재 수업 구성을 파일로 먼저 저장한 뒤 복원합니다.
              필요하면 그 파일로 이전 상태로 되돌릴 수 있습니다.
            </p>
          </div>
        </section>
      </div>
    </AdminShell>
  );
};

export default Page;
