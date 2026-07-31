import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { LearnerJourneyShell } from "@/components/learner/LearnerJourneyShell";
import { LearnerBottomNav } from "@/components/learner/LearnerBottomNav";
import { DiffLegend, DiffLine } from "@/components/mission/DiffLine";
import { Button } from "@/components/ui/button";
import { listMyMissionLogs, type MyMissionLogEntry } from "@/lib/mission/missionLog";
import { diffText } from "@/lib/mission/textDiff";
import { LEVEL, MODE_LABEL, SPEECH_ACT_UI } from "@/lib/pragma/enums";
import { getTargetFeature } from "@/lib/pragma/targetFeatures";

// 학습 기록 — 학습자가 자신이 쓴 최초안·최종안과 무엇을 바꿨는지 되돌아보는 화면.
//
// 표현 경계(중요): 완료 횟수만으로 능력 향상을 말할 수 없다. "익혔어요"·"역량이 올랐어요"
// 같은 문구를 쓰지 않고, 다룬 초점과 바꾼 부분이라는 사실만 적는다. 점수·등급·배지·
// 연속 학습일도 두지 않는다(게임화 축은 2026-07 라운지 설계에서 기각).
//
// revision_target_selected는 "그 능력을 얻었다"는 증거가 아니라 이번 수정에서 시스템이
// 지정한 수정 지점이다. 그래서 태그 문구도 성취가 아니라 "이번 수정 초점"이다.

const SCOPE_LABEL: Record<string, string> = {
  meaning: "의미 복원",
  grammar: "문법 정확성",
};

const label = (map: Record<string, string>, key: string | null) =>
  key ? map[key] ?? key : null;

const formatDay = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${d.getMonth() + 1}월 ${d.getDate()}일`;
};

/** 이번 수정에서 무엇을 조정했는지. feature면 카탈로그의 학습자 라벨을 쓴다. */
function revisionFocusOf(entry: MyMissionLogEntry): string | null {
  if (entry.revisionScope === "feature") {
    return entry.featureId ? getTargetFeature(entry.featureId)?.learner_label ?? null : null;
  }
  return SCOPE_LABEL[entry.revisionScope ?? ""] ?? null;
}

const RecordCard = ({ entry }: { entry: MyMissionLogEntry }) => {
  const first = entry.firstResponse ?? "";
  const final = entry.revisedResponse ?? "";
  const parts = useMemo(() => diffText(first, final), [first, final]);
  const focus = revisionFocusOf(entry);

  const meta = [
    formatDay(entry.createdAtIso),
    label(SPEECH_ACT_UI as Record<string, string>, entry.speechAct),
    label(LEVEL as Record<string, string>, entry.level),
    entry.taskType === "interpreting" ? MODE_LABEL.stt_interpreting : MODE_LABEL.translation,
  ].filter(Boolean);

  return (
    <li className="rounded-xl border border-[#EAE4D2] bg-white p-4">
      <div className="text-[12px] text-muted-foreground">{meta.join("  ·  ")}</div>

      {entry.sourceText && (
        <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
          <span className="mr-1.5 font-medium text-[#5B5446]">원문</span>
          {entry.sourceText}
        </p>
      )}

      {entry.revised ? (
        <>
          {focus && (
            <div className="mt-3 inline-flex rounded-full bg-[#FFF8DE] px-2.5 py-1 text-[11.5px] text-[#6B5518]">
              이번 수정 초점 · {focus}
            </div>
          )}
          <div className="mt-2 space-y-2">
            <div className="rounded-lg bg-[#F5F5F2] px-3.5 py-2.5">
              <div className="text-[11.5px] font-semibold text-muted-foreground">최초</div>
              <DiffLine parts={parts} view="first" />
            </div>
            <div className="rounded-lg border border-[#FAD338] bg-[#FFF8DE] px-3.5 py-2.5">
              <div className="text-[11.5px] font-semibold text-[#6B5518]">최종</div>
              <DiffLine parts={parts} view="final" />
            </div>
          </div>
          <DiffLegend />
        </>
      ) : (
        <div className="mt-3 rounded-lg bg-[#F5F5F2] px-3.5 py-2.5">
          <div className="text-[11.5px] font-semibold text-muted-foreground">
            첫 시도의 표현을 그대로 유지했어요
            {entry.revisionSource === "learner_free" && " · AI 제안 없이 완료"}
          </div>
          <p className="mt-0.5 whitespace-pre-wrap break-words text-[14px] leading-relaxed">
            {first || "—"}
          </p>
        </div>
      )}
    </li>
  );
};

const LearnerRecords = () => {
  const {
    data: entries = [],
    error,
    isPending: loading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["learner-mission-logs"],
    queryFn: () => listMyMissionLogs(),
  });

  const total = entries.length;
  const revisedCount = entries.filter((e) => e.revised).length;
  // 최근에 다룬 초점 — 완료한 미션에서 실제로 배정된 것만 모은다(추정 없음).
  const recentFocus = [
    ...new Set(
      entries
        .slice(0, 5)
        .map((e) => (e.featureId ? getTargetFeature(e.featureId)?.learner_label : null))
        .filter((v): v is string => Boolean(v)),
    ),
  ].slice(0, 3);

  return (
    <LearnerJourneyShell
      headerRight={<span className="text-[12px] text-[#8899A6]">학습 기록</span>}
    >
      <div className="pb-20">
        <h2 className="text-[18px] font-bold">학습 기록</h2>

        {loading ? (
          <p className="mt-4 text-[13px] text-muted-foreground">불러오는 중…</p>
        ) : error ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-red-50 px-4 py-3 text-[13px] text-red-900">
            <p>{error instanceof Error ? error.message : "학습 기록을 불러오지 못했습니다."}</p>
            <Button size="sm" variant="outline" disabled={isFetching} onClick={() => void refetch()}>
              다시 불러오기
            </Button>
          </div>
        ) : total === 0 ? (
          <section className="mt-4 rounded-xl border border-[#EAE4D2] bg-white p-5 text-center">
            <div className="text-[28px]" aria-hidden>◷</div>
            <p className="mt-2 text-[15px] font-semibold">아직 기록이 없어요</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
              첫 미션을 마치면 이곳에 기록이 쌓이기 시작해요.
            </p>
            <Button asChild size="sm" className="mt-3.5">
              <Link to="/learner/course">수업으로 가기 →</Link>
            </Button>
          </section>
        ) : (
          <>
            <section className="mt-3 rounded-xl border border-[#EAE4D2] bg-white p-4">
              <p className="text-[15px] font-semibold">
                최근 {total}회의 수행이 남아 있어요
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                {revisedCount > 0
                  ? `그중 ${revisedCount}회는 피드백을 받고 표현을 다시 다듬었어요.`
                  : "아직 다시 다듬은 수행은 없어요."}
              </p>
              {recentFocus.length > 0 && (
                <p className="mt-1.5 text-[13px] text-muted-foreground">
                  다룬 초점 · {recentFocus.join(" · ")}
                </p>
              )}
              <Button asChild size="sm" className="mt-3">
                <Link to="/learner/course">다음 수업으로 →</Link>
              </Button>
            </section>

            <ul className="mt-4 space-y-2.5">
              {entries.map((entry) => (
                <RecordCard key={entry.id} entry={entry} />
              ))}
            </ul>
          </>
        )}
      </div>
      <LearnerBottomNav />
    </LearnerJourneyShell>
  );
};

export default LearnerRecords;
