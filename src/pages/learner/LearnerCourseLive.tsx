import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { LearnerJourneyShell } from "@/components/learner/LearnerJourneyShell";
import { LearnerBottomNav } from "@/components/learner/LearnerBottomNav";
import { useLearnerCourse } from "@/lib/curriculum/useLearnerCourse";
import type { LearnerCourseWeek } from "@/lib/curriculum/learnerCourse";
import { ROLE_LABEL, weekRole } from "@/lib/curriculum/template";
import { SPEECH_ACT_UI, type SpeechActUI } from "@/lib/pragma/enums";
import { getTargetFeature } from "@/lib/pragma/targetFeatures";
import { friendlyFeatureLabel } from "@/lib/mission/learnerReport";
import {
  isActWeek,
  isIntegrationWeek,
  isMilestoneWeek,
  pickCurrentWeek,
  weekProgress,
  type WeekState,
} from "@/lib/curriculum/learnerProgress";
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

  const progressOf = (week: LearnerCourseWeek) =>
    weekProgress(week, completed, progressFailed);
  const actWeeks = (course?.weeks ?? []).filter(isActWeek);
  const foundationWeeks = actWeeks.filter((week) => weekRole(week.week_no) === "foundation");
  const relationshipWeeks = actWeeks.filter((week) => weekRole(week.week_no) !== "foundation");
  const integrationWeeks = (course?.weeks ?? []).filter(isIntegrationWeek);
  const milestoneWeeks = (course?.weeks ?? []).filter(isMilestoneWeek);
  const learningWeekCount = actWeeks.length + integrationWeeks.length;
  const experienced = actWeeks.filter((week) => progressOf(week).doneCount > 0).length;
  const current = course
    ? pickCurrentWeek(course.weeks, completed, progressFailed)
    : null;
  const coursePath = courseId ? `/learner/course/${courseId}` : "/learner/course";

  const openWeek = (weekNo: number) => navigate(`${coursePath}/week/${weekNo}`);

  const renderActGrid = (weeks: LearnerCourseWeek[]) => (
    <ul className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
      {weeks.map((week) => {
        const progress = progressOf(week);
        const badge = STATE_BADGE[progress.state];
        return (
          <li key={week.week_no}>
            <button
              type="button"
              onClick={() => openWeek(week.week_no)}
              className="flex h-full w-full flex-col items-start rounded-xl border border-[#EAE4D2] bg-white p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-[#D5CEBB]"
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-muted-foreground">
                  {week.week_no}주차
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${badge.cls}`}>
                  {badge.label}
                </span>
              </div>
              <div className="mt-1.5 text-[17px] font-bold text-[#15202B]">
                {SPEECH_ACT_UI[week.speech_act as SpeechActUI]}
              </div>
              <p className="mt-0.5 min-h-[32px] text-[12px] leading-snug text-muted-foreground">
                {weekGoal(week) ?? "학습 목표를 확인하세요"}
              </p>
              <div className="mt-2 text-[11.5px] font-semibold text-[#3E4C57]">
                {progress.assigned.length === 0
                  ? "콘텐츠 준비 중"
                  : `A·B 미션 ${progress.doneCount}/${progress.assigned.length}`}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );

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
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              15주 강좌 · 실제 학습 {learningWeekCount}주 · {actWeeks.length}개 화행
            </p>

            {current && (
              <section className="mt-4 rounded-xl bg-[#15202B] px-5 py-4 text-white">
                <div className="text-[11px] font-bold text-[#FAD338]">이번 학습</div>
                <div className="mt-1 text-[17px] font-bold">
                  {current.week.week_no}주차 ·{" "}
                  {current.week.speech_act
                    ? SPEECH_ACT_UI[current.week.speech_act as SpeechActUI]
                    : current.week.title}
                </div>
                {weekGoal(current.week) && (
                  <p className="mt-0.5 text-[12.5px] text-[#B9C4CE]">{weekGoal(current.week)}</p>
                )}
                <p className="mt-2 text-[11.5px] text-[#8899A6]">
                  {current.doneCount > 0
                    ? `A·B 미션 ${current.doneCount}/${current.assigned.length} 완료 · 이어서 학습합니다`
                    : "이번 주 A·B 미션과 학습 노트를 확인합니다"}
                </p>
                <Button
                  className="mt-3 bg-[#FAD338] text-[#15202B] hover:bg-[#FCE07A]"
                  onClick={() => openWeek(current.week.week_no)}
                >
                  {current.doneCount > 0 ? "이번 주 이어하기 →" : "이번 주 학습 열기 →"}
                </Button>
              </section>
            )}

            <div className="mt-6 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-[15px] font-black">학기 학습 여정</h2>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  9개 화행 + 3개 누적·통합 활동
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

            {foundationWeeks.length > 0 && (
              <section className="mt-5">
                <p className="text-[12px] font-bold text-[#B8860B]">1단계 · 기초 적용</p>
                {renderActGrid(foundationWeeks)}
              </section>
            )}

            {relationshipWeeks.length > 0 && (
              <section className="mt-6">
                <p className="text-[12px] font-bold text-[#B8860B]">2단계 · 관계 조정</p>
                {renderActGrid(relationshipWeeks)}
              </section>
            )}

            {integrationWeeks.length > 0 && (
              <section className="mt-6">
                <p className="text-[12px] font-bold text-[#B8860B]">3단계 · 누적 검토와 통합 수행</p>
                <ul className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  {integrationWeeks.map((week) => {
                    const progress = progressOf(week);
                    return (
                      <li key={week.week_no}>
                        <button
                          type="button"
                          onClick={() => openWeek(week.week_no)}
                          className="flex h-full w-full flex-col items-start rounded-xl border border-[#EAE4D2] bg-[#FAF8F2] p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-[#D5CEBB]"
                        >
                          <span className="text-[11px] font-semibold text-muted-foreground">
                            {week.week_no}주차 · {ROLE_LABEL[weekRole(week.week_no)]}
                          </span>
                          <span className="mt-1 text-[14px] font-bold text-[#15202B]">{week.title}</span>
                          <span className="mt-1.5 text-[11.5px] text-muted-foreground">
                            {progress.assigned.length === 0
                              ? "누적 기록으로 수업에서 진행"
                              : `학습 활동 ${progress.doneCount}/${progress.assigned.length}`}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {milestoneWeeks.length > 0 && (
              <section className="mt-6 border-t border-[#EFEBDD] pt-4">
                <p className="text-[12px] font-bold text-[#B8860B]">학기 이정표</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {milestoneWeeks.map((week) => (
                    <span key={week.week_no} className="rounded-full bg-[#F0EDE4] px-3 py-1 text-[11.5px] text-muted-foreground">
                      {week.week_no}주차 · {week.title}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
      <LearnerBottomNav />
    </LearnerJourneyShell>
  );
};

export default LearnerCourseLive;
