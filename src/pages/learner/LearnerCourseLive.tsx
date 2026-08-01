import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { LearnerJourneyShell } from "@/components/learner/LearnerJourneyShell";
import { LearnerBottomNav } from "@/components/learner/LearnerBottomNav";
import { useLearnerCourse } from "@/lib/curriculum/useLearnerCourse";
import type { LearnerCourseWeek } from "@/lib/curriculum/learnerCourse";
import { MODE_LABEL, SPEECH_ACT_UI, type SpeechActUI } from "@/lib/pragma/enums";
import { getTargetFeature } from "@/lib/pragma/targetFeatures";
import { friendlyFeatureLabel } from "@/lib/mission/learnerReport";
import {
  isActWeek,
  isIntegrationWeek,
  isMilestoneWeek,
  pickCurrentWeek,
  weekProgress,
  type WeekProgress,
  type WeekState,
} from "@/lib/curriculum/learnerProgress";
import { MPJ_ITEM_COUNT } from "@/lib/curriculum/learnerWorkflow";
import { hasIntroArc } from "@/lib/mission/mockIntroArc";
import { listCompletedMissionIds } from "@/lib/mission/missionLog";

// 학습자 강좌 정본 — 관리자가 15주 편성기로 배정한 실제 시나리오를 보여주고,
// 검토 완료된 미션은 눌러서 실행(러너)까지 잇는다. 편성 → 학습자 실행 루프의 연결부다.
//
// 화면 위계: ①지금 할 일 ②9개 화행의 다양성 ③학기 전체 여정.
// 주차를 세로로 15개 나열하던 구조는 과제함처럼 읽혔고, 9개 화행을 골고루 다룬다는
// 이 강좌의 설계가 전혀 드러나지 않았다. 화행을 카드의 주인공으로 올리되 주차
// 번호는 배지로 남긴다 — 순서를 지우면 교수자 편성이 아니라 자율 선택이 된다.

const card = "rounded-xl border border-[#EAE4D2] bg-white p-4";

const STATE_BADGE: Record<WeekState, { label: string; cls: string }> = {
  done: { label: "완료", cls: "bg-[#E7F1EC] text-[#2E6F63]" },
  doing: { label: "학습 중", cls: "bg-[#FFF3C9] text-[#7A5E00]" },
  todo: { label: "예정", cls: "bg-[#F0EDE4] text-[#7C7466]" },
  empty: { label: "콘텐츠 준비 중", cls: "bg-[#F0EDE4] text-[#A29A8B]" },
  unknown: { label: "확인 필요", cls: "bg-[#F4EAEA] text-[#8A5B5B]" },
};

/** 주차의 학습자용 한 줄 목표. 미션·리포트와 같은 이름을 쓴다. */
function weekGoal(week: LearnerCourseWeek): string | null {
  const code = week.scenarios.find((s) => s.target_feature)?.target_feature;
  if (!code) return null;
  const feature = getTargetFeature(code);
  return friendlyFeatureLabel(code, feature?.learner_label ?? "");
}

const LearnerCourseLive = () => {
  const navigate = useNavigate();
  const { data: course = null, error, isPending: loading } = useLearnerCourse();
  const [openWeek, setOpenWeek] = useState<number | null>(null);

  // 실행 가능한 미션만 진행률의 분모로 삼는다(미검수·준비 중은 셀 수 없다).
  const runnableIds = useMemo(
    () =>
      course?.weeks.flatMap((w) =>
        w.scenarios.filter((s) => s.runnable).map((s) => s.scenario_id),
      ) ?? [],
    [course],
  );
  const {
    data: completedIds,
    isError: progressFailed,
    isPending: progressLoading,
  } = useQuery({
    queryKey: ["learner-course-progress", runnableIds],
    queryFn: () => listCompletedMissionIds(runnableIds),
    enabled: runnableIds.length > 0,
  });
  const completed = useMemo(() => new Set(completedIds ?? []), [completedIds]);

  // 판정 규칙은 learnerProgress 한 곳에서만 정한다 — 홈과 이 화면이 각자 계산하면
  // 서로 다른 주차를 "이번 학습"으로 가리키게 된다.
  const progressOf = (week: LearnerCourseWeek) =>
    weekProgress(week, completed, progressFailed);

  const actWeeks = (course?.weeks ?? []).filter(isActWeek);
  const integrationWeeks = (course?.weeks ?? []).filter(isIntegrationWeek);
  const milestoneWeeks = (course?.weeks ?? []).filter(isMilestoneWeek);

  const runnableTotal = runnableIds.length;
  const experienced = actWeeks.filter((w) => progressOf(w).doneCount > 0).length;
  const current = course
    ? pickCurrentWeek(course.weeks, completed, progressFailed)
    : null;

  const openDetail = openWeek === null ? null : (course?.weeks.find((w) => w.week_no === openWeek) ?? null);

  const toggle = (weekNo: number) => {
    setOpenWeek((prev) => (prev === weekNo ? null : weekNo));
    // 상세 패널은 그리드 아래에 열린다 — 카드가 아니라 패널을 시야로 가져와야
    // "눌렀는데 아무 일도 없다"로 보이지 않는다.
    window.requestAnimationFrame(() =>
      document
        .getElementById("week-detail")
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
    );
  };

  /** 「미션 시작」이 그려지는 조건과 같은 식으로 시작 지점을 정한다. */
  const startWeek = (progress: WeekProgress) => {
    const scenario = progress.nextScenario;
    if (!scenario) return;
    if (hasIntroArc(scenario.target_feature)) {
      navigate(`/learner/course/week/${progress.week.week_no}/intro`);
      return;
    }
    navigate(`/learner/practice/${scenario.scenario_id}`);
  };

  return (
    <LearnerJourneyShell headerRight={<span className="text-[12px] text-[#8899A6]">편성 강좌</span>}>
      <div className="pb-24">
        {loading ? (
          <p className="mt-6 text-[13px] text-muted-foreground">불러오는 중…</p>
        ) : error ? (
          <div className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-[13px] text-red-900">
            {error instanceof Error ? error.message : "강좌를 불러오지 못했습니다."}
          </div>
        ) : !course ? (
          <div className="mt-6 rounded-xl border border-dashed border-[#EAE4D2] bg-white px-6 py-10 text-center text-[13px] text-muted-foreground">
            아직 게시된 편성 강좌가 없습니다.
          </div>
        ) : (
          <>
            <h2 className="text-[18px] font-bold">{course.outline.title}</h2>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              진행 가능한 미션 {runnableTotal}개
            </p>

            {/* ① 지금 할 일 — 9개 카드를 먼저 던지면 고르는 화면처럼 읽힌다.
                수업 연계형이므로 현재 할 일을 맨 위에 둔다. */}
            {current && (
              <section className="mt-4 rounded-xl bg-[#15202B] px-5 py-4 text-white">
                <div className="text-[11px] font-bold text-[#FAD338]">이번 학습</div>
                <div className="mt-1 text-[16px] font-bold">
                  {current.week.week_no}주차 ·{" "}
                  {current.week.speech_act
                    ? SPEECH_ACT_UI[current.week.speech_act as SpeechActUI]
                    : current.week.title}
                </div>
                {weekGoal(current.week) && (
                  <p className="mt-0.5 text-[12.5px] text-[#B9C4CE]">{weekGoal(current.week)}</p>
                )}
                {/* 이 화면이 이미 15주 지도다 — 여기서는 미션으로 바로 보낸다.
                    카드를 펼치게 하면 상세 패널이 그리드 아래라 화면 밖에 열려,
                    "눌렀는데 아무것도 없다"가 된다. */}
                <p className="mt-2 text-[11.5px] text-[#8899A6]">
                  표현 비교 {MPJ_ITEM_COUNT}문항 → 직접 옮기기 → 피드백 → 다시 다듬기
                </p>
                <Button
                  className="mt-3 bg-[#FAD338] text-[#15202B] hover:bg-[#FCE07A]"
                  onClick={() => startWeek(current)}
                >
                  {current.week.speech_act
                    ? SPEECH_ACT_UI[current.week.speech_act as SpeechActUI]
                    : current.week.title}{" "}
                  미션 시작하기 →
                </Button>
              </section>
            )}

            {/* ② 9개 화행의 다양성 */}
            <div className="mt-6">
              <h3 className="text-[14.5px] font-bold">
                요청부터 반대·이견까지, {actWeeks.length}가지 상황을 연습합니다
              </h3>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                {progressFailed
                  ? "진행 상태 확인 필요"
                  : progressLoading && runnableTotal > 0
                    ? "진행 상태를 확인하는 중…"
                    : `경험한 화행 ${experienced}/${actWeeks.length}`}
                <span className="mx-1.5 text-[#D3CEC0]">·</span>
                {course.weeks.length}주 학습 여정
              </p>
            </div>

            <ul className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {actWeeks.map((w) => {
                const p = progressOf(w);
                const badge = STATE_BADGE[p.state];
                const open = openWeek === w.week_no;
                // 배정이 없는 주차는 눌러도 열 것이 없다 — 눌리는 것처럼 보이지 않게 한다.
                const empty = p.state === "empty";
                return (
                  <li key={w.week_no} id={`week-card-${w.week_no}`}>
                    <button
                      type="button"
                      disabled={empty}
                      onClick={() => toggle(w.week_no)}
                      className={[
                        "flex h-full w-full flex-col items-start rounded-xl border p-3.5 text-left transition-all",
                        empty
                          ? "cursor-default border-dashed border-[#E4DED0] bg-[#FAF8F2]"
                          : "bg-white hover:-translate-y-0.5",
                        empty
                          ? ""
                          : open
                            ? "border-[#15202B] shadow-sm"
                            : "border-[#EAE4D2] hover:border-[#D5CEBB]",
                      ].join(" ")}
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-muted-foreground">
                          {w.week_no}주차
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${badge.cls}`}
                        >
                          {badge.label}
                        </span>
                      </div>
                      <div className="mt-1.5 text-[17px] font-bold text-[#15202B]">
                        {SPEECH_ACT_UI[w.speech_act as SpeechActUI]}
                      </div>
                      <p className="mt-0.5 min-h-[32px] text-[12px] leading-snug text-muted-foreground">
                        {weekGoal(w) ?? "학습 초점 준비 중"}
                      </p>
                      {/* 배정이 없으면 「미션 0/0」처럼 실행 가능해 보이는 표기를 쓰지 않는다. */}
                      <div className="mt-2 text-[11.5px] font-semibold text-[#3E4C57]">
                        {empty ? " " : `미션 ${p.doneCount}/${p.assigned.length}`}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* 선택한 주차 상세 — 카드를 늘리지 않고 전체 폭 패널 하나만 연다. */}
            {openDetail && (
              <section id="week-detail" className={`mt-3 ${card}`}>
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-[13.5px] font-bold">
                    {openDetail.week_no}주차 ·{" "}
                    {openDetail.speech_act
                      ? SPEECH_ACT_UI[openDetail.speech_act as SpeechActUI]
                      : openDetail.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => setOpenWeek(null)}
                    className="ml-auto text-[11.5px] text-muted-foreground hover:text-foreground"
                  >
                    닫기
                  </button>
                </div>

                {openDetail.can_do.length > 0 && (
                  <ul className="mt-2 space-y-1 text-[12.5px] text-muted-foreground">
                    {openDetail.can_do.slice(0, 2).map((canDo) => (
                      <li key={canDo}>✓ {canDo}</li>
                    ))}
                  </ul>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {openDetail.scenarios.some((s) => hasIntroArc(s.target_feature)) && (
                    <button
                      type="button"
                      onClick={() => navigate(`/learner/course/week/${openDetail.week_no}/intro`)}
                      className="inline-flex items-center rounded-md bg-[#15202B] px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-[#22303C]"
                    >
                      먼저 배우기 →
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => navigate(`/learner/course/week/${openDetail.week_no}/note`)}
                    className="inline-flex items-center rounded-md border border-[#15202B] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#15202B] transition-colors hover:bg-[#F7F4EA]"
                  >
                    주차 학습 노트 보기 →
                  </button>
                </div>

                {openDetail.scenarios.length === 0 ? (
                  <p className="mt-3 text-[12.5px] text-muted-foreground">
                    아직 배정된 과제가 없습니다.
                  </p>
                ) : (
                  // 아직 안 한 미션을 먼저 — 완료분의 「다시 하기」가 위에 오면
                  // 지금 눌러야 할 버튼이 아래로 밀린다.
                  <ul className="mt-3 space-y-2">
                    {[...openDetail.scenarios]
                      .sort(
                        (a, b) =>
                          Number(completed.has(a.scenario_id)) -
                          Number(completed.has(b.scenario_id)),
                      )
                      .map((s) => {
                      const feat = s.target_feature ? getTargetFeature(s.target_feature) : undefined;
                      const isDone = completed.has(s.scenario_id);
                      return (
                        <li
                          key={s.scenario_id}
                          className="flex items-center gap-3 rounded-lg bg-[#FAF8F2] px-3.5 py-2.5"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-[13.5px]">{s.situation_ko}</p>
                            <p className="mt-0.5 flex flex-wrap gap-1.5 text-[11.5px] text-muted-foreground">
                              <span>
                                {s.mode === "stt_interpreting"
                                  ? MODE_LABEL.stt_interpreting
                                  : MODE_LABEL.translation}
                              </span>
                              {s.target_feature && <span>· {feat?.learner_label ?? "핵심 미지정"}</span>}
                              {isDone && <span className="font-semibold text-[#2E6F63]">· 완료</span>}
                            </p>
                          </div>
                          {s.runnable ? (
                            <Button
                              size="sm"
                              variant={isDone ? "outline" : "default"}
                              onClick={() => navigate(`/learner/practice/${s.scenario_id}`)}
                            >
                              {isDone ? "다시 하기 →" : "미션 시작 →"}
                            </Button>
                          ) : (
                            <span className="shrink-0 rounded-md bg-[#EFEBDD] px-2.5 py-1 text-[11.5px] text-[#8A8272]">
                              콘텐츠 준비 중
                            </span>
                          )}
                        </li>
                      );
                      })}
                  </ul>
                )}
              </section>
            )}

            {/* ③ 통합 수행 — 9개 화행을 잇는 교육적 결론이라 이정표로 축소하지 않는다. */}
            {integrationWeeks.length > 0 && (
              <section className="mt-6">
                <h3 className="text-[14.5px] font-bold">이제 여러 상황을 연결해 봅니다</h3>
                <ul className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  {integrationWeeks.map((w) => {
                    const p = progressOf(w);
                    return (
                      <li key={w.week_no}>
                        <button
                          type="button"
                          onClick={() => toggle(w.week_no)}
                          className={[
                            "flex h-full w-full flex-col items-start rounded-xl border bg-[#FAF8F2] p-3.5 text-left transition-all hover:-translate-y-0.5",
                            openWeek === w.week_no
                              ? "border-[#15202B]"
                              : "border-[#EAE4D2] hover:border-[#D5CEBB]",
                          ].join(" ")}
                        >
                          <span className="text-[11px] font-semibold text-muted-foreground">
                            {w.week_no}주차
                          </span>
                          <span className="mt-1 text-[14px] font-bold text-[#15202B]">
                            {w.title}
                          </span>
                          <span className="mt-1.5 text-[11.5px] text-muted-foreground">
                            {p.assigned.length === 0 ? "미션 준비 중" : `미션 ${p.doneCount}/${p.assigned.length}`}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {/* 이정표 — 오리엔테이션·중간·기말은 교강사 재량 운영이라 앱에 미션이 없다. */}
            {milestoneWeeks.length > 0 && (
              <p className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-[#EFEBDD] pt-3 text-[11.5px] text-muted-foreground">
                {milestoneWeeks.map((w, i) => (
                  <span key={w.week_no} className="inline-flex items-center gap-2">
                    {i > 0 && <span className="text-[#D3CEC0]">·</span>}
                    {w.week_no}주차 {w.title}
                  </span>
                ))}
              </p>
            )}
          </>
        )}
      </div>
      <LearnerBottomNav />
    </LearnerJourneyShell>
  );
};

export default LearnerCourseLive;
