import { useMemo } from "react";
import { Link } from "react-router-dom";
import { LearnerJourneyShell } from "@/components/learner/LearnerJourneyShell";
import { getFeatureState } from "@/lib/mission/learnerState";
import { INTRO_FEATURE_ID } from "@/lib/mission/mockIntroArc";
import {
  REQUEST_STRATEGIES,
  STRATEGY_MAP_CLOSING,
  STRATEGY_MAP_GATE,
} from "@/lib/mission/mockStrategyMap";

// 전략 지도 — 도입 아크가 "🔓 열렸어요"라고 알리는 그 화면.
// 잠긴 상태에서는 전략을 보여주지 않는다(선산출 LOCK): 무엇을 하면 열리는지만 안내한다.
const StrategyMap = () => {
  const unlocked = useMemo(
    () => getFeatureState(INTRO_FEATURE_ID).strategyMapUnlocked,
    [],
  );

  return (
    <LearnerJourneyShell
      headerRight={<span className="text-[12px] text-[#8899A6]">요청 · 전략 지도</span>}
    >
      <div className="pb-20">
        <h2 className="text-[18px] font-bold">요청 — 이럴 때 쓸 수 있는 전략들</h2>
        <p className="mt-1.5 text-[13.5px] text-muted-foreground">
          정답표가 아니라 <strong>범위</strong>입니다. 상황에 따라 어울리는 전략이 달라집니다.
        </p>

        {!unlocked ? (
          <section className="mt-4 rounded-xl border border-[#EAE4D2] bg-white p-5 text-center">
            <div className="text-[26px]" aria-hidden>
              🔒
            </div>
            <p className="mt-2 text-[15px] font-semibold">아직 열리지 않았어요</p>
            <p className="mx-auto mt-1.5 max-w-[34ch] text-[13px] leading-relaxed text-muted-foreground">
              {STRATEGY_MAP_GATE}
            </p>
            <Link
              to="/learner/course/week/2/intro"
              className="mt-4 inline-flex items-center rounded-md bg-[#15202B] px-4 py-2 text-[13.5px] font-semibold text-white"
            >
              먼저 배우러 가기 →
            </Link>
          </section>
        ) : (
          <>
            <div className="mt-3 rounded-lg border border-[#FAD338] bg-[#FFFBEA] px-3.5 py-2.5 text-[12.5px] font-semibold text-[#6B5518]">
              🔓 한 번 직접 해봤기 때문에 열렸습니다.
            </div>

            <ul className="mt-3 space-y-2">
              {REQUEST_STRATEGIES.map((s) => (
                <li key={s.name} className="rounded-xl border border-[#EAE4D2] bg-white px-4 py-3">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <b className="text-[14px] font-bold">{s.name}</b>
                    <span className="text-[14px] text-muted-foreground">{s.zh}</span>
                  </div>
                  <div className="mt-1 text-[12.5px] text-muted-foreground">{s.when}</div>
                </li>
              ))}
            </ul>

            <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
              {STRATEGY_MAP_CLOSING}
            </p>

            <Link
              to="/learner/practice"
              className="mt-4 inline-flex items-center rounded-md bg-[#FAD338] px-4 py-2 text-[13.5px] font-semibold text-[#15202B]"
            >
              미션에서 써보기 →
            </Link>
          </>
        )}
      </div>
    </LearnerJourneyShell>
  );
};

export default StrategyMap;
