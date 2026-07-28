import { useMemo } from "react";
import { LearnerJourneyShell } from "@/components/learner/LearnerJourneyShell";
import { LearnerBottomNav } from "@/components/learner/LearnerBottomNav";
import { getProgress } from "@/lib/mission/learnerState";

// 나의 기록 — 기록 부족 상태를 설명하는 최소 화면.
// 실제 통계·리포트는 미구현 (증거량 3등급 원칙상 데이터가 쌓인 뒤에만 의미가 있다).

const UPCOMING = [
  { label: "주간 리포트", desc: "일주일의 연습을 한 줄 진단과 다음 행동으로 정리해요." },
  { label: "언어 지문", desc: "자주 기대는 표현·전략 습관을 보여줘요." },
  { label: "상황·소통 행동별 성장", desc: "상황에 따른 요청·거절 등 소통 행동의 감각 변화를 추적해요." },
];

const LearnerRecords = () => {
  const progress = useMemo(() => getProgress(), []);
  const n = progress.practiceCount;

  return (
    <LearnerJourneyShell
      headerRight={<span className="text-[12px] text-[#8899A6]">나의 기록</span>}
    >
      <div className="pb-20">
        <h2 className="text-[18px] font-bold">나의 기록</h2>

        <section className="mt-4 rounded-xl border border-[#EAE4D2] bg-white p-5 text-center">
          <div className="text-[28px]" aria-hidden>◷</div>
          <p className="mt-2 text-[15px] font-semibold">
            {n === 0 ? "아직 기록이 없어요" : `지금까지 연습 ${n}회`}
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
            {n === 0
              ? "첫 미션을 마치면 이곳에 기록이 쌓이기 시작해요."
              : "기록이 더 쌓이면 경향을 보여드릴 수 있어요. 한 번의 수행으로는 단정하지 않아요."}
          </p>
        </section>

        <div className="mt-4 text-[12px] font-semibold text-muted-foreground">곧 열리는 기록</div>
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
