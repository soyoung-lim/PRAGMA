import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { LearnerJourneyShell } from "@/components/learner/LearnerJourneyShell";
import { LearnerBottomNav } from "@/components/learner/LearnerBottomNav";
import { DiffLine } from "@/components/mission/DiffLine";
import { Button } from "@/components/ui/button";
import { IS_DEV, useProfile } from "@/lib/auth/useProfile";
import { buildLearnerReport, josa } from "@/lib/mission/learnerReport";
import { LEARNER_REPORT_PREVIEW_ENTRIES } from "@/lib/mission/learnerReportPreview";
import { listMyMissionLogs } from "@/lib/mission/missionLog";
import { diffText } from "@/lib/mission/textDiff";

const joinCounts = (items: Array<{ label: string; count: number }>) =>
  items.map((item) => `${item.label} ${item.count}`).join(" · ");

const LearnerRecords = () => {
  const { isDevStub } = useProfile();
  const {
    data: storedEntries = [],
    error,
    isPending: loading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["learner-mission-logs"],
    queryFn: () => listMyMissionLogs(),
  });

  // 인증 없는 localhost 스텁이면서 실제 로그가 없을 때만 예시 데이터를 쓴다.
  // import.meta.env.DEV가 production build에서 false로 접히므로 라이브에 노출되지 않는다.
  const usingPreview = IS_DEV && isDevStub && storedEntries.length === 0;
  const entries = usingPreview ? LEARNER_REPORT_PREVIEW_ENTRIES : storedEntries;
  const report = useMemo(() => buildLearnerReport(entries), [entries]);
  const primary = report.primaryCohort;
  const dominant = primary?.dominantNonWithin ?? null;
  const hasReportablePattern = Boolean(
    primary &&
      primary.bandObservationCount >= 3 &&
      dominant &&
      dominant.count >= 2,
  );

  // 비동기 기록 조회 뒤에 섹션이 생겨도 완료 화면의 해시 링크가 정확히 착지한다.
  useEffect(() => {
    if (loading || report.correctionNotes.length === 0) return;
    if (window.location.hash !== "#correction-notes") return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById("correction-notes")?.scrollIntoView({ block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loading, report.correctionNotes.length]);

  return (
    <LearnerJourneyShell
      wide
      headerRight={
        <span className="text-[12px] text-[#8899A6]">학습 리포트</span>
      }
    >
      <div className="pb-20">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[#E7E2D5] pb-3">
          <div>
            <p className="text-[11.5px] font-semibold text-[#8A7450]">
              1–15주 누적 프로파일
            </p>
            <h1 className="mt-0.5 text-[22px] font-bold tracking-[-0.02em] text-[#17212B]">
              나의 누적 학습 기록
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {usingPreview && (
              <span className="rounded-full bg-[#EAF2FF] px-2.5 py-1 text-[10.5px] font-semibold text-[#3767A5]">
                예시 데이터
              </span>
            )}
            {entries.length > 0 && (
              <span className="rounded-full bg-[#F2F0EA] px-2.5 py-1 text-[11px] font-semibold text-[#59636D]">
                누적 {report.attemptCount}회
              </span>
            )}
          </div>
        </header>

        {loading ? (
          <p className="mt-5 text-[13px] text-muted-foreground">불러오는 중…</p>
        ) : error ? (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-900">
            <p>
              {error instanceof Error
                ? error.message
                : "학습 기록을 불러오지 못했습니다."}
            </p>
            <Button
              size="sm"
              variant="outline"
              disabled={isFetching}
              onClick={() => void refetch()}
            >
              다시 불러오기
            </Button>
          </div>
        ) : entries.length === 0 ? (
          <section className="mt-5 rounded-2xl border border-[#EAE4D2] bg-white p-7 text-center">
            <div className="text-[28px]" aria-hidden>◷</div>
            <p className="mt-2 text-[15px] font-semibold">아직 돌아볼 수행이 없어요</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
              첫 미션을 마치면 이곳에 표현과 수정 과정이 쌓이기 시작해요.
            </p>
            <Button asChild size="sm" className="mt-3.5">
              <Link to="/learner/course">수업으로 가기 →</Link>
            </Button>
          </section>
        ) : (
          <>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-[#E4E0D7] bg-white px-3.5 py-2 text-[12px] text-[#34404B] shadow-[0_3px_12px_rgba(23,33,43,0.035)]">
              <span>
                <span className="mr-1.5 text-muted-foreground">화행</span>
                <strong>{joinCounts(report.speechActs) || "기록 없음"}</strong>
              </span>
              <span className="h-3.5 w-px bg-[#DDD8CC]" aria-hidden />
              <span>
                <span className="mr-1.5 text-muted-foreground">방식</span>
                <strong>{joinCounts(report.taskTypes) || "기록 없음"}</strong>
              </span>
              {primary && (
                <>
                  <span className="h-3.5 w-px bg-[#DDD8CC]" aria-hidden />
                  <span>
                    <span className="mr-1.5 text-muted-foreground">분석 기준</span>
                    <strong>같은 초점 · {primary.taskTypeLabel} 최초 산출</strong>
                  </span>
                </>
              )}
            </div>

            <section
              className="mt-2 rounded-2xl border border-[#E4E0D7] bg-white px-4 py-3.5 shadow-[0_4px_14px_rgba(23,33,43,0.04)]"
              aria-labelledby="learner-profile-headline"
            >
              <div className="border-l-4 border-[#73C58C] pl-4">
                <span className="inline-flex rounded-full bg-[#EAF2FF] px-2.5 py-1 text-[10.5px] font-semibold text-[#2E74B5]">
                  누적 기록에서 발견한 패턴
                </span>
                <h2
                  id="learner-profile-headline"
                  className="mt-2 max-w-4xl text-[23px] font-bold leading-[1.32] tracking-[-0.025em] text-[#17212B] sm:text-[26px]"
                >
                  {report.headline}
                </h2>
                {primary && (
                  <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                    {primary.speechActLabel} · {primary.featureLabel} · {primary.taskTypeLabel} 최초 산출 {primary.attemptCount}회
                  </p>
                )}
              </div>

              <div
                aria-label="프로파일 근거"
                className="mt-3 grid gap-0 border-t border-[#E5E1D7] pt-2.5 md:grid-cols-3"
              >
                {hasReportablePattern && primary && dominant && (
                  <div className="min-w-0 px-3 first:pl-0 md:border-r md:border-[#E5E1D7]">
                  <p className="flex items-baseline gap-2 text-[14px] leading-snug text-[#27323C]">
                    <strong className="shrink-0 text-[19px] font-bold text-[#17212B]">
                      {dominant.count}/{primary.bandObservationCount}회
                    </strong>
                    <span>
                      {primary.featureKey === "request_mitigation_optionality"
                        ? "조금 단정적으로 부탁했어요"
                        : `‘${dominant.label}’${josa(dominant.label, "로")} 안내됐어요`}
                    </span>
                  </p>
                  <p className="mt-1 text-[10.5px] text-muted-foreground">
                    같은 조건의 최초 표현 기준
                  </p>
                  </div>
                )}
                {primary?.recentExpression && (
                  <div className="min-w-0 px-3 md:border-r md:border-[#E5E1D7]">
                  <p className="flex items-baseline gap-2 text-[14px] leading-snug text-[#27323C]">
                    <strong className="shrink-0 text-[19px] font-bold text-[#17212B]">
                      {primary.recentExpression.count}/{primary.recentExpression.total}회
                    </strong>
                    <span>
                      최근에는 {primary.recentExpression.learnerCopy} 표현을 써봤어요
                    </span>
                  </p>
                  <p className="mt-1 text-[10.5px] text-muted-foreground">
                    최근 같은 조건의 최초 표현 기준
                  </p>
                  </div>
                )}
                <div className="min-w-0 px-3">
                <p className="flex items-baseline gap-2 text-[14px] leading-snug text-[#27323C]">
                  <strong className="shrink-0 text-[19px] font-bold text-[#17212B]">
                    {report.revisedCount}/{report.attemptCount}회
                  </strong>
                  <span>피드백을 보고 문장을 고쳤어요</span>
                </p>
                <p className="mt-1 text-[10.5px] text-muted-foreground">
                  최초 표현과 다른 최종 표현을 남김
                </p>
                </div>
              </div>
            </section>

            <section className="mt-2 grid gap-3 lg:grid-cols-12">
              <article className="rounded-2xl border border-[#E4E0D7] bg-white p-3.5 shadow-[0_4px_14px_rgba(23,33,43,0.04)] lg:col-span-8">
                {hasReportablePattern && primary ? (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="text-[13.5px] font-bold text-[#27323C]">
                          {primary.speechActLabel} 산출 패턴
                        </h3>
                        <p className="mt-0.5 text-[10.5px] text-muted-foreground">
                          {primary.featureLabel} · {primary.taskTypeLabel} 최초 산출 {primary.bandObservationCount}회
                        </p>
                      </div>
                      <span className="rounded-full bg-[#EAF2FF] px-2.5 py-1 text-[10px] font-semibold text-[#2E74B5]">
                        수행별 AI 피드백 판정
                      </span>
                    </div>
                    <div
                      className="mt-3 flex h-9 overflow-hidden rounded-lg bg-[#E6E8EA]"
                      role="img"
                      aria-label={primary.bands
                        .map((band) => `${band.label} ${band.count}회`)
                        .join(", ")}
                    >
                      {primary.bands
                        .filter((band) => band.count > 0)
                        .map((band) => (
                          <div
                            key={band.code}
                            className={`grid place-items-center text-[12px] font-semibold text-[#17212B] ${
                              band.position === "within"
                                ? "bg-[#E3B18D]"
                                : band.position === "low"
                                  ? "bg-[#91B8DD]"
                                  : "bg-[#D8C69A]"
                            }`}
                            style={{ flex: band.count }}
                          >
                            {band.count}
                          </div>
                        ))}
                    </div>
                    <div className="mt-2 flex flex-wrap justify-between gap-x-3 gap-y-1 text-[10.5px] text-muted-foreground">
                      {primary.bands.map((band) => (
                        <span key={band.code}>{band.label} {band.count}</span>
                      ))}
                    </div>
                    {dominant && (
                      <p className="mt-3 border-t border-[#DFE1E2] pt-2.5 text-[12.5px] leading-relaxed text-[#35414B]">
                        이 기록에서는 {dominant.label}
                        {josa(dominant.label, "로")} 안내된 표현이 {dominant.count}회 반복됐어요.
                      </p>
                    )}
                  </>
                ) : (
                  <div className="flex min-h-28 items-center">
                    <div>
                      <h3 className="text-[13.5px] font-bold text-[#27323C]">
                        같은 조건의 기록을 더 모으고 있어요
                      </h3>
                      <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
                        같은 학습 목표와 수행 방식(번역·통역)에서 AI 피드백 판정이 3회 이상 쌓이면 분포를 보여드려요.
                      </p>
                    </div>
                  </div>
                )}
              </article>

              <article className="flex flex-col justify-between rounded-2xl border border-[#E4E0D7] bg-white p-3.5 shadow-[0_4px_14px_rgba(23,33,43,0.04)] lg:col-span-4">
                <div className="border-l-4 border-[#73C58C] pl-3">
                  <span className="inline-flex rounded-full bg-[#EAF2FF] px-2.5 py-1 text-[10.5px] font-semibold text-[#2E74B5]">
                    다음 미션에서 해볼 일
                  </span>
                  <p className="mt-2.5 text-[14px] font-bold leading-relaxed text-[#27323C]">
                    {report.nextStep}
                  </p>
                  {primary?.featureKey === "request_mitigation_optionality" && (
                    <p className="mt-1.5 text-[10.5px] text-muted-foreground">
                      예: 如果方便的话… / 能不能…
                    </p>
                  )}
                </div>
                <Button asChild size="sm" className="mt-4 w-full bg-[#17212B] text-white hover:bg-[#293743]">
                  <Link to="/learner/course">
                    다음 미션에서 시도하기
                    <ArrowRight size={14} className="ml-1.5" aria-hidden />
                  </Link>
                </Button>
              </article>
            </section>

            {report.correctionNotes.length > 0 && (
              <section
                id="correction-notes"
                className="mt-2 rounded-2xl border border-[#E4E0D7] bg-white p-3 shadow-[0_4px_14px_rgba(23,33,43,0.04)]"
                aria-labelledby="correction-notes-heading"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 id="correction-notes-heading" className="text-[14px] font-bold text-[#27323C]">
                      나의 수정 노트
                    </h3>
                    <p className="mt-0.5 text-[10.5px] text-muted-foreground">
                      피드백을 보고 고쳐 쓴 문장을 한곳에 모았어요.
                    </p>
                  </div>
                  <span className="rounded-full bg-[#F2F0EA] px-2.5 py-1 text-[10.5px] font-semibold text-[#59636D]">
                    고쳐 쓴 문장 {report.correctionNotes.length}개
                  </span>
                </div>

                <div className="mt-2.5 max-h-[116px] overflow-y-auto pr-1 sm:max-h-[132px]">
                  <div className="grid gap-x-4 lg:grid-cols-2">
                    {report.correctionNotes.map((note) => {
                      const parts = diffText(
                        note.entry.firstResponse ?? "",
                        note.entry.revisedResponse ?? note.entry.firstResponse ?? "",
                      );
                      return (
                        <article
                          key={note.entry.id}
                          className="grid min-w-0 grid-cols-[76px_minmax(0,1fr)] gap-2 border-t border-[#ECE8DE] py-2"
                        >
                          <div className="min-w-0">
                            <span className="inline-flex rounded-md bg-[#EAF2FF] px-1.5 py-0.5 text-[9.5px] font-semibold text-[#2E74B5]">
                              {note.speechActLabel}
                            </span>
                            <p className="mt-1 line-clamp-2 text-[9.5px] leading-[1.35] text-[#6B747D]">
                              {note.reasonLabel}
                            </p>
                          </div>
                          <div className="min-w-0">
                            <div className="grid grid-cols-[34px_minmax(0,1fr)] items-baseline gap-1.5">
                              <span className="text-[9.5px] font-semibold text-[#7B848C]">처음</span>
                              <DiffLine
                                parts={parts}
                                view="first"
                                className="!mt-0 line-clamp-1 text-[12.5px] leading-5 text-[#4E5963]"
                              />
                            </div>
                            <div className="mt-0.5 grid grid-cols-[34px_minmax(0,1fr)] items-baseline gap-1.5">
                              <span className="text-[9.5px] font-semibold text-[#7B848C]">수정</span>
                              <DiffLine
                                parts={parts}
                                view="final"
                                className="!mt-0 line-clamp-1 text-[12.5px] leading-5 text-[#202A33]"
                                emphasizeChanges
                              />
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
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

export default LearnerRecords;
