import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { WeeklyMaterialDocument } from "@/components/curriculum/WeeklyMaterialDocument";
import { WeeklyInstructorNotes, type WeeklyMissionNotes } from "@/components/admin/WeeklyInstructorNotes";
import { getCurriculumOutline, listCurriculumOutlines } from "@/lib/curriculum/api";
import { listCoreScenarios, listWeekAssignments } from "@/lib/curriculum/composer";
import { assembleLearnerCourse } from "@/lib/curriculum/learnerCourse";
import { buildWeeklyCourseMaterial } from "@/lib/curriculum/weeklyMaterials";
import { buildWeeklyMaterialsHtml, weeklyMaterialsHtmlFilename } from "@/lib/pragma/instructorGuideHtml";
import { buildInstructorMissionGuide } from "@/lib/pragma/instructorGuide";
import { normalizeMission } from "@/lib/pragma/missionSchema";
import { isMissionReleasedForLearner } from "@/lib/mission/missionRelease";
import { SPEECH_ACT_UI, type SpeechActUI } from "@/lib/pragma/enums";
import { DEFENSE_COURSE_IDS } from "@/lib/pragma/scenarioTopics";
import { ContentReviewPanel } from "@/components/admin/ContentReviewPanel";
import { supabase } from "@/integrations/supabase/client";

const AdminTeachingMaterials = () => {
  const [params, setParams] = useSearchParams();
  const courseId = params.get("courseId") ?? "";
  const requestedWeek = params.get("weekNo");
  const [reviewOpen, setReviewOpen] = useState(params.get("review") === "1");
  const [notesOpen, setNotesOpen] = useState(false);
  const [projectorOpen, setProjectorOpen] = useState(false);
  const [activeSection, setActiveSection] = useState(0);
  const projectorRef = useRef<HTMLDivElement>(null);
  const projectorButtonRef = useRef<HTMLButtonElement>(null);

  const outlines = useQuery({ queryKey: ["teaching-outlines"], queryFn: listCurriculumOutlines });
  const courseQuery = useQuery({
    queryKey: ["teaching-course", courseId],
    enabled: Boolean(courseId),
    queryFn: async () => {
      const [curriculum, assignments, cores] = await Promise.all([
        getCurriculumOutline(courseId), listWeekAssignments(courseId), listCoreScenarios(),
      ]);
      return assembleLearnerCourse({ ...curriculum, assignments, cores });
    },
  });
  const course = courseQuery.data;
  const week = requestedWeek !== null
    ? course?.weeks.find((item) => item.week_no === Number(requestedWeek))
    : course?.weeks[0];
  const material = course && week ? buildWeeklyCourseMaterial(course.outline, week) : null;
  const missionIds = week?.scenarios.map((scenario) => scenario.scenario_id) ?? [];

  const missionNotes = useQuery({
    queryKey: ["teaching-mission-notes", courseId, week?.week_no, missionIds],
    enabled: notesOpen && Boolean(week) && missionIds.length > 0,
    queryFn: async (): Promise<WeeklyMissionNotes[]> => {
      const { data, error } = await supabase.from("scenarios")
        .select("scenario_id,speech_act,mission_status,mission_content")
        .in("scenario_id", missionIds);
      if (error) throw new Error(error.message);
      return missionIds.flatMap((id, index) => {
        const row = data?.find((item) => item.scenario_id === id);
        if (!row || !isMissionReleasedForLearner(row)) return [];
        const mission = normalizeMission(row.mission_content);
        if (!mission.ok || !mission.data) return [];
        return [{
          scenarioId: id,
          label: `미션 ${index + 1}`,
          guide: buildInstructorMissionGuide(mission.data, SPEECH_ACT_UI[row.speech_act as SpeechActUI] ?? "화행"),
        }];
      });
    },
  });

  useEffect(() => {
    setNotesOpen(false);
    setProjectorOpen(false);
    setActiveSection(0);
  }, [courseId, requestedWeek]);

  // 화면 진입 시 첫 교과목을 기본 선택해, 빈 화면 대신 1주차 자료를 바로 보여 준다.
  // 미션 단독 주소로 들어온 경우에는 교강사가 직접 고르도록 자동 선택하지 않는다.
  const outlineList = outlines.data;
  const missionParam = params.get("mission");
  useEffect(() => {
    if (courseId || missionParam) return;
    const firstOutline = outlineList?.[0];
    if (!firstOutline) return;
    const next = new URLSearchParams(params);
    next.set("courseId", firstOutline.id);
    setParams(next, { replace: true });
  }, [courseId, missionParam, outlineList, params, setParams]);

  const sectionCount = material?.sections.length ?? 0;
  useEffect(() => {
    if (!projectorOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    projectorRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Tab") {
        const buttons = projectorRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
        const first = buttons?.[0];
        const last = buttons?.[buttons.length - 1];
        if (document.activeElement === projectorRef.current || (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
          event.preventDefault();
          (event.shiftKey ? last : first)?.focus();
        }
      }
      if (event.key === "Escape") setProjectorOpen(false);
      if (event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault();
        setActiveSection((current) => Math.min(sectionCount - 1, current + 1));
      }
      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        setActiveSection((current) => Math.max(0, current - 1));
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKey);
      projectorButtonRef.current?.focus();
    };
  }, [projectorOpen, sectionCount]);

  const exportHtml = () => {
    if (!material) return;
    const blob = new Blob([buildWeeklyMaterialsHtml(material)], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = weeklyMaterialsHtmlFilename(material);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return <AdminShell title="수업자료·교실 화면" description="교과목·주차 계획과 편성된 학습 미션을 기준으로 공통 수업자료를 구성합니다.">
    <div className="max-w-[1080px] space-y-5">
      <section className="rounded-xl border bg-white p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold">교과목
            <select aria-label="수업자료 교과목" value={courseId} onChange={(event) => setParams(event.target.value ? { courseId: event.target.value } : {})} className="mt-2 h-10 w-full rounded-md border bg-white px-3 font-normal">
              {!courseId && <option value="">교과목 선택</option>}
              {outlines.data?.map((outline) => <option key={outline.id} value={outline.id}>{outline.title}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold">주차
            <select aria-label="수업자료 주차" value={week?.week_no ?? ""} disabled={!course} onChange={(event) => setParams({ courseId, weekNo: event.target.value })} className="mt-2 h-10 w-full rounded-md border bg-white px-3 font-normal">
              {!week && <option value="">주차 선택</option>}
              {course?.weeks.map((item) => <option key={item.week_no} value={item.week_no}>{item.week_no}주차 · {item.title}</option>)}
            </select>
          </label>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">주차 계획 → 미션 편성 → 주차 수업자료 순서입니다. 현재 저장된 편성과 기존 설명을 재사용하며 새 학습 콘텐츠는 생성하지 않습니다.</p>
      </section>
      {outlines.isError && <p role="alert">교과목 목록을 불러오지 못했습니다.</p>}
      {outlines.isSuccess && outlines.data.length === 0 && <p className="text-sm">조회 가능한 교과목이 없습니다. 관리자 로그인과 <Link className="underline" to="/admin/composer">저장된 교과목</Link>을 확인해 주세요.</p>}
      {!courseId && <div className="rounded-xl border border-dashed p-5 text-sm">
        교과목과 주차를 선택해 주세요. 미편성 주차는 계획만 미리 보고, 편성 후 해당 미션에 맞춰 자료를 구성합니다.
        {params.get("mission") && <p className="mt-2">미션 단독 주소로 들어왔습니다. 이 미션을 사용할 교과목과 주차를 선택해 주세요.</p>}
      </div>}
      {courseId && courseQuery.isPending && <p role="status">주차 계획을 불러오는 중…</p>}
      {courseQuery.isError && <p role="alert">주차 계획을 불러오지 못했습니다. 교과목 선택을 확인해 주세요.</p>}
      {course && !week && <p role="alert">해당 주차를 찾을 수 없습니다.</p>}
      {course && week && material && <>
        {!projectorOpen && <details open={reviewOpen} onToggle={(event) => setReviewOpen(event.currentTarget.open)} className="rounded-xl border bg-white p-4">
          <summary className="cursor-pointer font-semibold">이 주차 수업자료 검수·확정</summary>
          {reviewOpen && <ContentReviewPanel key={`${courseId}-${week.week_no}`} target={{ kind: "weekly_material", targetId: courseId, weekNo: week.week_no }} />}
        </details>}
        {!projectorOpen && <p className="text-xs text-muted-foreground">아래는 현재 편성의 교수자 미리보기입니다. 학생 유인물은 이 주차 검수·확정 후 공개되며, 내용이나 편성이 바뀌면 재검수가 필요합니다.</p>}
        <div className="flex flex-wrap items-center gap-2">
          <Button ref={projectorButtonRef} onClick={() => { setNotesOpen(false); setActiveSection(0); setProjectorOpen(true); }}>프로젝터 화면</Button>
          <Button variant="outline" onClick={exportHtml}>HTML</Button>
          <Button variant={notesOpen ? "default" : "outline"} onClick={() => setNotesOpen((open) => !open)} aria-pressed={notesOpen}>교수자 전용 메모</Button>
          {course.outline.status === "published" && DEFENSE_COURSE_IDS.includes(courseId) && <Button variant="outline" asChild><Link target="_blank" rel="noreferrer" to={`/learner/course/${courseId}/week/${week.week_no}/note`}>학생 유인물 ↗</Link></Button>}
        </div>
        {notesOpen && !projectorOpen ? <>
          {missionNotes.isFetching && missionIds.length > 0 && <p role="status">미션 해설을 불러오는 중…</p>}
          {missionNotes.isError && <p role="alert">미션 해설을 불러오지 못했습니다. 공통 수업자료는 계속 사용할 수 있습니다.</p>}
          <WeeklyInstructorNotes week={week} direction={course.outline.language_direction} missions={missionNotes.data ?? []} />
        </> : !projectorOpen && <WeeklyMaterialDocument material={material} />}
        {!projectorOpen && <section className="rounded-xl border bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">실시간 학급 응답</h2>
              <p className="mt-1 text-xs text-muted-foreground">문항별 익명 분포를 확인하고 교실 화면으로 크게 보여 줍니다.</p>
            </div>
            <Button variant="outline" asChild>
              <Link to={`/admin/class-responses?courseId=${encodeURIComponent(courseId)}&weekNo=${week.week_no}`}>
                응답 보드 열기 →
              </Link>
            </Button>
          </div>
        </section>}
        {!projectorOpen && <section className="rounded-xl border bg-white p-4">
          <h2 className="font-semibold">연결된 실습</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {material.missions.map((mission) => <Button key={mission.id} variant="outline" asChild><Link target="_blank" rel="noreferrer" to={`/learner/practice/${mission.id}?courseId=${encodeURIComponent(courseId)}&weekNo=${week.week_no}`}>{mission.label} 열기 ↗</Link></Button>)}
            {!material.missions.length && <p className="text-sm text-muted-foreground">연결된 공개 미션이 없습니다. 미션을 사용하는 주차는 Composer에서 편성을 먼저 완료해 주세요.</p>}
          </div>
        </section>}
        {projectorOpen && <div ref={projectorRef} role="dialog" aria-modal="true" aria-label="주차 프로젝터" tabIndex={-1} className="fixed inset-0 z-[100] overflow-y-auto bg-[#F8F6EE] p-5 sm:p-10">
          <div className="mx-auto max-w-5xl">
            <div className="mb-5 flex items-center justify-between gap-3">
              <span className="text-sm">{activeSection + 1} / {sectionCount}</span>
              <div className="flex gap-2">
                <Button variant="outline" disabled={activeSection === 0} onClick={() => setActiveSection((current) => current - 1)}>이전</Button>
                <Button variant="outline" disabled={activeSection === sectionCount - 1} onClick={() => setActiveSection((current) => current + 1)}>다음</Button>
                <Button variant="outline" onClick={() => setProjectorOpen(false)}>닫기</Button>
              </div>
            </div>
            <div className="[&_.material-section]:min-h-[45vh] [&_.material-section_h2]:text-3xl [&_.material-section_p]:text-xl [&_.material-section_p]:leading-9 [&_.material-section_li]:text-xl [&_.material-section_li]:leading-9">
              <WeeklyMaterialDocument material={material} activeSection={activeSection} />
            </div>
          </div>
        </div>}
      </>}
    </div>
  </AdminShell>;
};

export default AdminTeachingMaterials;
