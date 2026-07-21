import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LearnerJourneyShell } from "@/components/learner/LearnerJourneyShell";
import { LearnerBottomNav } from "@/components/learner/LearnerBottomNav";
import { PROFILE_SUMMARY, type LearnerMode, TODAY_MISSION } from "@/lib/mission/mockLearnerHome";
import { getTodayAssignment, getWeekProgress, WEEK_REQUEST } from "@/lib/mission/mockWeek";
import { hasPracticeSession } from "@/lib/mission/practiceSession";

// 학습자 홈 — 메뉴판이 아니라 '다음 행동'을 알려주는 화면.
// 오늘의 학습 카드 1개가 가장 크고, 배정 이유 한 줄을 함께 보여준다.

const LearnerHome = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<LearnerMode>("self");

  // 완료/세션 상태는 localStorage 기반이라 렌더 시점 계산으로 충분 (mock)
  const today = useMemo(() => getTodayAssignment(), []);
  const week = useMemo(() => getWeekProgress(), []);
  // ⚠️ 시연용 임시 동작 (2026-07-21) — 원래는 CTA가 바로 미션으로 들어간다.
  // 처음 보는 사람이 설명(도입 아크) 없이 연습부터 만나면 워크플로우의 절반만 보게 되어,
  // 시연 동안은 도입 아크로 보낸다.
  //
  // 원복 방법 — 아래 startToday를 되돌리고, 버튼 라벨을
  // {resuming ? "이어하기 →" : "오늘의 학습 시작하기 →"} 로 복원한다:
  //   const resuming = useMemo(
  //     () => !today.allDone && hasPracticeSession(today.missionId, today.mode),
  //     [today],
  //   );
  //   const q = today.mode === "transfer" ? "?mode=transfer" : "";
  //   navigate(`/scenario${q}`);
  const startToday = () => {
    navigate(`/learner/course/week/${WEEK_REQUEST.weekNo}/intro`);
  };

  return (
    <LearnerJourneyShell
      headerRight={
        <div className="flex gap-0.5 rounded-[9px] bg-white/[0.08] p-[3px]">
          {(["self", "class"] as LearnerMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={[
                "rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                mode === m
                  ? "bg-[#FAD338] font-semibold text-[#15202B]"
                  : "text-[#8899A6] hover:text-[#F1EFE8]",
              ].join(" ")}
            >
              {m === "self" ? "자율" : "수업연계"}
            </button>
          ))}
        </div>
      }
    >
      <div className="pb-20">
        {/* 오늘의 학습 — 홈의 유일한 주 행동 */}
        <section className="rounded-xl bg-[#15202B] px-5 py-5 text-white">
          <div className="text-[11.5px] font-bold text-[#FAD338]">
            {mode === "class" ? TODAY_MISSION.classCopy.kicker : "오늘의 학습"}
          </div>
          <h2 className="mt-1.5 text-[19px] font-bold leading-snug">{today.title}</h2>
          {!today.allDone && (
            <p className="mt-1 text-[13px] text-[#B9C4CE]">
              {WEEK_REQUEST.weekNo}주차 · {WEEK_REQUEST.speechAct} · 약 {today.minutes}분
            </p>
          )}
          {!today.allDone && (
            <div className="mt-3 inline-flex items-baseline gap-2 rounded-lg bg-white/[0.08] px-3 py-2">
              <span className="text-[11px] font-medium text-[#8899A6]">현재 위치</span>
              <span className="text-[13.5px] font-semibold text-white">
                {today.mode === "transfer" ? "상황 바꿔보기" : "직접 연습"}
              </span>
              <span className="text-[12px] text-[#B9C4CE]">
                {week.done} / {week.total}
              </span>
            </div>
          )}
          <p className="mt-2 text-[12.5px] text-[#8899A6]">└ {today.reason}</p>
          {!today.allDone && (
            <>
              {/* 미션이 어떻게 흘러가는지 눌러보기 전에 보이게 한다 —
                  버튼을 누르지 않으면 핵심 워크플로우를 발견하지 못하는 문제. */}
              <div className="mt-4 flex flex-wrap items-center gap-x-1.5 gap-y-1">
                {["상황 읽기", "직접 해보기", "차이 발견", "한 곳 고치기", "마무리"].map(
                  (step, i) => (
                    <span key={step} className="flex items-center gap-1.5">
                      {i > 0 && <span className="text-[11px] text-[#5C6A7A]">→</span>}
                      <span className="rounded-md bg-white/10 px-2 py-1 text-[11.5px] font-medium text-[#D7DEE5]">
                        {step}
                      </span>
                    </span>
                  ),
                )}
              </div>
              <Button
                className="mt-4 bg-[#FAD338] text-[#15202B] hover:bg-[#F6C200]"
                onClick={startToday}
              >
                학습 시작하기 →
              </Button>
            </>
          )}
        </section>

        {/* 이번 주 요약 → WeekDetail */}
        <button
          type="button"
          onClick={() => navigate(`/learner/course/week/${WEEK_REQUEST.weekNo}`)}
          className="mt-4 flex w-full items-center justify-between rounded-[10px] border border-[#EAE4D2] bg-white px-4 py-3.5 text-left hover:bg-[#FAFAF7]"
        >
          <div>
            <div className="text-[11.5px] font-semibold text-muted-foreground">
              이번 주 · {WEEK_REQUEST.weekNo}주차 {WEEK_REQUEST.title}
            </div>
            <div className="mt-1 text-[14.5px]">
              진행률 {week.done} / {week.total} · {WEEK_REQUEST.keyIdea}
            </div>
          </div>
          <span aria-hidden className="shrink-0 text-muted-foreground">→</span>
        </button>

        {/* 내 프로파일 요약 (mock) */}
        <section className="mt-2.5 rounded-[10px] border border-[#EAE4D2] bg-white px-4 py-3.5">
          <div className="text-[11.5px] font-semibold text-muted-foreground">{PROFILE_SUMMARY.label}</div>
          <div className="mt-1 text-[14.5px]">{PROFILE_SUMMARY.body}</div>
        </section>

        {/* 전략 지도 — 개방 후에는 홈에서도 바로 갈 수 있게 한다. */}
        <Link
          to="/learner/strategy"
          className="mt-2.5 flex items-center justify-between rounded-[10px] border border-[#EAE4D2] bg-white px-4 py-3.5 hover:bg-[#FFFDF4]"
        >
          <div>
            <div className="text-[11.5px] font-semibold text-muted-foreground">전략 지도</div>
            <div className="mt-1 text-[14.5px]">요청에 쓸 수 있는 전략들 보기</div>
          </div>
          <span aria-hidden className="shrink-0 text-[#8899A6]">
            →
          </span>
        </Link>

        {/* 자유 연습 — MVP에서는 준비 중 타일로만 */}
        <section className="mt-2.5 flex items-center justify-between rounded-[10px] border border-[#EAE4D2] bg-white px-4 py-3.5">
          <div>
            <div className="text-[11.5px] font-semibold text-muted-foreground">자유 연습</div>
            <div className="mt-1 text-[14.5px]">원하는 화행·상황을 골라 연습하기</div>
          </div>
          <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
            준비 중
          </span>
        </section>
      </div>
      <LearnerBottomNav />
    </LearnerJourneyShell>
  );
};

export default LearnerHome;
