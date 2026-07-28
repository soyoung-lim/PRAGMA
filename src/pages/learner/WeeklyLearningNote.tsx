import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { LearnerJourneyShell } from "@/components/learner/LearnerJourneyShell";
import {
  getPublishedCourse,
  type LearnerCourse,
  type LearnerCourseWeek,
} from "@/lib/curriculum/learnerCourse";
import { buildWeeklyLearnerNote } from "@/lib/curriculum/learnerNote";
import {
  DEFAULT_DIRECTION,
  SPEECH_ACT_UI,
  type LanguageDirection,
} from "@/lib/pragma/enums";
import { WEEK_REQUEST } from "@/lib/mission/mockWeek";

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

function asDirection(value: string | null | undefined): LanguageDirection {
  return value === "zh_ko" ? "zh_ko" : DEFAULT_DIRECTION;
}

const WeeklyLearningNote = () => {
  const { weekNo: weekNoParam } = useParams();
  const weekNo = Number(weekNoParam);
  const [course, setCourse] = useState<LearnerCourse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  const usingSample = !courseWeek && weekNo === WEEK_REQUEST.weekNo;
  const week = courseWeek ?? (usingSample ? MOCK_WEEK : null);
  const direction = asDirection(course?.outline.language_direction);
  const note = useMemo(
    () => (week ? buildWeeklyLearnerNote(week, direction) : null),
    [direction, week],
  );

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
            to={courseWeek ? "/learner/course-live" : `/learner/course/week/${WEEK_REQUEST.weekNo}`}
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
            인쇄·PDF 저장
          </button>
        </div>

        {loading && !note ? (
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
                미션 전에는 목표와 상황을 살펴보고, 미션 후에는 표현 비교와 예외 원리로
                돌아오세요. 외울 정답이 아니라 상황에 맞는 선택을 만드는 자료입니다.
              </p>
            </header>

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

            {note.features.map((feature, index) => (
              <section key={feature.code} className={noteCard}>
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#15202B] text-[12px] font-bold text-white">
                    {index + 3}
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
                  <p className="text-[12px] font-bold text-[#7A5A00]">기억할 한 문장</p>
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
                  {note.features.length + 3}
                </span>
                <h2 className="text-[17px] font-bold">내 표현 정리</h2>
              </div>
              <p className="mt-2 text-[12.5px] text-muted-foreground">
                미션을 마친 뒤, 정답을 베끼기보다 내가 바꾼 선택과 그 이유를 한 줄로 남겨 보세요.
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
