import { useQuery } from "@tanstack/react-query";
import { LearnerJourneyShell } from "@/components/learner/LearnerJourneyShell";
import { LearnerBottomNav } from "@/components/learner/LearnerBottomNav";
import { Button } from "@/components/ui/button";
import { listMyMissionLogs, type MyMissionLogEntry } from "@/lib/mission/missionLog";
import { LEVEL, MODE_LABEL, SPEECH_ACT_UI } from "@/lib/pragma/enums";

// 학습 기록 — 학습자가 자신이 쓴 최초안·최종안을 되돌아보는 화면.
//
// 점수·등급·AI 판정은 싣지 않는다(계약상 점수 표현 금지). 여기서 보는 것은
// "무엇을 썼고 어떻게 바꿨나"뿐이고, 수정 여부는 별도 플래그가 아니라
// first_response != revised_response로 판별한다(MissionRunV1의 `revised || draft` 폴백).
//
// 통계·리포트는 여전히 미구현이다 — 증거량 3등급 원칙상 데이터가 쌓인 뒤에만 의미가 있다.

const UPCOMING = [
  { label: "주간 리포트", desc: "일주일의 연습을 한 줄 진단과 다음 행동으로 정리해요." },
  { label: "언어 지문", desc: "자주 기대는 표현·전략 습관을 보여줘요." },
  { label: "상황·소통 행동별 성장", desc: "상황에 따른 요청·거절 등 소통 행동의 감각 변화를 추적해요." },
];

const label = (map: Record<string, string>, key: string | null) =>
  key ? map[key] ?? key : null;

const formatDay = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : `${d.getMonth() + 1}월 ${d.getDate()}일`;
};

const RecordCard = ({ entry }: { entry: MyMissionLogEntry }) => {
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

      <div className="mt-3 space-y-2.5">
        <div>
          <div className="text-[11.5px] font-semibold text-muted-foreground">처음 쓴 표현</div>
          <p className="mt-0.5 text-[14px] leading-relaxed">{entry.firstResponse ?? "—"}</p>
        </div>
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11.5px] font-semibold text-muted-foreground">다듬은 표현</span>
            <span className="text-[11px] text-muted-foreground">
              {entry.revised ? "✎ 수정함" : "수정 없이 완료"}
            </span>
          </div>
          <p className="mt-0.5 text-[14px] leading-relaxed">{entry.revisedResponse ?? "—"}</p>
        </div>
      </div>
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
          </section>
        ) : (
          <>
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              지금까지 {total}회
              {revisedCount > 0 && ` · 그중 ${revisedCount}회는 표현을 다듬었습니다`}
            </p>
            <ul className="mt-4 space-y-2.5">
              {entries.map((entry) => (
                <RecordCard key={entry.id} entry={entry} />
              ))}
            </ul>
          </>
        )}

        <div className="mt-6 text-[12px] font-semibold text-muted-foreground">곧 열리는 기록</div>
        <ul className="mt-2 space-y-2">
          {UPCOMING.map((u) => (
            <li
              key={u.label}
              className="flex items-center justify-between gap-2 rounded-[10px] border border-[#EAE4D2] bg-white px-4 py-3.5 opacity-70"
            >
              <div>
                <div className="text-[13.5px] font-medium">{u.label}</div>
                <div className="mt-0.5 text-[12px] text-muted-foreground">{u.desc}</div>
              </div>
              <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
                준비 중
              </span>
            </li>
          ))}
        </ul>
      </div>
      <LearnerBottomNav />
    </LearnerJourneyShell>
  );
};

export default LearnerRecords;
