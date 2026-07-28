import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { LearnerJourneyShell } from "@/components/learner/LearnerJourneyShell";
import {
  getPublishedCourse,
  type LearnerCourse,
  type LearnerCourseWeek,
} from "@/lib/curriculum/learnerCourse";
import { buildWeeklyLearnerNote } from "@/lib/curriculum/learnerNote";
import { resolveLearnerNoteAccess } from "@/lib/curriculum/learnerNoteAccess";
import {
  DEFAULT_DIRECTION,
  SPEECH_ACT_UI,
  type LanguageDirection,
} from "@/lib/pragma/enums";
import { getProgress } from "@/lib/mission/learnerState";
import { listCompletedMissionIds } from "@/lib/mission/missionLog";
import { MISSION_ID_BY_MODE, WEEK_REQUEST } from "@/lib/mission/mockWeek";

const noteCard =
  "break-inside-avoid rounded-xl border border-[#EAE4D2] bg-white p-5 print:rounded-none print:border-[#CFC8B8] print:p-4";

const MOCK_WEEK: LearnerCourseWeek = {
  week_no: WEEK_REQUEST.weekNo,
  title: WEEK_REQUEST.title,
  type: "regular",
  can_do: [],
  speech_act: "request",
  channel: "messenger",
  pdr_power: "equal",
  pdr_distance: "acquaintance",
  pdr_imposition: "low",
  review_released: false,
  competency_focus: WEEK_REQUEST.keyIdea,
  domain: "school",
  scenarios: [
    {
      scenario_id: "w2-note-sample",
      situation_ko: "동급생에게 메신저로 필요한 자료를 부탁한다.",
      mission_status: "reviewed",
      target_feature: "request_mitigation_optionality",
      mode: "translation",
      runnable: true,
    },
  ],
};

const MOCK_REQUIRED_MISSION_IDS = [
  MISSION_ID_BY_MODE.quick,
  MISSION_ID_BY_MODE.transfer,
];

function asDirection(value: string | null | undefined): LanguageDirection {
  return value === "zh_ko" ? "zh_ko" : DEFAULT_DIRECTION;
}

const WeeklyLearningNote = () => {
  const { weekNo: weekNoParam } = useParams();
  const weekNo = Number(weekNoParam);
  const [course, setCourse] = useState<LearnerCourse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completedMissionIds, setCompletedMissionIds] = useState<string[]>([]);
  const [completionLoading, setCompletionLoading] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const loaded = await getPublishedCourse();
        if (!cancelled) setCourse(loaded);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "강좌를 불러오지 못했습니다.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const courseWeek = Number.isInteger(weekNo)
    ? course?.weeks.find((week) => week.week_no === weekNo) ?? null
    : null;

  useEffect(() => {
    let cancelled = false;
    if (!courseWeek) {
      setCompletedMissionIds([]);
      setCompletionError(null);
      setCompletionLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const missionIds = courseWeek.scenarios.map((scenario) => scenario.scenario_id);
    if (missionIds.length === 0) {
      setCompletedMissionIds([]);
      setCompletionError(null);
      setCompletionLoading(false);
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      setCompletionLoading(true);
      setCompletionError(null);
      try {
        const completed = await listCompletedMissionIds(missionIds);
        if (!cancelled) setCompletedMissionIds(completed);
      } catch (e) {
        if (!cancelled) {
          setCompletedMissionIds([]);
          setCompletionError(
            e instanceof Error ? e.message : "수행 상태를 확인하지 못했습니다.",
          );
        }
      } finally {
        if (!cancelled) setCompletionLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [courseWeek]);

  const usingSample =
    !loading && !courseWeek && weekNo === WEEK_REQUEST.weekNo;
  const week = courseWeek ?? (usingSample ? MOCK_WEEK : null);
  const direction = asDirection(course?.outline.language_direction);
  const note = useMemo(
    () => (week ? buildWeeklyLearnerNote(week, direction) : null),
    [direction, week],
  );

  const requiredMissionIds = courseWeek
    ? courseWeek.scenarios.map((scenario) => scenario.scenario_id)
    : usingSample
      ? MOCK_REQUIRED_MISSION_IDS
      : [];
  const effectiveCompletedMissionIds = usingSample
    ? getProgress().completedMissionIds
    : completedMissionIds;
  const access = resolveLearnerNoteAccess({
    instructorReleased: week?.review_released ?? false,
    requiredMissionIds,
    completedMissionIds: effectiveCompletedMissionIds,
  });
  const returnPath = courseWeek
    ? "/learner/course-live"
    : `/learner/course/week/${WEEK_REQUEST.weekNo}`;

  return (
    <LearnerJourneyShell
      headerRight={
        <span className="text-[12px] text-[#8899A6]">
          {Number.isInteger(weekNo) ? `${weekNo}주차` : "주차"} · 학습 노트
        </span>
      }
    >
      <div className="weekly-learning-note pb-10">
        <div className="weekly-note-actions mb-4 flex items-center justify-between gap-3 print:hidden">
          <Link
            to={returnPath}
            className="text-[13px] font-medium text-muted-foreground hover:text-foreground"
          >
            ← 주차로 돌아가기
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!note}
            className="rounded-md border border-[#15202B] bg-white px-3 py-2 text-[12.5px] font-semibold text-[#15202B] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {access.unlocked ? "전체 자료 인쇄·PDF" : "예습 자료 인쇄·PDF"}
          </button>
        </div>

        {loading ? (
          <p className="py-12 text-center text-[13px] text-muted-foreground">
            학습 노트를 불러오는 중…
          </p>
        ) : !note ? (
          <section className={noteCard}>
            <h1 className="text-[18px] font-bold">학습 노트를 찾지 못했습니다.</h1>
            <p className="mt-2 text-[13px] text-muted-foreground">
              게시된 강좌의 주차인지 확인해 주세요.
            </p>
          </section>
        ) : (
          <article className="space-y-4">
            <header className="break-inside-avoid rounded-xl bg-[#FAD338] px-6 py-5 text-[#15202B] print:rounded-none">
              <div className="flex flex-wrap items-center gap-2 text-[12px] font-bold">
                <span>{note.weekNo}주차 학습 노트</span>
                <span aria-hidden>·</span>
                <span>{note.directionLabel}</span>
                {week?.speech_act && (
                  <>
                    <span aria-hidden>·</span>
                    <span>{SPEECH_ACT_UI[week.speech_act]}</span>
                  </>
                )}
              </div>
              <h1 className="mt-1 text-[22px] font-bold leading-tight">{note.title}</h1>
              <p className="mt-2 max-w-2xl text-[13px] leading-5">
                예습에서는 목표와 상황을 먼저 생각하고, 실습을 마친 뒤에는 대조 표현과
                선택 이유로 돌아옵니다. 외울 정답이 아니라 상황에 맞는 선택을 만드는
                자료입니다.
              </p>
            </header>

            <nav
              aria-label="학습 노트 공개 단계"
              className="weekly-note-actions grid grid-cols-2 gap-2 print:hidden"
            >
              <span className="rounded-lg border border-[#E6C322] bg-[#FFF7CC] px-3 py-2 text-[12px] font-semibold text-[#6B5518]">
                1 · 예습 자료 <span className="font-normal">항상 열림</span>
              </span>
              {access.unlocked ? (
                <a
                  href="#weekly-review"
                  className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-[12px] font-semibold text-emerald-800"
                >
                  2 · 복습 자료 <span className="font-normal">공개됨 ↓</span>
                </a>
              ) : (
                <span className="rounded-lg border border-[#D8D2C4] bg-[#F5F3ED] px-3 py-2 text-[12px] font-semibold text-[#777064]">
                  2 · 복습 자료 <span className="font-normal">잠김</span>
                </span>
              )}
            </nav>

            {usingSample && (
              <div className="weekly-note-actions rounded-lg border border-dashed border-[#D4CCB8] bg-[#FAF8F2] px-4 py-2.5 text-[11.5px] text-muted-foreground print:hidden">
                게시된 강좌가 없어 현재 요청 주차의 샘플 노트를 표시합니다.
              </div>
            )}
            {error && usingSample && (
              <p className="weekly-note-actions text-[11px] text-muted-foreground print:hidden">
                실제 강좌 연결 전 샘플 자료 · {error}
              </p>
            )}

            <div className="break-inside-avoid border-b border-[#D8D2C4] pb-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8A8272]">
                수업 전 · 예습 자료
              </p>
              <h2 className="mt-1 text-[18px] font-bold">먼저 상황을 생각해 봅니다</h2>
            </div>

            <section className={noteCard}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#15202B] text-[12px] font-bold text-white">
                  1
                </span>
                <h2 className="text-[17px] font-bold">이번 주에 할 수 있어야 하는 것</h2>
                <span className="rounded-full bg-[#F3EFE3] px-2 py-0.5 text-[10.5px] text-[#6F6759]">
                  {note.canDoSource === "instructor" ? "강좌 Can-do" : "기본 Can-do 가이드"}
                </span>
              </div>
              <ul className="mt-3 space-y-2">
                {note.canDos.map((canDo) => (
                  <li key={canDo} className="flex gap-2 text-[14px] leading-6">
                    <span className="mt-0.5 font-bold text-[#B8860B]">✓</span>
                    <span>{canDo}</span>
                  </li>
                ))}
              </ul>
              {note.competencyFocus && (
                <div className="mt-3 rounded-lg bg-[#FAF8F2] px-4 py-3 text-[13px] leading-5">
                  <span className="font-semibold">이번 주 초점</span>
                  <span className="ml-2">{note.competencyFocus}</span>
                </div>
              )}
            </section>

            {note.contextCues.length > 0 && (
              <section className={noteCard}>
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#15202B] text-[12px] font-bold text-white">
                    2
                  </span>
                  <h2 className="text-[17px] font-bold">상황을 읽는 기준</h2>
                </div>
                <p className="mt-2 text-[12.5px] leading-5 text-muted-foreground">
                  같은 표현도 누구에게, 어떤 부담을 주며, 어떤 방식으로 전달하는지에 따라
                  다르게 들릴 수 있습니다.
                </p>
                <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {note.contextCues.map((cue) => (
                    <div key={cue.label} className="rounded-lg border border-[#EEE8D8] px-3.5 py-2.5">
                      <dt className="text-[11px] font-semibold text-[#8A8272]">{cue.label}</dt>
                      <dd className="mt-0.5 text-[13px]">{cue.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            <section className={noteCard}>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#15202B] text-[12px] font-bold text-white">
                  3
                </span>
                <h2 className="text-[17px] font-bold">미리 생각해 보기</h2>
              </div>
              <div className="mt-3 space-y-3">
                {note.features.map((feature) => (
                  <div key={feature.code} className="rounded-lg bg-[#FAF8F2] px-4 py-3">
                    <p className="text-[12px] font-semibold text-[#7A5A00]">{feature.label}</p>
                    <p className="mt-1 text-[12.5px] leading-5">{feature.principle}</p>
                  </div>
                ))}
                <div>
                  <p className="text-[13px] font-semibold">
                    상대의 결정권·친밀도·부담이 달라진다면, 내 표현에서 무엇이 달라질지
                    한 가지 예상해 보세요.
                  </p>
                  <div className="mt-4 border-b border-dashed border-[#BDB5A4]" />
                  <div className="mt-4 border-b border-dashed border-[#BDB5A4]" />
                </div>
              </div>
            </section>

            {!access.unlocked ? (
              <section className={`${noteCard} weekly-note-review-lock print:hidden`}>
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F3EFE3] text-[17px]"
                  >
                    🔒
                  </span>
                  <div>
                    <h2 className="text-[16px] font-bold">복습 자료는 실습 뒤에 열립니다</h2>
                    <p className="mt-1 text-[12.5px] leading-5 text-muted-foreground">
                      대조 표현, 상황별 선택 이유와 예외는 필수 미션을 모두 마치거나
                      교수자가 공개한 뒤 확인할 수 있습니다.
                    </p>
                    {completionLoading ? (
                      <p className="mt-2 text-[12px] font-medium text-[#6F6759]">
                        수행 상태를 확인하는 중…
                      </p>
                    ) : access.requiredCount > 0 ? (
                      <p className="mt-2 text-[12px] font-medium text-[#6F6759]">
                        필수 미션 {access.completedCount} / {access.requiredCount} 완료
                      </p>
                    ) : (
                      <p className="mt-2 text-[12px] font-medium text-[#6F6759]">
                        현재 필수 미션이 없어 교수자 공개 후 열립니다.
                      </p>
                    )}
                    {completionError && (
                      <p className="mt-1 text-[11px] text-red-700">
                        수행 상태를 확인하지 못해 복습 자료를 잠금 상태로 유지합니다.
                      </p>
                    )}
                    <Link
                      to={returnPath}
                      className="mt-3 inline-flex rounded-md border border-[#15202B] px-3 py-1.5 text-[12px] font-semibold text-[#15202B]"
                    >
                      미션으로 돌아가기 →
                    </Link>
                  </div>
                </div>
              </section>
            ) : (
              <div id="weekly-review" className="weekly-note-review scroll-mt-24 space-y-4">
                <div className="break-inside-avoid border-b border-[#D8D2C4] pb-2">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#2E7D5B]">
                    수업 후 · 복습 자료
                  </p>
                  <h2 className="mt-1 text-[18px] font-bold">표현과 선택 이유를 비교합니다</h2>
                  <p className="mt-1 text-[11.5px] text-muted-foreground print:hidden">
                    {access.reason === "instructor_released"
                      ? "교수자가 이번 주 복습 자료를 공개했습니다."
                      : "이번 주 필수 미션을 모두 마쳐 복습 자료가 열렸습니다."}
                  </p>
                </div>

                {note.features.map((feature, index) => (
                  <section key={feature.code} className={noteCard}>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#15202B] text-[12px] font-bold text-white">
                        {index + 4}
                      </span>
                      <div>
                        <p className="text-[10.5px] font-semibold text-[#8A8272]">표현 선택의 핵심</p>
                        <h2 className="text-[17px] font-bold">{feature.label}</h2>
                      </div>
                    </div>

                    <p className="mt-3 text-[13px] leading-6">{feature.definition}</p>

                    <div className="mt-4">
                      <h3 className="text-[13px] font-bold">활용할 수 있는 표현 자원</h3>
                      <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {feature.resources.map((resource) => (
                          <li
                            key={resource}
                            className="rounded-lg bg-[#F7F4EA] px-3 py-2 text-[12.5px] leading-5"
                          >
                            {resource}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-4">
                      <h3 className="text-[13px] font-bold">비교해 볼 세 가지 인상</h3>
                      <ol className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                        {feature.comparisonLabels.map((label, comparisonIndex) => (
                          <li
                            key={label}
                            className="rounded-lg border border-[#EAE4D2] px-3 py-2 text-[12px] leading-5"
                          >
                            <span className="mr-1.5 font-bold text-[#8A8272]">
                              {comparisonIndex + 1}
                            </span>
                            {label}
                          </li>
                        ))}
                      </ol>
                    </div>

                    {feature.distinguishFrom.length > 0 && (
                      <details className="mt-4 rounded-lg border border-[#EAE4D2] px-3.5 py-3">
                        <summary className="cursor-pointer text-[12.5px] font-semibold">
                          이 초점과 헷갈리지 않기
                        </summary>
                        <ul className="mt-2 space-y-1 text-[11.5px] leading-5 text-muted-foreground">
                          {feature.distinguishFrom.map((item) => (
                            <li key={item}>· {item}</li>
                          ))}
                        </ul>
                      </details>
                    )}

                    <div className="mt-4 rounded-lg border border-[#F0D45B] bg-[#FFF8DE] px-4 py-3">
                      <p className="text-[12px] font-bold text-[#7A5A00]">원리와 예외</p>
                      <p className="mt-1 text-[12.5px] leading-5">{feature.principle}</p>
                      <p className="mt-2 border-t border-[#E9D27A] pt-2 text-[11.5px] leading-5 text-[#6F5D1A]">
                        {feature.counterRule}
                      </p>
                    </div>
                  </section>
                ))}

                <section className={noteCard}>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#15202B] text-[12px] font-bold text-white">
                      {note.features.length + 4}
                    </span>
                    <h2 className="text-[17px] font-bold">내 표현 정리</h2>
                  </div>
                  <p className="mt-2 text-[12.5px] text-muted-foreground">
                    정답을 베끼기보다 내가 바꾼 선택과 그 이유를 한 줄로 남겨 보세요.
                  </p>
                  <div className="mt-4 space-y-4 text-[12.5px]">
                    {[
                      "처음 떠올린 표현",
                      "다듬은 표현과 바꾼 이유",
                      "상대나 부담이 달라진다면",
                    ].map((prompt) => (
                      <div key={prompt}>
                        <div className="font-semibold">{prompt}</div>
                        <div className="mt-3 border-b border-dashed border-[#BDB5A4]" />
                        <div className="mt-4 border-b border-dashed border-[#BDB5A4]" />
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}

            <footer className="px-1 pt-1 text-[10.5px] leading-4 text-muted-foreground">
              이 노트는 강좌의 Can-do와 검토된 PRAGMA 화용 초점 카탈로그에서
              결정론적으로 구성됩니다. 특정 표현 하나를 유일한 정답으로 제시하지 않습니다.
              {note.features.length > 0 && (
                <span>
                  {" "}자료 버전 {note.features.map((feature) => `${feature.code}@${feature.version}`).join(", ")}
                </span>
              )}
            </footer>
          </article>
        )}
      </div>
    </LearnerJourneyShell>
  );
};

export default WeeklyLearningNote;
