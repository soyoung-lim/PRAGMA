import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ensureSession } from "@/lib/tracking";
import { enterDemoMode } from "@/lib/demo";

const STEPS = [
  { n: 1, title: "상황 판단", sub: "요청·거절 상황 판단" },
  { n: 2, title: "번역안 비교", sub: "번역안 3종 비교·선택" },
  { n: 3, title: "피드백 확인", sub: "멀티 페르소나 피드백 검토" },
  { n: 4, title: "최종 작성", sub: "최종 번역안 직접 작성" },
  { n: 5, title: "의사결정 리포트", sub: "의사결정 흐름 요약" },
];

const Landing = () => {
  const navigate = useNavigate();
  useEffect(() => {
    ensureSession();
  }, []);
  const handleDemo = () => {
    enterDemoMode();
    navigate("/scenario");
  };
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="bg-[#15202B]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="flex items-center gap-2 text-base font-medium text-[#F1EFE8] sm:text-lg">
            <span aria-hidden className="inline-block h-4 w-[2px] rounded-full bg-[#FAD338]" />
            AI 리터러시 기반 한·중 통번역 학습 워크플로우
          </span>
          <Link
            to="/scenario"
            className="hidden rounded-md border border-[#5C6A7A] bg-transparent px-3 py-1.5 text-sm font-medium text-[#F1EFE8] transition-colors hover:bg-white/5 sm:inline-block"
          >
            바로 시작 →
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-6 py-16 sm:py-24">
        {/* HERO */}
        <section className="text-center">
          <span className="mb-3 inline-flex items-center rounded-full bg-[#E4EDE2] px-4 py-1.5 text-[13px] font-medium text-[#3F5D3A]">
            AI 리터러시 기반
          </span>
          <h1 className="text-4xl font-bold leading-[1.15] sm:text-5xl lg:text-[44px] lg:whitespace-nowrap">
            한·중 통번역 학습 워크플로우
          </h1>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-[17px]">
            AI 번역 결과를 판단하고 최종안을 정당화합니다.
          </p>
        </section>

        {/* WORKFLOW DIAGRAM */}
        <section className="mt-12 w-full sm:mt-14">
          <div className="flex flex-col items-stretch gap-3 sm:grid sm:grid-cols-2 sm:gap-3 lg:flex lg:flex-row lg:items-stretch lg:justify-between lg:gap-0">
            {STEPS.map((s, idx) => (
              <div key={s.n} className="flex items-center lg:flex-1">
                <div className="relative w-full rounded-2xl border-[1.5px] border-[#15202B] bg-card px-4 pt-7 pb-5 text-center shadow-sm">
                  <span
                    className="absolute -top-3 left-1/2 inline-flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full text-xs font-bold text-white ring-2 ring-card"
                    style={{ backgroundColor: "#15202B" }}
                  >
                    {s.n}
                  </span>
                  <div className="text-[15px] font-bold leading-snug sm:text-[16px]">
                    {s.title}
                  </div>
                  <div className="mt-2 text-[12px] leading-snug text-muted-foreground">
                    {s.sub}
                  </div>
                </div>
                {idx < STEPS.length - 1 && (
                  <span
                    aria-hidden
                    className="hidden shrink-0 px-2 text-2xl font-bold text-foreground lg:inline-block"
                  >
                    →
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <Link
            to="/scenario"
            className="rounded-lg bg-[#FAD338] px-10 py-4 text-base font-bold text-[#15202B] shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-colors hover:bg-[#E8B91F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2"
          >
            학습 시작하기 →
          </Link>
          <button
            type="button"
            onClick={handleDemo}
            className="rounded-lg border-[1.5px] border-[#15202B] bg-transparent px-10 py-4 text-base font-medium text-[#15202B] transition-colors hover:bg-[#15202B]/[0.04]"
          >
            데모 모드로 보기
          </button>
        </section>
      </main>
    </div>
  );
};

export default Landing;
