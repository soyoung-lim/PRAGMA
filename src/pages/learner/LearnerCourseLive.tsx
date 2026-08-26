import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { LearnerJourneyShell } from "@/components/learner/LearnerJourneyShell";
import { LearnerBottomNav } from "@/components/learner/LearnerBottomNav";
import { useLearnerCourse } from "@/lib/curriculum/useLearnerCourse";
import type { LearnerCourseWeek } from "@/lib/curriculum/learnerCourse";
import { ROLE_LABEL, weekRole } from "@/lib/curriculum/template";
import { SPEECH_ACT_UI, type SpeechActUI } from "@/lib/pragma/enums";
import { getTargetFeature } from "@/lib/pragma/targetFeatures";
import { friendlyFeatureLabel } from "@/lib/mission/learnerReport";
import { isActWeek, weekProgress, type WeekState } from "@/lib/curriculum/learnerProgress";
import { listCompletedMissionIds } from "@/lib/mission/missionLog";

const STATE_BADGE: Record<WeekState, { label: string; cls: string }> = {
  done: { label: "완료", cls: "bg-[#E7F1EC] text-[#2E6F63]" },
  doing: { label: "학습 중", cls: "bg-[#FFF3C9] text-[#7A5E00]" },
  todo: { label: "예정", cls: "bg-[#F0EDE4] text-[#7C7466]" },
  empty: { label: "준비 중", cls: "bg-[#F0EDE4] text-[#A29A8B]" },
  unknown: { label: "확인 필요", cls: "bg-[#F4EAEA] text-[#8A5B5B]" },
};

function weekGoal(week: LearnerCourseWeek): string | null {
  const code = week.scenarios.find((scenario) => scenario.target_feature)?.target_feature;
  if (!code) return week.can_do[0] ?? null;
  const feature = getTargetFeature(code);
  return friendlyFeatureLabel(code, feature?.learner_label ?? "");
}

function weekDescription(week: LearnerCourseWeek): string {
  const role = weekRole(week.week_no);
  if (week.week_no === 1) return "강좌 흐름을 확인하고 출발점 수행을 점검합니다.";
  if (week.week_no === 8) return "전반부 화행 판단과 산출을 통합해 점검합니다.";
  if (week.week_no === 15) return "학기 전체 화용 판단과 통번역 수행을 종합해 점검합니다.";
  if (role === "metapragmatic") {
    return week.week_no === 7
      ? "완료한 A·B 미션의 표현 선택과 수정 근거를 함께 검토합니다."
      : "학기 전체 판단·산출·수정 기록을 종합해 통번역 의사결정을 정리합니다.";
  }
  if (role === "contextualization") {
    return "서로 다른 두 화행을 관계와 선택권의 부담이 큰 새 맥락에서 수행합니다.";
  }
  return weekGoal(week) ?? "이번 주 학습 목표를 확인합니다.";
}

const LearnerCourseLive = () => {
  const navigate = useNavigate();
  const { courseId } = useParams<{ courseId: string }>();
  const { data: course = null, error, isPending: loading } = useLearnerCourse(courseId);

  const runnableIds = useMemo(
    () =>
      course?.weeks.flatMap((week) =>
        week.scenarios.filter((scenario) => scenario.runnable).map((scenario) => scenario.scenario_id),
      ) ?? [],
    [course],
  );
  const {
    data: completedIds,
    isError: progressFailed,
    isPending: progressLoading,
  } = useQuery({
    queryKey: ["learner-course-progress", courseId, runnableIds],
    queryFn: () => listCompletedMissionIds(runnableIds),
    enabled: runnableIds.length > 0,
  });
  const completed = useMemo(() => new Set(completedIds ?? []), [completedIds]);
  const weeks = useMemo(
    () => [...(course?.weeks ?? [])].sort((left, right) => left.week_no - right.week_no),
    [course],
  );
  const actWeeks = weeks.filter(isActWeek);
  const experienced = actWeeks.filter((week) => weekProgress(week, completed, progressFailed).doneCount > 0).length;
  const coursePath = courseId ? `/learner/course/${courseId}` : "/learner/course";

  const openWeek = (weekNo: number) => navigate(`${coursePath}/week/${weekNo}`);

  return (
    <LearnerJourneyShell
      headerRight={<span className="text-[12px] text-[#8899A6]">15주 학습계획</span>}
    >
      <div className="pb-24">
        {loading ? (
          <p className="mt-6 text-[13px] text-muted-foreground">강좌를 불러오는 중…</p>
        ) : error ? (
          <div className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-[13px] text-red-900">
            {error instanceof Error ? error.message : "강좌를 불러오지 못했습니다."}
          </div>
        ) : !course || !courseId ? (
          <div className="mt-6 rounded-xl border border-dashed border-[#EAE4D2] bg-white px-6 py-10 text-center text-[13px] text-muted-foreground">
            선택한 교과목을 찾을 수 없습니다.
            <Link to="/learner/course" className="mt-3 block font-bold text-[#15202B]">
              내 교과목으로 돌아가기
            </Link>
          </div>
        ) : (
          <>
            <Link to="/learner/course" className="text-[12.5px] font-medium text-muted-foreground hover:text-foreground">
              ← 내 교과목
            </Link>
            <h1 className="mt-3 text-[21px] font-black text-[#15202B]">{course.outline.title}</h1>
            <p className="mt-1 text-[12.5px] text-muted-foreground">15주 강좌 · 실제 학습 12주</p>

            <div className="mt-6 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-[16px] font-black text-[#15202B]">주차별 학습계획</h2>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  화행 학습 9주 · 메타화용 2주 · 고부담 실전 1주
                </p>
              </div>
              <p className="text-[12px] text-muted-foreground">
                {progressFailed
                  ? "진행 상태 확인 필요"
                  : progressLoading && runnableIds.length > 0
                    ? "진행 상태 확인 중…"
                    : `경험한 화행 ${experienced}/${actWeeks.length} · 미션 ${completed.size}/${runnableIds.length}`}
              </p>
            </div>

            <ol className="mt-4 overflow-hidden rounded-xl border border-[#EAE4D2] bg-white">
              {weeks.map((week) => {
                const role = weekRole(week.week_no);
                const progress = weekProgress(week, completed, progressFailed);
                const speechActLabel = week.speech_act
                  ? SPEECH_ACT_UI[week.speech_act as SpeechActUI]
                  : null;
                const isCourseMilestone = week.week_no === 1 || week.week_no === 8 || week.week_no === 15;
                const badge = progress.assigned.length > 0
                  ? STATE_BADGE[progress.state]
                  : role === "metapragmatic"
                    ? { label: "수업 활동", cls: "bg-[#EEF0F4] text-[#5A6470]" }
                    : role === "contextualization"
                      ? { label: "편성 준비 중", cls: "bg-[#FFF3C9] text-[#7A5E00]" }
                      : { label: "학기 일정", cls: "bg-[#F0EDE4] text-[#7C7466]" };

                return (
                  <li key={week.week_no} className="border-b border-[#EFEBDD] last:border-b-0">
                    <button
                      type="button"
                      onClick={() => openWeek(week.week_no)}
                      className="grid w-full grid-cols-[54px_minmax(0,1fr)] gap-3 px-4 py-4 text-left transition-colors hover:bg-[#FAF8F2] sm:grid-cols-[66px_minmax(0,1fr)_auto] sm:items-center sm:px-5"
                    >
                      <div className="text-center">
                        <span className="block text-[19px] font-black text-[#15202B]">{week.week_no}</span>
                        <span className="block text-[10.5px] font-semibold text-muted-foreground">주차</span>
                      </div>
                      <div className="min-w-0 border-l border-[#EFEBDD] pl-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10.5px] font-bold uppercase tracking-wide text-[#B8860B]">
                            {isCourseMilestone ? "학기 이정표" : week.speech_act ? "화행 학습" : ROLE_LABEL[role]}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold sm:hidden ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </div>
                        <div className="mt-1 text-[15px] font-bold text-[#15202B]">
                          {speechActLabel ?? week.title}
                        </div>
                        <p className="mt-0.5 text-[12px] leading-5 text-muted-foreground">
                          {weekDescription(week)}
                        </p>
                        {progress.assigned.length > 0 && (
                          <p className="mt-1 text-[11.5px] font-semibold text-[#3E4C57]">
                            A·B 미션 {progress.doneCount}/{progress.assigned.length}
                          </p>
                        )}
                      </div>
                      <span className={`hidden rounded-full px-2.5 py-1 text-[10.5px] font-bold sm:inline-flex ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </div>
      <LearnerBottomNav />
    </LearnerJourneyShell>
  );
};

export default LearnerCourseLive;
