import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { LearnerBottomNav } from "@/components/learner/LearnerBottomNav";
import { LearnerJourneyShell } from "@/components/learner/LearnerJourneyShell";
import { cornerPreview, LOUNGE_CORNERS } from "@/lib/lounge/mockLounge";

// 라운지 홈 — 잠깐 들어와 한 장면 즐기고 나가는 곳. 히어로를 낮게 깔고 세 코너를
// 가로로 나란히 두어, 데스크톱에서 스크롤 없이 전부 보이게 한다.

const LoungeHome = () => {
  return (
    <LearnerJourneyShell
      headerRight={<span className="text-[12px] font-semibold text-[#FAD338]">쉬어가기</span>}
    >
      <main className="pb-24">
        <section className="overflow-hidden rounded-2xl bg-[#15202B] px-5 py-4 text-white">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold text-[#FAD338]">PRAGMA LOUNGE</div>
              <h1 className="mt-0.5 text-[21px]">☕ 잠깐, 라운지 갈래?</h1>
              <p className="mt-1 text-[12.5px] leading-relaxed text-[#C7D0D8]">
                공부 같지 않은 중국어를 가볍게 만나는 곳.
              </p>
            </div>
            <span className="rounded-full bg-white/10 px-3 py-1 text-[11.5px] text-[#DCE3E8]">
              점수 없이 즐기기 · 학습 기록에 남지 않아요
            </span>
          </div>
        </section>

        <section className="mt-4 grid gap-3 sm:grid-cols-3">
          {LOUNGE_CORNERS.map((corner) => (
            <Link
              key={corner.id}
              to={`/learner/lounge/${corner.id}`}
              className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-[#E4DED0] bg-white p-5 shadow-[0_3px_12px_rgba(21,32,43,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(21,32,43,0.09)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15202B]"
            >
              <div
                aria-hidden
                className="absolute inset-x-0 top-0 h-1.5"
                style={{ backgroundColor: corner.accent }}
              />
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FAF8F2] text-[23px]">
                {corner.emoji}
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <h2 className="text-[16px]">{corner.title}</h2>
                <span className="rounded-full bg-[#FAD338] px-2 py-0.5 text-[10px] font-extrabold text-[#15202B]">
                  {corner.badge}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] font-bold" style={{ color: corner.accent }}>
                {corner.eyebrow}
              </p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
                {corner.description}
              </p>

              {/* 첫 장면 맛보기 — 메뉴 셋이 아니라 "장면이 기다리는 곳"으로 보이게 한다. */}
              {(() => {
                const preview = cornerPreview(corner.id);
                return (
                  <div className="mt-3 rounded-xl bg-[#FAF8F2] px-3.5 py-3">
                    <div className="text-[10.5px] font-bold" style={{ color: corner.accent }}>
                      {preview.context}
                    </div>
                    <p className="mt-1 line-clamp-2 text-[13.5px] font-semibold leading-snug text-[#27323C]">
                      {preview.line}
                    </p>
                  </div>
                );
              })()}

              <span className="mt-auto inline-flex items-center gap-1 pt-3 text-[12px] font-semibold text-[#3E4C57]">
                들어가기
                <ArrowRight
                  aria-hidden
                  className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                />
              </span>
            </Link>
          ))}
        </section>
      </main>
      <LearnerBottomNav />
    </LearnerJourneyShell>
  );
};

export default LoungeHome;
