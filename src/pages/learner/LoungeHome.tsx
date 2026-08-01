import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { LearnerBottomNav } from "@/components/learner/LearnerBottomNav";
import { LearnerJourneyShell } from "@/components/learner/LearnerJourneyShell";
import { LOUNGE_CORNERS, type LoungeCornerId } from "@/lib/lounge/mockLounge";

// 라운지 홈 — 세 코너 중 하나를 3초 안에 고르는 화면.
//
// 부제·긴 설명·관계 배지·예문 미리보기를 카드에 다 넣었더니, 정보는 많은데 한눈에
// 안 들어오고 문장이 두세 줄로 갈라졌다. 카드는 네 층만 둔다: 아이콘 · 제목+배지 ·
// 한 문장 · 들어가기. 관계·채널과 실제 예문은 코너에 들어간 뒤에 보여 준다.

const CARD_LINE: Record<LoungeCornerId, string> = {
  theater: "짧은 장면으로 만나는 교과서 밖 중국어",
  meme: "같은 밈을 서로 다른 한국어로 옮겨보기",
  decoder: "숫자와 온라인 말투의 숨은 뜻 풀어보기",
};

const LoungeHome = () => {
  return (
    <LearnerJourneyShell
      headerRight={<span className="text-[12px] font-semibold text-[#FAD338]">쉬어가기</span>}
    >
      {/* 헤더와 하단 내비 사이에서 수직 가운데 — 위로 몰리면 아래가 '덜 만든 화면'처럼 보인다. */}
      <main className="flex min-h-[calc(100vh-156px)] flex-col justify-center pb-6">
        <section className="overflow-hidden rounded-2xl bg-[#15202B] px-5 py-4 text-white">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold text-[#FAD338]">PRAGMA LOUNGE</div>
              <h1 className="mt-0.5 text-[21px]">☕ 잠깐, 라운지 갈래?</h1>
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
              className="group relative flex h-full min-h-[248px] flex-col overflow-hidden rounded-2xl border border-[#E4DED0] bg-white px-5 pb-5 pt-7 shadow-[0_3px_12px_rgba(21,32,43,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(21,32,43,0.09)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15202B]"
            >
              <div
                aria-hidden
                className="absolute inset-x-0 top-0 h-1.5"
                style={{ backgroundColor: corner.accent }}
              />
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FAF8F2] text-[30px]">
                {corner.emoji}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <h2 className="text-[17px]">{corner.title}</h2>
                <span className="rounded-full bg-[#FAD338] px-2 py-0.5 text-[10px] font-extrabold text-[#15202B]">
                  {corner.badge}
                </span>
              </div>
              <p className="mt-2 break-keep text-[13px] leading-relaxed text-muted-foreground">
                {CARD_LINE[corner.id]}
              </p>

              <span className="mt-auto inline-flex items-center gap-1 pt-4 text-[12.5px] font-semibold text-[#3E4C57]">
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
