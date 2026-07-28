import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { LearnerBottomNav } from "@/components/learner/LearnerBottomNav";
import { LearnerJourneyShell } from "@/components/learner/LearnerJourneyShell";
import { LOUNGE_CORNERS } from "@/lib/lounge/mockLounge";

const LoungeHome = () => {
  return (
    <LearnerJourneyShell
      headerRight={<span className="text-[12px] font-semibold text-[#FAD338]">쉬어가기</span>}
    >
      <main className="pb-24">
        <section className="overflow-hidden rounded-2xl bg-[#15202B] px-5 py-6 text-white">
          <div className="text-[11.5px] font-bold text-[#FAD338]">PRAGMA LOUNGE</div>
          <h1 className="mt-1.5 text-[25px]">☕ 잠깐, 라운지 갈래?</h1>
          <p className="mt-2 max-w-lg text-[13.5px] leading-relaxed text-[#C7D0D8]">
            공부 같지 않은 중국어를 가볍게 만나는 곳. 점수도, 감점도 없습니다.
          </p>
          <div className="mt-4 inline-flex rounded-full bg-white/10 px-3 py-1 text-[11.5px] text-[#DCE3E8]">
            이번 주 추천 · 가볍게 한 장면
          </div>
        </section>

        <div className="mt-3 rounded-xl border border-dashed border-[#D8D0BC] bg-[#FFFDF4] px-4 py-3 text-[12px] leading-relaxed text-[#6B5518]">
          쉬어가기 목업 콘텐츠입니다. 미션과 무관하며 활동은 연구·학습 기록에 남지 않습니다.
        </div>

        <section className="mt-5 grid gap-3">
          {LOUNGE_CORNERS.map((corner) => (
            <Link
              key={corner.id}
              to={`/learner/lounge/${corner.id}`}
              className="group relative overflow-hidden rounded-2xl border border-[#E4DED0] bg-white p-5 shadow-[0_3px_12px_rgba(21,32,43,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(21,32,43,0.09)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15202B]"
            >
              <div
                aria-hidden
                className="absolute inset-y-0 left-0 w-1.5"
                style={{ backgroundColor: corner.accent }}
              />
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FAF8F2] text-[25px]">
                  {corner.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[17px]">{corner.title}</h2>
                    <span className="rounded-full bg-[#FAD338] px-2 py-0.5 text-[10px] font-extrabold text-[#15202B]">
                      {corner.badge}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11.5px] font-bold" style={{ color: corner.accent }}>
                    {corner.eyebrow}
                  </p>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                    {corner.description}
                  </p>
                </div>
                <ArrowRight
                  aria-hidden
                  className="mt-3 h-4 w-4 shrink-0 text-[#8899A6] transition-transform group-hover:translate-x-1"
                />
              </div>
            </Link>
          ))}
        </section>
      </main>
      <LearnerBottomNav />
    </LearnerJourneyShell>
  );
};

export default LoungeHome;
