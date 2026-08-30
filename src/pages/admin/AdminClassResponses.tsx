import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Maximize2, RefreshCw, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { AdminShell } from "@/components/AdminShell";
import { ClassResponsePatterns } from "@/components/admin/ClassResponsePatterns";
import { Button } from "@/components/ui/button";
import { getCurriculumOutline, listCurriculumOutlines } from "@/lib/curriculum/api";
import { listCoreScenarios, listWeekAssignments } from "@/lib/curriculum/composer";
import { assembleLearnerCourse } from "@/lib/curriculum/learnerCourse";
import { missionSituationSummary } from "@/lib/curriculum/weeklyMaterials";
import { DEMO_CLASS_RESPONSE_PATTERN } from "@/lib/mission/classResponseDemo";
import {
  aggregateMissionResponses,
  type ClassResponseLogRow,
  type MissionPattern,
} from "@/lib/mission/classResponsePatterns";
import { normalizeMission } from "@/lib/pragma/missionSchema";
import { supabase } from "@/integrations/supabase/client";

const AdminClassResponses = () => {
  const [params, setParams] = useSearchParams();
  const [demo, setDemo] = useState(false);
  const [projector, setProjector] = useState(false);
  const projectorRef = useRef<HTMLDivElement>(null);
  const courseId = params.get("courseId") ?? "";

  const outlines = useQuery({
    queryKey: ["class-response-outlines"],
    queryFn: listCurriculumOutlines,
  });
  const courseQuery = useQuery({
    queryKey: ["class-response-course", courseId],
    enabled: Boolean(courseId),
    queryFn: async () => {
      const [curriculum, assignments, cores] = await Promise.all([
        getCurriculumOutline(courseId),
        listWeekAssignments(courseId),
        listCoreScenarios(),
      ]);
      return assembleLearnerCourse({ ...curriculum, assignments, cores });
    },
  });
  const course = courseQuery.data;
  const requestedWeek = Number(params.get("weekNo"));
  const week = Number.isInteger(requestedWeek) && requestedWeek > 0
    ? course?.weeks.find((item) => item.week_no === requestedWeek) ?? course?.weeks[0]
    : course?.weeks[0];
  const requestedMission = params.get("missionId");
  const selectedMission = week?.scenarios.find((item) => item.scenario_id === requestedMission)
    ?? week?.scenarios[0]
    ?? null;
  const missionId = selectedMission?.scenario_id ?? "";

  useEffect(() => {
    if (courseId || !outlines.data?.[0]) return;
    setParams({ courseId: outlines.data[0].id }, { replace: true });
  }, [courseId, outlines.data, setParams]);

  const patternQuery = useQuery({
    queryKey: ["class-response-pattern", courseId, week?.week_no, missionId],
    enabled: !demo && Boolean(missionId),
    refetchInterval: demo ? false : 5000,
    queryFn: async (): Promise<MissionPattern> => {
      const [logsResult, missionResult] = await Promise.all([
        supabase.from("learner_mission_logs")
          .select("mission_id,profile_id,completed_at,context_judgment")
          .eq("mission_id", missionId),
        supabase.from("scenarios")
          .select("mission_content")
          .eq("scenario_id", missionId)
          .maybeSingle(),
      ]);
      if (logsResult.error) throw new Error(logsResult.error.message);
      if (missionResult.error) throw new Error(missionResult.error.message);
      const mission = normalizeMission(missionResult.data?.mission_content);
      return aggregateMissionResponses(
        missionId,
        (logsResult.data ?? []) as ClassResponseLogRow[],
        mission.ok ? mission.data ?? null : null,
      );
    },
  });

  const visiblePattern = demo ? DEMO_CLASS_RESPONSE_PATTERN : patternQuery.data ?? null;
  const hasResponses = Boolean(visiblePattern && visiblePattern.learners > 0);

  useEffect(() => {
    if (!projector) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    projectorRef.current?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProjector(false);
    };
    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", close);
    };
  }, [projector]);

  const selectCourse = (nextCourseId: string) => {
    setParams(nextCourseId ? { courseId: nextCourseId } : {});
  };
  const selectWeek = (weekNo: number) => {
    setParams({ courseId, weekNo: String(weekNo) });
  };
  const selectMission = (nextMissionId: string) => {
    setParams({ courseId, weekNo: String(week?.week_no ?? ""), missionId: nextMissionId });
  };

  return <AdminShell
    title="실시간 학급 응답"
    description="개별 판단을 익명 학급 분포로 비교하고 수업 토론으로 연결합니다."
  >
    <div className="max-w-[1120px] space-y-5">
      <section className="rounded-xl border bg-white p-4">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="text-sm font-semibold">교과목
            <select
              aria-label="응답 교과목"
              value={courseId}
              onChange={(event) => selectCourse(event.target.value)}
              className="mt-2 h-10 w-full rounded-md border bg-white px-3 font-normal"
            >
              {!courseId && <option value="">교과목 선택</option>}
              {outlines.data?.map((outline) => <option key={outline.id} value={outline.id}>{outline.title}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold">주차
            <select
              aria-label="응답 주차"
              value={week?.week_no ?? ""}
              disabled={!course}
              onChange={(event) => selectWeek(Number(event.target.value))}
              className="mt-2 h-10 w-full rounded-md border bg-white px-3 font-normal"
            >
              {!week && <option value="">주차 선택</option>}
              {course?.weeks.map((item) => <option key={item.week_no} value={item.week_no}>{item.week_no}주차 · {item.title}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold">미션
            <select
              aria-label="응답 미션"
              value={missionId}
              disabled={!week?.scenarios.length}
              onChange={(event) => selectMission(event.target.value)}
              className="mt-2 h-10 w-full rounded-md border bg-white px-3 font-normal"
            >
              {!missionId && <option value="">편성 미션 없음</option>}
              {week?.scenarios.map((item, index) => <option key={item.scenario_id} value={item.scenario_id}>
                미션 {index + 1} · {missionSituationSummary(item.situation_ko)}
              </option>)}
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button size="sm" variant={!demo ? "default" : "outline"} onClick={() => setDemo(false)}>실제 데이터</Button>
          <Button size="sm" variant={demo ? "default" : "outline"} onClick={() => setDemo(true)}>예시 데이터 보기</Button>
          {!demo && <span className="ml-1 text-xs text-muted-foreground">5초마다 자동 갱신</span>}
        </div>
      </section>

      <section className={`rounded-xl border p-4 ${demo ? "border-[#D8B84A] bg-[#FFF9E5]" : "bg-white"}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${demo ? "bg-[#FAD338] text-[#15202B]" : "bg-[#EEF1F4] text-[#344150]"}`}>
              {demo ? "DEMO · 예시 데이터" : "실제 완료 응답"}
            </span>
            <h2 className="mt-3 text-lg font-black text-[#15202B]">우리 반은 어떻게 판단했을까?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {demo
                ? "실제 학습자 수행 기록이 아닌 코드 내 고정 예시입니다."
                : selectedMission
                  ? missionSituationSummary(selectedMission.situation_ko)
                  : "교과목·주차·미션을 선택해 주세요."}
            </p>
          </div>
          <div className="flex gap-2">
            {!demo && <Button
              variant="outline"
              size="icon"
              aria-label="응답 새로고침"
              disabled={!missionId || patternQuery.isFetching}
              onClick={() => void patternQuery.refetch()}
            ><RefreshCw className="h-4 w-4" /></Button>}
            <Button variant="outline" disabled={!hasResponses} onClick={() => setProjector(true)}>
              <Maximize2 className="mr-2 h-4 w-4" />크게 보기
            </Button>
          </div>
        </div>

        {!demo && patternQuery.isPending && missionId && <p role="status" className="mt-5 text-sm">응답 분포를 불러오는 중…</p>}
        {!demo && patternQuery.isError && <p role="alert" className="mt-5 text-sm text-destructive">응답 분포를 불러오지 못했습니다.</p>}
        {!demo && !missionId && <p className="mt-5 text-sm text-muted-foreground">이 주차에 편성된 미션이 없습니다.</p>}
        {visiblePattern && <div className="mt-5"><ClassResponsePatterns patterns={[visiblePattern]} /></div>}

        {demo && <p className="mt-4 border-t border-[#E5D28A] pt-3 text-xs font-semibold text-[#6A5516]">
          DEMO · 예시 데이터 — 실제 학습자 수행 기록이 아니며 DB에 저장되지 않습니다.
        </p>}
      </section>
    </div>

    {projector && visiblePattern && <div
      ref={projectorRef}
      role="dialog"
      aria-modal="true"
      aria-label="학급 응답 크게 보기"
      tabIndex={-1}
      className="fixed inset-0 z-[110] overflow-y-auto bg-[#F8F6EE] p-6 sm:p-10"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-[#B8860B]">{demo ? "DEMO · 예시 데이터" : "익명 학급 집계"}</p>
            <h1 className="mt-1 text-3xl font-black text-[#15202B]">우리 반은 어떻게 판단했을까?</h1>
            <p className="mt-2 text-base text-muted-foreground">가장 많이 선택된 응답이 정답을 의미하지는 않습니다.</p>
          </div>
          <Button variant="outline" onClick={() => setProjector(false)}>
            <X className="mr-2 h-4 w-4" />닫기
          </Button>
        </div>
        <ClassResponsePatterns patterns={[visiblePattern]} projector />
      </div>
    </div>}
  </AdminShell>;
};

export default AdminClassResponses;
